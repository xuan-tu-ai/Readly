import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, Clock3, Layers, School } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { CatAvatar } from "@/components/art/avatars";
import { BadgeArt } from "@/components/art/badge";
import { StreakFlame } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { Mascot, MascotSays } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AssignedWorks } from "@/components/works/assigned-works";
import { QuizCallToAction, RecommendationRow } from "@/components/works/recommendations";
import { WorkCover } from "@/components/works/work-cover";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { getActiveClass } from "@/server/services/classes";
import { listStudentAssignments } from "@/server/services/assignments";
import { getClassLeaderboard, getPlayer, getPointTable, listBadges } from "@/server/services/gamification";
import { getRecommendations } from "@/server/services/quiz";
import { getContinueReading, getWeeklyStats } from "@/server/services/reading";

export const metadata: Metadata = { title: "Trang chủ" };

export default function StudentHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentHome />
    </Suspense>
  );
}

const WEEKDAY = new Intl.DateTimeFormat("vi-VN", { weekday: "narrow", timeZone: "UTC" });

function firstName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

async function StudentHome() {
  const user = await requireUser("STUDENT");
  const [activeClass, recommendations, continueReading, stats, player, board, badges, assignments, table] = await Promise.all([
    getActiveClass(user.id),
    getRecommendations(user.id, 6),
    getContinueReading(user.id),
    getWeeklyStats(user.id),
    getPlayer(user.id),
    getClassLeaderboard(user.id, new Date(), 3),
    listBadges(user.id),
    listStudentAssignments(user.id),
    getPointTable(),
  ]);
  const recentBadges = badges.filter((b) => b.earned).slice(0, 3);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid min-w-0 gap-8">
        <section className="animate-rise-in">
          <MascotSays pose="wave" size={104}>
            <span className="block font-heading text-2xl leading-tight font-semibold sm:text-3xl">
              Chào {firstName(user.name)}!
            </span>
            <span className="text-muted-foreground">
              {continueReading ? "Mình đọc tiếp chỗ hôm trước nhé?" : "Hôm nay bạn muốn đọc gì?"}
            </span>
          </MascotSays>
        </section>

        {continueReading ? (
          <section
            aria-labelledby="continue-heading"
            className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-[0_5px_0_var(--primary-edge)] sm:p-7"
          >
            <div aria-hidden className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/10" />
            <div className="relative grid grid-cols-[88px_1fr] items-center gap-5 sm:grid-cols-[120px_1fr]">
              <WorkCover
                title={continueReading.title}
                genre={continueReading.genre}
                coverUrl={continueReading.coverUrl}
                className="rotate-[-4deg] shadow-xl ring-4 ring-white/80"
              />
              <div className="grid min-w-0 gap-2">
                <p id="continue-heading" className="text-xs font-bold tracking-widest uppercase opacity-80">
                  Đang đọc
                </p>
                <p className="font-heading text-xl leading-tight font-semibold sm:text-2xl">{continueReading.title}</p>
                <p className="text-sm opacity-85">{continueReading.author}</p>
                <div className="flex items-center gap-3">
                  <ProgressBar
                    value={continueReading.readSegments}
                    max={continueReading.totalSegments}
                    label="Tiến độ đọc"
                    className="h-3 flex-1 bg-white/25"
                    tone="bg-white"
                  />
                  <span className="text-sm font-bold tabular-nums">
                    {continueReading.readSegments}/{continueReading.totalSegments}
                  </span>
                </div>
              </div>
            </div>
            <Link
              href={`/student/read/${continueReading.slug}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "relative mt-5 w-full border-white text-primary uppercase sm:w-auto",
              )}
            >
              Tiếp tục đọc
            </Link>
          </section>
        ) : (
          <section className="grid items-center gap-4 rounded-3xl border-2 bg-card p-6 sm:grid-cols-[auto_1fr_auto]">
            <Mascot pose="read" size={88} label="" />
            <div>
              <p className="font-heading text-xl font-semibold">Bắt đầu tác phẩm đầu tiên</p>
              <p className="text-sm text-muted-foreground">Chọn một tác phẩm trong thư viện, Mướp sẽ đọc cùng bạn.</p>
            </div>
            <Link href="/student/library" className={buttonVariants({ size: "lg", className: "uppercase" })}>
              Vào thư viện
            </Link>
          </section>
        )}

        {assignments.length > 0 ? <AssignedWorks items={assignments} earlyBonus={table.workEarlyBonus} /> : null}

        <section className="grid min-w-0 gap-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-heading text-2xl font-semibold">Gợi ý cho bạn</h2>
            <Link href="/student/library" className="text-sm font-bold text-brand-blue uppercase hover:underline">
              Xem thư viện
            </Link>
          </div>
          {recommendations && recommendations.length > 0 ? (
            <RecommendationRow items={recommendations} />
          ) : (
            <QuizCallToAction />
          )}
        </section>
      </div>

      <aside className="grid gap-5">
        <section className="grid gap-4 rounded-2xl border-2 bg-card p-5">
          <Link href="/student/achievements" className="flex items-center gap-4 rounded-xl hover:bg-muted/60">
            <LevelEmblem level={player.level.level} size={64} label="" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Cấp {player.level.level}</p>
              <p className="font-heading text-xl font-semibold">{player.level.name}</p>
              <ProgressBar
                value={player.points - player.level.min}
                max={(player.level.next ?? player.points) - player.level.min || 1}
                label="Tiến độ lên cấp"
                tone="bg-[#f7b72a]"
                className="mt-1 h-2.5"
              />
            </div>
          </Link>
          <div className="flex items-center gap-3 rounded-xl bg-[#fff1e8] px-3 py-2.5">
            <StreakFlame lit={player.streak.today} size={36} />
            <p className="text-sm">
              <span className="font-extrabold">{player.streak.current} ngày streak</span>
              <br />
              <span className="text-muted-foreground">
                {player.streak.today ? "Hôm nay đã giữ lửa!" : "Đọc một phân đoạn để giữ lửa."}
              </span>
            </p>
          </div>
        </section>

        {board.state === "ok" ? (
          <section className="grid gap-3 rounded-2xl border-2 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Xếp hạng tuần</h2>
              <Link href="/student/leaderboard" className="text-xs font-bold text-brand-blue uppercase hover:underline">
                Xem tất cả
              </Link>
            </div>
            <ol className="grid gap-1.5">
              {[...board.top, ...(board.me && !board.top.some((r) => r.me) ? [board.me] : [])].map((row) => (
                <li
                  key={row.userId}
                  className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm", row.me && "bg-sidebar-accent")}
                >
                  <span className="w-5 text-center font-extrabold text-muted-foreground tabular-nums">{row.rank}</span>
                  <CatAvatar avatar={row.avatar} size={28} label="" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{row.me ? "Bạn" : row.name}</span>
                  <span className="font-extrabold text-[#c48508] tabular-nums">{row.points}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {recentBadges.length > 0 ? (
          <section className="grid gap-3 rounded-2xl border-2 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Huy hiệu mới</h2>
              <Link href="/student/achievements" className="text-xs font-bold text-brand-blue uppercase hover:underline">
                Tất cả
              </Link>
            </div>
            <ul className="flex justify-around">
              {recentBadges.map((b) => (
                <li key={b.id}>
                  <BadgeArt emblem={b.emblem} tier={b.tier} size={60} label={b.name} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border-2 bg-card p-5">
          <h2 className="mb-4 font-bold">Tuần này</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat icon={Clock3} value={stats.minutes} label="phút đọc" tone="text-brand-orange" />
            <Stat icon={Layers} value={stats.segments} label="phân đoạn" tone="text-brand-blue" />
            <Stat icon={BookOpenCheck} value={stats.completedWorks} label="đã xong" tone="text-primary" />
          </div>
          <WeekChart days={stats.days} />
        </section>

        {activeClass ? (
          <section className="flex items-center gap-4 rounded-2xl border-2 bg-card p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-blue text-white">
              <School aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Lớp của bạn</p>
              <p className="truncate font-bold">{activeClass.name}</p>
              <p className="truncate text-sm text-muted-foreground">GV {activeClass.teacher.name}</p>
            </div>
          </section>
        ) : (
          <section className="grid gap-3 rounded-2xl border-2 border-brand-orange/50 bg-accent p-5">
            <p className="font-bold text-accent-foreground">Bạn chưa thuộc lớp nào</p>
            <p className="text-sm text-accent-foreground/80">
              Bạn vẫn đọc được, nhưng cần mã lớp để nhận bài giao và tham gia thảo luận.
            </p>
            <Link href="/student/class" className={buttonVariants({ variant: "orange", className: "uppercase" })}>
              Nhập mã lớp
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Clock3;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="grid justify-items-center gap-0.5 rounded-xl border-2 px-1 py-2.5">
      <Icon className={cn("size-5", tone)} aria-hidden strokeWidth={2.5} />
      <span className="text-xl font-extrabold tabular-nums">{value}</span>
      <span className="text-[0.7rem] leading-tight font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

function WeekChart({ days }: { days: { day: Date; minutes: number }[] }) {
  const max = Math.max(10, ...days.map((d) => d.minutes));
  return (
    <figure className="mt-5">
      <div className="flex h-20 items-end gap-1.5" aria-hidden>
        {days.map((d, i) => (
          <div key={d.day.toISOString()} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn(
                "min-h-1.5 rounded-md",
                i === days.length - 1 ? "bg-brand-orange" : d.minutes > 0 ? "bg-primary" : "bg-muted",
              )}
              style={{ height: `${(d.minutes / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-center text-[0.65rem] font-bold text-muted-foreground" aria-hidden>
        {days.map((d) => (
          <span key={d.day.toISOString()} className="flex-1">
            {WEEKDAY.format(d.day)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Số phút đọc 7 ngày qua: {days.map((d) => `${WEEKDAY.format(d.day)} ${d.minutes} phút`).join(", ")}
      </figcaption>
    </figure>
  );
}
