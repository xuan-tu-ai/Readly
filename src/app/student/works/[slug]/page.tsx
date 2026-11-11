import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookOpen, ChevronLeft, Clock, Gauge, Layers } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkCover } from "@/components/works/work-cover";
import { GENRE_LABEL, difficultyLabel, formatMinutes } from "@/lib/catalog";
import { requireUser } from "@/server/auth/dal";
import { getVisibleWorkBySlug } from "@/server/services/works";
import { getWorkProgress } from "@/server/services/reading";

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
  const comingSoon = work.status === "COMING_SOON";
  const progress = comingSoon ? null : await getWorkProgress(user.id, work.id);

  return (
    <article className="grid gap-6">
      <Link
        href="/student/library"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Thư viện
      </Link>

      <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
        <WorkCover title={work.title} genre={work.genre} coverUrl={work.coverUrl} className="max-w-[180px]" />
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{GENRE_LABEL[work.genre]}</Badge>
            {work.tags.map((tag) => (
              <Badge key={tag.slug} variant="outline">
                {tag.label}
              </Badge>
            ))}
            {comingSoon ? <Badge>Sắp có</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold leading-tight">{work.title}</h1>
          <p className="text-lg text-muted-foreground">{work.author}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Meta icon={Clock} label="Thời lượng ước tính" value={formatMinutes(work.estMinutes)} />
            <Meta icon={Gauge} label="Độ khó" value={difficultyLabel(work.difficulty)} />
            {work.segmentCount > 0 ? <Meta icon={Layers} label="Số phân đoạn" value={String(work.segmentCount)} /> : null}
          </dl>
          <div className="pt-2">
            {comingSoon || !progress || progress.total === 0 ? (
              <Button disabled size="lg">
                <BookOpen aria-hidden />
                Tác phẩm sắp có
              </Button>
            ) : (
              <>
                <Link href={`/student/read/${work.slug}`} className={buttonVariants({ size: "lg" })}>
                  <BookOpen aria-hidden />
                  {progress.started ? "Tiếp tục đọc" : "Bắt đầu đọc"}
                </Link>
                {progress.started ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Đã đọc {progress.read}/{progress.total} phân đoạn
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Tóm tắt</h2>
        <p className="leading-relaxed">{work.summary}</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Về tác giả</h2>
        <p className="leading-relaxed text-muted-foreground">{work.authorBio}</p>
      </section>
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
