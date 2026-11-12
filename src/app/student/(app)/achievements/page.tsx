import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { BadgeArt } from "@/components/art/badge";
import { StreakFlame, XpIcon } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { ProgressBar } from "@/components/ui/progress-bar";
import { LEVELS } from "@/lib/art";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { getPlayer, listBadges, type BadgeView } from "@/server/services/gamification";

export const metadata: Metadata = { title: "Thành tích" };

export default function AchievementsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Achievements />
    </Suspense>
  );
}

const WEEKDAY = new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "UTC" });
const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

async function Achievements() {
  const user = await requireUser("STUDENT");
  const [player, badges] = await Promise.all([getPlayer(user.id), listBadges(user.id)]);
  const { level, streak } = player;
  const earned = badges.filter((b) => b.earned);

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold">Thành tích</h1>

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="level-heading" className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-3xl border-2 bg-card p-6">
          <LevelEmblem level={level.level} size={110} label="" />
          <div className="grid gap-2">
            <p className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Cấp {level.level}</p>
            <h2 id="level-heading" className="font-heading text-3xl font-semibold">
              {level.name}
            </h2>
            <p className="flex items-center gap-1.5 font-extrabold text-[#c48508]">
              <XpIcon size={22} /> {player.points} điểm
            </p>
            {level.next !== null ? (
              <>
                <ProgressBar value={player.points - level.min} max={level.next - level.min} label="Tiến độ lên cấp" tone="bg-[#f7b72a]" />
                <p className="text-sm text-muted-foreground">
                  Còn {level.next - player.points} điểm nữa để lên {LEVELS.find((l) => l.level === level.level + 1)?.name}.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Bạn đã đạt cấp cao nhất. Tuyệt vời!</p>
            )}
          </div>
        </section>

        <section aria-labelledby="streak-heading" className="grid gap-4 rounded-3xl border-2 bg-card p-6">
          <div className="flex items-center gap-4">
            <StreakFlame lit={streak.today} size={64} />
            <div>
              <h2 id="streak-heading" className="font-heading text-3xl font-semibold">
                {streak.current} ngày streak
              </h2>
              <p className="text-sm text-muted-foreground">
                {streak.today
                  ? "Hôm nay bạn đã giữ lửa rồi!"
                  : streak.current > 0
                    ? "Đọc một phân đoạn hôm nay để giữ lửa nhé."
                    : "Đọc một phân đoạn để bắt đầu streak."}{" "}
                Dài nhất: {streak.longest} ngày.
              </p>
            </div>
          </div>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="7 ngày gần nhất">
            {streak.week.map((d, i) => (
              <li key={d.day.toISOString()} className="grid justify-items-center gap-1 text-xs font-bold text-muted-foreground">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full",
                    d.active ? "bg-[#ffe3d1]" : "bg-muted",
                    i === streak.week.length - 1 && "ring-2 ring-[#f26b2b]/40",
                  )}
                >
                  <StreakFlame lit={d.active} size={20} label={d.active ? "Có đọc" : "Chưa đọc"} />
                </span>
                {WEEKDAY.format(d.day)}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="badges-heading" className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 id="badges-heading" className="font-heading text-2xl font-semibold">
            Huy hiệu
          </h2>
          <p className="text-sm font-bold text-muted-foreground">
            {earned.length}/{badges.length} đã nhận
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((b) => (
            <BadgeCard key={b.id} badge={b} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function BadgeCard({ badge }: { badge: BadgeView }) {
  return (
    <li className={cn("grid content-start justify-items-center gap-2 rounded-2xl border-2 bg-card p-4 text-center", !badge.earned && "bg-muted/40")}>
      <BadgeArt emblem={badge.emblem} tier={badge.tier} locked={!badge.earned} caption={badge.caption} size={84} label="" />
      <p className="font-bold leading-tight">{badge.name}</p>
      <p className="text-xs text-muted-foreground">{badge.description}</p>
      {badge.earned && badge.awardedAt ? (
        <p className="text-xs font-bold text-primary">Nhận ngày {DATE.format(badge.awardedAt)}</p>
      ) : (
        <div className="grid w-full gap-1">
          <ProgressBar value={badge.progress.value} max={badge.progress.target} label={`Tiến độ ${badge.name}`} className="h-2.5" />
          <p className="text-xs font-bold text-muted-foreground tabular-nums">
            {badge.progress.value}/{badge.progress.target}
          </p>
        </div>
      )}
    </li>
  );
}
