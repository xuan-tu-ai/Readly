import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { CatAvatar } from "@/components/art/avatars";
import { CrownIcon, RankMedal, XpIcon } from "@/components/art/game-icons";
import { Mascot, MascotSays } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { getClassLeaderboard, getPointTable, type LeaderboardRow } from "@/server/services/gamification";

export const metadata: Metadata = { title: "Bảng xếp hạng" };

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Leaderboard />
    </Suspense>
  );
}

async function Leaderboard() {
  const user = await requireUser("STUDENT");
  const [board, table] = await Promise.all([getClassLeaderboard(user.id), getPointTable()]);

  if (board.state === "no-class") {
    return (
      <Empty pose="think" title="Bạn chưa thuộc lớp nào">
        Bảng xếp hạng so điểm trong tuần giữa các bạn cùng lớp. Nhập mã lớp để tham gia nhé.
        <Link href="/student/class" className={buttonVariants({ className: "mt-4 uppercase" })}>
          Nhập mã lớp
        </Link>
      </Empty>
    );
  }
  if (board.state === "disabled") {
    return (
      <Empty pose="sleep" title="Bảng xếp hạng đang tắt">
        Giáo viên lớp {board.className} đã tắt bảng xếp hạng. Bạn vẫn nhận điểm, streak và huy hiệu như thường.
      </Empty>
    );
  }

  const daysLeft = board.daysLeft;
  const podium = board.top.slice(0, 3);
  const meOutside = board.me && !board.top.some((r) => r.me) ? board.me : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <MascotSays pose="trophy" size={100}>
          <span className="block font-heading text-2xl font-semibold sm:text-3xl">Bảng xếp hạng tuần</span>
          <span className="text-muted-foreground">
            Lớp {board.className} · làm mới sau {daysLeft} ngày (thứ Hai, 0 giờ)
          </span>
        </MascotSays>

        {podium.length > 0 && podium[0].points > 0 ? <Podium rows={podium} /> : null}

        <ol className="grid gap-2" aria-label="Xếp hạng trong lớp">
          {board.top.map((row) => (
            <Row key={row.userId} row={row} />
          ))}
          {meOutside ? (
            <>
              <li aria-hidden className="py-1 text-center text-muted-foreground">
                ⋯
              </li>
              <Row row={meOutside} />
            </>
          ) : null}
        </ol>
        <p className="text-sm text-muted-foreground">
          {board.size} học sinh. Điểm tính từ thứ Hai 0 giờ (giờ Việt Nam); bạn bằng điểm nhau thì cùng hạng.
        </p>
      </div>

      <aside className="grid gap-3 rounded-2xl border-2 bg-card p-5">
        <h2 className="font-bold">Cách nhận điểm</h2>
        <ul className="grid gap-2 text-sm">
          {[
            ["Trắc nghiệm đúng ngay lần đầu", table.mcqFirstTry],
            ["Tự luận ngắn: Đạt / Sâu sắc", `${table.shortDat} / ${table.shortSauSac}`],
            ["Đoạn cảm nhận: Đạt / Sâu sắc", `${table.essayDat} / ${table.essaySauSac}`],
            ["Hoàn thành tác phẩm", table.workCompleted],
            ["Xong bài giao trước hạn", `+${table.workEarlyBonus}`],
            ["Mini game (theo kỷ lục)", `tối đa ${table.miniGameMax}`],
          ].map(([label, value]) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <span className="flex shrink-0 items-center gap-1 font-extrabold text-[#c48508]">
                <XpIcon size={18} /> {value}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Podium({ rows }: { rows: LeaderboardRow[] }) {
  // Visual order: 2nd, 1st, 3rd.
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  const height: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-14" };
  return (
    <div className="flex items-end justify-center gap-3 pt-6 sm:gap-6" aria-hidden>
      {order.map((row) => {
        const place = Math.min(3, row.rank) as 1 | 2 | 3;
        return (
          <div key={row.userId} className="grid w-24 justify-items-center gap-1.5 sm:w-28">
            {row.rank === 1 ? <CrownIcon size={34} className="-mb-1" /> : null}
            <CatAvatar avatar={row.avatar} size={row.rank === 1 ? 72 : 60} label="" />
            <p className="line-clamp-1 text-center text-sm font-bold">{row.name}</p>
            <div
              className={cn(
                "grid w-full place-items-center rounded-t-2xl font-extrabold text-white",
                height[place],
                place === 1 ? "bg-[#f7b72a]" : place === 2 ? "bg-[#aeb8c7]" : "bg-[#d98a4e]",
              )}
            >
              <RankMedal rank={place} size={36} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-2.5",
        row.me && "border-brand-blue bg-sidebar-accent",
      )}
      aria-current={row.me ? "true" : undefined}
    >
      <span className="grid w-8 shrink-0 place-items-center font-extrabold text-muted-foreground tabular-nums">
        {row.rank <= 3 && row.points > 0 ? <RankMedal rank={row.rank as 1 | 2 | 3} size={30} label={`Hạng ${row.rank}`} /> : row.rank}
      </span>
      <CatAvatar avatar={row.avatar} size={40} label="" />
      <span className="min-w-0 flex-1 truncate font-bold">
        {row.name}
        {row.me ? <span className="ml-2 text-xs font-extrabold text-brand-blue uppercase">Bạn</span> : null}
      </span>
      <span className="flex items-center gap-1 font-extrabold text-[#c48508] tabular-nums">
        <XpIcon size={20} /> {row.points}
      </span>
    </li>
  );
}

function Empty({ pose, title, children }: { pose: "think" | "sleep"; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 py-10 text-center">
      <Mascot pose={pose} size={140} label="" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="grid justify-items-center text-muted-foreground">{children}</p>
    </div>
  );
}
