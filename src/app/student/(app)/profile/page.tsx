import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BookOpenCheck, BookOpen, Highlighter, Sparkles } from "lucide-react";
import { setAvatarAction } from "@/app/actions/student";
import { PageSkeleton } from "@/components/app-shell";
import { CatAvatar } from "@/components/art/avatars";
import { BadgeArt } from "@/components/art/badge";
import { StreakFlame, XpIcon } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { WorkCover } from "@/components/works/work-cover";
import type { HighlightColor } from "@/generated/prisma/enums";
import { AVATARS } from "@/lib/art";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/vn-date";
import { requireUser } from "@/server/auth/dal";
import { getActiveClass } from "@/server/services/classes";
import { getPlayer, listBadges } from "@/server/services/gamification";
import {
  getAvatar,
  getHighlightFacets,
  getReadingHistory,
  listProfileHighlights,
  type ProfileHighlight,
  type ReadingHistory,
} from "@/server/services/profile";

export const metadata: Metadata = { title: "Hồ sơ đọc" };

const COLORS: { value: HighlightColor; label: string; swatch: string }[] = [
  { value: "YELLOW", label: "Ấn tượng", swatch: "var(--hl-yellow)" },
  { value: "BLUE", label: "Thắc mắc", swatch: "var(--hl-blue)" },
  { value: "PINK", label: "Cảm xúc", swatch: "var(--hl-pink)" },
  { value: "PURPLE", label: "Nghệ thuật", swatch: "var(--hl-purple)" },
];
const COLOR_LABEL = Object.fromEntries(COLORS.map((c) => [c.value, c])) as Record<HighlightColor, (typeof COLORS)[number]>;

export default function ProfilePage({ searchParams }: PageProps<"/student/profile">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ searchParams }: Pick<PageProps<"/student/profile">, "searchParams">) {
  const user = await requireUser("STUDENT");
  const params = await searchParams;
  const color = COLORS.find((c) => c.value === params.color)?.value;
  const work = typeof params.work === "string" && params.work ? params.work : undefined;

  const [avatar, activeClass, player, badges, history, facets, highlights] = await Promise.all([
    getAvatar(user.id),
    getActiveClass(user.id),
    getPlayer(user.id),
    listBadges(user.id),
    getReadingHistory(user.id),
    getHighlightFacets(user.id),
    listProfileHighlights(user.id, { color, work }),
  ]);
  const earned = badges.filter((b) => b.earned);

  return (
    <div className="grid gap-8">
      <section className="grid gap-5 rounded-3xl border-2 bg-card p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
        <div className="grid justify-items-center gap-2">
          <CatAvatar avatar={avatar} size={112} label="" />
          <AvatarPicker current={avatar} />
        </div>
        <div className="grid min-w-0 gap-3 text-center sm:text-left">
          <div>
            <h1 className="font-heading text-3xl font-semibold">{user.name}</h1>
            <p className="text-sm text-muted-foreground">
              {activeClass ? `Lớp ${activeClass.name}` : "Chưa vào lớp nào"} · Hồ sơ đọc
            </p>
          </div>
          <ul className="flex flex-wrap justify-center gap-2 text-sm font-extrabold sm:justify-start">
            <li className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <LevelEmblem level={player.level.level} size={24} label="" /> Cấp {player.level.level} · {player.level.name}
            </li>
            <li className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[#c48508] dark:text-[#f2c14e]">
              <XpIcon size={20} /> {player.points} điểm
            </li>
            <li className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
              <StreakFlame lit={player.streak.today} size={20} label="" /> {player.streak.current} ngày streak
            </li>
          </ul>
        </div>
      </section>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Tóm tắt">
        <Stat icon={<BookOpenCheck aria-hidden />} value={history.completed.length} label="tác phẩm đã đọc xong" />
        <Stat icon={<BookOpen aria-hidden />} value={history.reading.length} label="tác phẩm đang đọc" />
        <Stat icon={<Highlighter aria-hidden />} value={facets.total} label="đoạn đã tô sáng" />
        <Stat icon={<Sparkles aria-hidden />} value={earned.length} label="huy hiệu đã nhận" />
      </ul>

      <section aria-labelledby="badges-heading" className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="badges-heading" className="font-heading text-2xl font-semibold">
            Huy hiệu
          </h2>
          <Link href="/student/achievements" className="text-sm font-bold text-primary hover:underline">
            Xem tất cả thành tích
          </Link>
        </div>
        {earned.length ? (
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {earned.slice(0, 8).map((b) => (
              <li key={b.id} className="grid w-24 shrink-0 justify-items-center gap-1 text-center">
                <BadgeArt emblem={b.emblem} tier={b.tier} caption={b.caption} size={72} label="" />
                <span className="text-xs leading-tight font-bold">{b.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground">
            Chưa có huy hiệu nào. Hoàn thành tác phẩm đầu tiên để nhận huy hiệu nhé.
          </p>
        )}
      </section>

      <History history={history} />

      <section aria-labelledby="highlights-heading" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="highlights-heading" className="font-heading text-2xl font-semibold">
            Đoạn đã tô sáng
          </h2>
          <p className="text-sm text-muted-foreground">Những câu bạn đã đánh dấu khi đọc, mới nhất ở trên.</p>
        </div>
        {facets.total ? (
          <>
            <HighlightFilters facets={facets} color={color} work={work} />
            {highlights.length ? (
              <ul className="grid gap-3">
                {highlights.map((h) => (
                  <HighlightCard key={h.id} highlight={h} />
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground">
                Không có đoạn nào khớp bộ lọc.{" "}
                <Link href="/student/profile" className="font-bold text-primary hover:underline">
                  Bỏ lọc
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground">
            Bạn chưa tô sáng đoạn nào. Khi đọc, chọn một câu rồi chọn màu để lưu vào đây.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <li className="grid gap-1 rounded-2xl border-2 bg-card p-4 [&_svg]:size-5 [&_svg]:text-primary">
      {icon}
      <span className="font-heading text-3xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </li>
  );
}

/** Plain form: each avatar is a submit button, so it works without client JavaScript. */
function AvatarPicker({ current }: { current: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-full px-3 py-1 text-sm font-bold text-primary hover:bg-muted [&::-webkit-details-marker]:hidden">
        Đổi avatar
      </summary>
      <form action={setAvatarAction} className="mt-2 grid grid-cols-4 gap-2 rounded-2xl border-2 bg-background p-2">
        {AVATARS.map((a) => (
          <button
            key={a.key}
            type="submit"
            name="avatar"
            value={a.key}
            aria-pressed={a.key === current}
            title={a.label}
            className={cn(
              "grid justify-items-center gap-0.5 rounded-xl border-2 border-transparent p-1 text-[0.65rem] font-bold hover:bg-muted",
              a.key === current && "border-primary bg-primary/10",
            )}
          >
            <CatAvatar avatar={a.key} size={44} label="" />
            {a.label}
          </button>
        ))}
      </form>
    </details>
  );
}

function History({ history }: { history: ReadingHistory }) {
  return (
    <section aria-labelledby="history-heading" className="grid gap-4">
      <h2 id="history-heading" className="font-heading text-2xl font-semibold">
        Lịch sử đọc
      </h2>
      {history.reading.length === 0 && history.completed.length === 0 ? (
        <div className="grid gap-3 rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground sm:flex sm:items-center sm:justify-between">
          <p>Bạn chưa mở tác phẩm nào.</p>
          <Link href="/student/library" className={buttonVariants({ size: "sm", className: "uppercase" })}>
            Vào thư viện
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-2">
            <h3 className="text-sm font-extrabold tracking-wider text-muted-foreground uppercase">
              Đang đọc ({history.reading.length})
            </h3>
            {history.reading.length ? (
              <ul className="grid gap-2">
                {history.reading.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/student/read/${w.slug}`}
                      className="grid grid-cols-[48px_1fr] items-center gap-3 rounded-2xl border-2 bg-card p-3 hover:border-primary/50"
                    >
                      <WorkCover title={w.title} genre={w.genre} coverUrl={w.coverUrl} />
                      <span className="grid min-w-0 gap-1">
                        <span className="truncate font-bold">{w.title}</span>
                        <span className="flex items-center gap-2">
                          <ProgressBar value={w.read} max={Math.max(1, w.total)} label={`Tiến độ ${w.title}`} className="h-2.5 flex-1" />
                          <span className="text-xs font-bold tabular-nums">{w.percent}%</span>
                        </span>
                        <span className="text-xs text-muted-foreground">Đọc gần nhất {formatDate(w.lastReadAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Không có tác phẩm nào đang đọc dở.</p>
            )}
          </div>
          <div className="grid gap-2">
            <h3 className="text-sm font-extrabold tracking-wider text-muted-foreground uppercase">
              Đã đọc xong ({history.completed.length})
            </h3>
            {history.completed.length ? (
              <ul className="grid gap-2">
                {history.completed.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/student/works/${w.slug}`}
                      className="grid grid-cols-[48px_1fr] items-center gap-3 rounded-2xl border-2 bg-card p-3 hover:border-primary/50"
                    >
                      <WorkCover title={w.title} genre={w.genre} coverUrl={w.coverUrl} />
                      <span className="grid min-w-0 gap-1">
                        <span className="truncate font-bold">{w.title}</span>
                        <span className="truncate text-sm text-muted-foreground">{w.author}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          Xong ngày {formatDate(w.completedAt)}
                          {w.onTime ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">Đúng hạn</span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa hoàn thành tác phẩm nào.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function filterHref(color: string | undefined, work: string | undefined) {
  const q = new URLSearchParams();
  if (color) q.set("color", color);
  if (work) q.set("work", work);
  const s = q.toString();
  return s ? `/student/profile?${s}#highlights-heading` : "/student/profile#highlights-heading";
}

function HighlightFilters({
  facets,
  color,
  work,
}: {
  facets: Awaited<ReturnType<typeof getHighlightFacets>>;
  color: HighlightColor | undefined;
  work: string | undefined;
}) {
  const chip = "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold hover:bg-muted";
  const on = "border-primary bg-primary/10 text-primary";
  return (
    <div className="grid gap-2">
      <nav aria-label="Lọc theo màu" className="flex flex-wrap gap-2">
        <Link href={filterHref(undefined, work)} aria-current={!color ? "true" : undefined} className={cn(chip, !color && on)}>
          Mọi màu
        </Link>
        {COLORS.map((c) => (
          <Link
            key={c.value}
            href={filterHref(c.value, work)}
            aria-current={color === c.value ? "true" : undefined}
            className={cn(chip, color === c.value && on)}
          >
            <span aria-hidden className="size-3 rounded-full" style={{ background: c.swatch }} />
            {c.label}
            <span className="text-muted-foreground tabular-nums">{facets.colors[c.value] ?? 0}</span>
          </Link>
        ))}
      </nav>
      {facets.works.length > 1 ? (
        <nav aria-label="Lọc theo tác phẩm" className="flex flex-wrap gap-2">
          <Link href={filterHref(color, undefined)} aria-current={!work ? "true" : undefined} className={cn(chip, !work && on)}>
            Mọi tác phẩm
          </Link>
          {facets.works.map((w) => (
            <Link
              key={w.slug}
              href={filterHref(color, w.slug)}
              aria-current={work === w.slug ? "true" : undefined}
              className={cn(chip, "max-w-full", work === w.slug && on)}
            >
              <span className="truncate">{w.title}</span>
              <span className="text-muted-foreground tabular-nums">{w.count}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function HighlightCard({ highlight: h }: { highlight: ProfileHighlight }) {
  const c = COLOR_LABEL[h.color];
  return (
    <li className="grid gap-2 rounded-2xl border-2 bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full" style={{ background: c.swatch }} />
          {c.label}
        </span>
        <span>
          {h.work.title} · {h.segment.title}
        </span>
        <span>Lưu ngày {formatDate(h.createdAt)}</span>
      </div>
      <blockquote
        className={cn("border-l-4 pl-3 font-serif text-lg leading-relaxed", h.gone && "text-muted-foreground")}
        style={{ borderColor: c.swatch }}
      >
        {h.quote}
      </blockquote>
      {h.note ? <p className="rounded-xl bg-muted px-3 py-2 text-sm">Ghi chú: {h.note}</p> : null}
      {h.gone ? (
        <p className="text-xs font-bold text-muted-foreground">Đoạn này không còn trong văn bản sau khi tác phẩm được chỉnh sửa.</p>
      ) : (
        <Link
          href={`/student/read/${h.work.slug}?seg=${h.segment.id}&q=${h.start}-${h.end}`}
          className="w-fit text-sm font-bold text-primary hover:underline"
        >
          Mở trong bài đọc
        </Link>
      )}
    </li>
  );
}
