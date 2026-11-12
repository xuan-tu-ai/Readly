import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock, Gauge, Layers } from "lucide-react";
import { DiscussionIcon } from "@/components/art/notification-icons";
import { PageSkeleton } from "@/components/app-shell";
import { MascotSays } from "@/components/mascot/mascot";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MiniGameCard } from "@/components/gamification/mini-game-card";
import { SegmentPath } from "@/components/works/segment-path";
import { GENRE_COLOR, WorkCover } from "@/components/works/work-cover";
import { GENRE_LABEL, difficultyLabel, formatMinutes } from "@/lib/catalog";
import { requireUser } from "@/server/auth/dal";
import { cn } from "@/lib/utils";
import { getStudentDeadline } from "@/server/services/assignments";
import { countClassPosts } from "@/server/services/discussions";
import { getCompletionStatus } from "@/server/services/questions";
import { listWorkGames } from "@/server/services/minigames";
import { getWorkPath } from "@/server/services/reading";
import { getVisibleWorkBySlug } from "@/server/services/works";
import { formatDayMonth } from "@/lib/vn-date";

export const metadata: Metadata = { title: "Tác phẩm" };

export default function WorkDetailPage({ params }: PageProps<"/student/works/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkDetail params={params} />
    </Suspense>
  );
}

async function WorkDetail({ params }: Pick<PageProps<"/student/works/[slug]">, "params">) {
  const user = await requireUser("STUDENT");
  const { slug } = await params;
  const work = await getVisibleWorkBySlug(slug);
  if (!work) notFound();
  const readable = work.status === "PUBLISHED" && work.segmentCount > 0;
  const [path, completion, games, deadline, postCount] = readable
    ? await Promise.all([
        getWorkPath(user.id, work.id),
        getCompletionStatus(user.id, work.id),
        listWorkGames(user.id, work.id),
        getStudentDeadline(user.id, work.id),
        countClassPosts(user.id, work.id),
      ])
    : [[], null, [], null, null];
  const readCount = path.filter((n) => n.read).length;
  const started = readCount > 0;

  return (
    <article className="grid gap-8">
      <header className="relative isolate -mx-4 -mt-6 overflow-hidden px-4 pt-6 pb-8 md:-mx-10 md:-mt-10 md:px-10 md:pt-10">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklch, ${GENRE_COLOR[work.genre]} 22%, var(--background)) 0%, var(--background) 100%)`,
          }}
        />
        <Link
          href="/student/library"
          className="mb-6 inline-flex items-center gap-1 text-sm font-bold text-muted-foreground uppercase hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> Thư viện
        </Link>
        <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:items-end">
          <WorkCover
            title={work.title}
            genre={work.genre}
            coverUrl={work.coverUrl}
            className="max-w-[200px] -rotate-2 shadow-2xl ring-4 ring-white"
          />
          <div className="grid content-start gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{GENRE_LABEL[work.genre]}</Badge>
              {work.tags.map((tag) => (
                <Badge key={tag.slug} variant="outline" className="border-2 bg-card">
                  {tag.label}
                </Badge>
              ))}
              {work.status === "COMING_SOON" ? <Badge>Sắp có</Badge> : null}
              {deadline ? (
                <Badge className={cn("gap-1", !completion?.completedAt && deadline.passed ? "bg-destructive" : "bg-brand-orange")}>
                  <CalendarDays aria-hidden /> GV giao – hạn {formatDayMonth(deadline.dueAt)}
                </Badge>
              ) : null}
            </div>
            <h1 className="font-heading text-4xl leading-tight font-semibold">{work.title}</h1>
            <p className="text-lg text-muted-foreground">{work.author}</p>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              <Meta icon={Clock} label="Thời lượng ước tính" value={formatMinutes(work.estMinutes)} />
              <Meta icon={Gauge} label="Độ khó" value={difficultyLabel(work.difficulty)} />
              {work.segmentCount > 0 ? (
                <Meta icon={Layers} label="Số phân đoạn" value={`${work.segmentCount} phân đoạn`} />
              ) : null}
            </dl>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {readable ? (
                <Link href={`/student/read/${work.slug}`} className={buttonVariants({ size: "xl", className: "uppercase" })}>
                  <BookOpen aria-hidden />
                  {started ? "Tiếp tục đọc" : "Bắt đầu đọc"}
                </Link>
              ) : (
                <Button disabled size="xl">
                  <BookOpen aria-hidden />
                  Tác phẩm sắp có
                </Button>
              )}
              {started ? (
                <div className="flex min-w-48 flex-1 items-center gap-3 sm:max-w-64">
                  <ProgressBar value={readCount} max={path.length} label="Tiến độ đọc" className="flex-1" />
                  <span className="text-sm font-bold tabular-nums">
                    {readCount}/{path.length}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-6">
          <section className="grid gap-2">
            <h2 className="font-heading text-2xl font-semibold">Tóm tắt</h2>
            <p className="leading-relaxed">{work.summary}</p>
          </section>
          <section className="grid gap-2">
            <h2 className="font-heading text-2xl font-semibold">Về tác giả</h2>
            <p className="leading-relaxed text-muted-foreground">{work.authorBio}</p>
          </section>
          {readable ? (
            <section className="grid gap-3" aria-labelledby="discussion-heading">
              <h2 id="discussion-heading" className="font-heading text-2xl font-semibold">
                Thảo luận
              </h2>
              <Link
                href={`/student/works/${work.slug}/discussion`}
                className="group flex items-center gap-3 rounded-2xl border-2 bg-card p-3 transition-transform hover:-translate-y-0.5"
              >
                <DiscussionIcon marker="question" size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {postCount === null ? "Thảo luận cùng lớp" : postCount > 0 ? `${postCount} bài trong lớp bạn` : "Chưa có bài nào"}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {postCount === null
                      ? "Vào một lớp để hỏi và chia sẻ cảm nhận với các bạn."
                      : "Đặt câu hỏi, chia sẻ cảm nhận, trích đoạn văn bạn thích."}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </section>
          ) : null}
          {games.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="font-heading text-2xl font-semibold">Mini game</h2>
              <p className="text-sm text-muted-foreground">
                Mỗi mini game mở khi bạn đọc tới phân đoạn của nó, nên không lo bị lộ nội dung phía sau.
              </p>
              <div className="grid gap-3">
                {games.map((g) => (
                  <MiniGameCard key={g.id} game={g} unlocked={g.unlocked} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {readable ? (
          <section aria-labelledby="path-heading" className="grid content-start gap-4 lg:row-span-2">
            <h2 id="path-heading" className="font-heading text-2xl font-semibold">
              Lộ trình đọc
            </h2>
            <div className="overflow-hidden rounded-3xl border-2 bg-card px-4 pt-12 pb-8">
              <SegmentPath slug={work.slug} nodes={path} completed={Boolean(completion?.completedAt)} />
            </div>
          </section>
        ) : (
          <MascotSays pose="sleep" size={96}>
            Tác phẩm này đang được chuẩn bị. Mướp sẽ báo khi đọc được nhé!
          </MascotSays>
        )}
      </div>
    </article>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
