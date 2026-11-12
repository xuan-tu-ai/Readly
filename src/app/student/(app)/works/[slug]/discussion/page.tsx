import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { PostType } from "@/generated/prisma/enums";
import { PageSkeleton } from "@/components/app-shell";
import { Composer } from "@/components/discussion/composer";
import { PostCard } from "@/components/discussion/post-card";
import { Mascot, MascotSays } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { POST_SORTS, POST_TYPE_LABEL, type PostSort } from "@/lib/discussion";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import { getStudentDiscussion, previewQuote } from "@/server/services/discussions";

export const metadata: Metadata = { title: "Thảo luận" };

const SORT_LABEL: Record<PostSort, string> = { new: "Mới nhất", top: "Nổi bật" };

export default function DiscussionPage({ params, searchParams }: PageProps<"/student/works/[slug]/discussion">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Discussion params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Discussion({ params, searchParams }: PageProps<"/student/works/[slug]/discussion">) {
  const user = await requireUser("STUDENT");
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const sort = POST_SORTS.find((s) => s === one(query.sort)) ?? "new";
  const type = (["QUESTION", "REFLECTION"] as const).find((t) => t === one(query.type)) ?? null;

  let data;
  try {
    data = await getStudentDiscussion(user, slug, { sort, type });
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
  const { work } = data;

  // "Thảo luận đoạn này" from the reader: ?seg=…&start=…&end=…
  const seg = one(query.seg);
  const start = Number(one(query.start));
  const end = Number(one(query.end));
  const quote =
    data.state === "ok" && seg && Number.isInteger(start) && Number.isInteger(end)
      ? await previewQuote(slug, { segmentId: seg, start, end })
      : null;

  const href = (next: { sort?: PostSort; type?: PostType | null }) => {
    const p = new URLSearchParams();
    const s = next.sort ?? sort;
    const t = next.type === undefined ? type : next.type;
    if (s !== "new") p.set("sort", s);
    if (t) p.set("type", t);
    const qs = p.toString();
    return `/student/works/${slug}/discussion${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-2">
        <Link
          href={`/student/works/${slug}`}
          className="inline-flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground uppercase hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> {work.title}
        </Link>
        <MascotSays pose="point" size={88}>
          <span className="block font-heading text-2xl font-semibold sm:text-3xl">Thảo luận</span>
          <span className="text-muted-foreground">
            {data.state === "ok" ? `Cùng lớp ${data.class.name} bàn về “${work.title}”.` : "Thảo luận diễn ra trong từng lớp."}
          </span>
        </MascotSays>
      </div>

      {data.state === "no-class" ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center">
          <Mascot pose="think" size={96} label="" />
          <p className="font-bold">Bạn chưa thuộc lớp nào</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nhập mã lớp để thảo luận cùng các bạn. Bạn vẫn đọc tác phẩm bình thường.
          </p>
          <Link href="/student/class" className={buttonVariants({ className: "uppercase" })}>
            Nhập mã lớp
          </Link>
        </div>
      ) : (
        <>
          <section aria-label="Viết bài mới" className="rounded-2xl border-2 bg-card p-4 sm:p-5">
            <Composer slug={slug} quote={quote} className="grid gap-3" />
          </section>

          <nav aria-label="Sắp xếp và lọc" className="flex flex-wrap items-center gap-2">
            {POST_SORTS.map((s) => (
              <Chip key={s} href={href({ sort: s })} active={sort === s}>
                {SORT_LABEL[s]}
              </Chip>
            ))}
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <Chip href={href({ type: null })} active={type === null}>
              Tất cả
            </Chip>
            {(["QUESTION", "REFLECTION"] as const).map((t) => (
              <Chip key={t} href={href({ type: t })} active={type === t}>
                {POST_TYPE_LABEL[t]}
              </Chip>
            ))}
          </nav>

          {data.posts.length === 0 ? (
            <div className="grid justify-items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center">
              <Mascot pose="read" size={88} label="" />
              <p className="font-bold">{type ? `Chưa có ${POST_TYPE_LABEL[type].toLowerCase()} nào` : "Chưa có bài nào"}</p>
              <p className="text-sm text-muted-foreground">Mở đầu cuộc thảo luận đi, cả lớp đang chờ đó!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {data.posts.map((p) => (
                <PostCard key={p.id} post={p} slug={slug} mode="student" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border-2 px-3 py-1 text-sm font-bold hover:bg-muted",
        active && "border-primary bg-primary/10 hover:bg-primary/10",
      )}
    >
      {children}
    </Link>
  );
}
