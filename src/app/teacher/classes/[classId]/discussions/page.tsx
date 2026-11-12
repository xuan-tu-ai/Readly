import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Flag } from "lucide-react";
import { dismissReportsAction, moderatePostAction, moderateReplyAction } from "@/app/actions/discussions";
import { PageSkeleton } from "@/components/app-shell";
import { PostCard } from "@/components/discussion/post-card";
import { Mascot } from "@/components/mascot/mascot";
import { Button } from "@/components/ui/button";
import { POST_SORTS, POST_TYPE_LABEL, type PostSort } from "@/lib/discussion";
import { cn } from "@/lib/utils";
import { formatTimeDayMonth } from "@/lib/vn-date";
import { getTeacherDiscussion, listClassDiscussionWorks, listReportQueue } from "@/server/services/discussions";
import { loadForTeacher } from "../load";

export const metadata: Metadata = { title: "Thảo luận của lớp" };

const SORT_LABEL: Record<PostSort, string> = { new: "Mới nhất", top: "Nổi bật" };
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default function ClassDiscussionsPage({ params, searchParams }: PageProps<"/teacher/classes/[classId]/discussions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Discussions params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Discussions({ params, searchParams }: PageProps<"/teacher/classes/[classId]/discussions">) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const sort = POST_SORTS.find((s) => s === one(query.sort)) ?? "new";
  const type = (["QUESTION", "REFLECTION"] as const).find((t) => t === one(query.type)) ?? null;

  const { queue, works } = await loadForTeacher(async (user) => ({
    queue: await listReportQueue(user, classId),
    works: await listClassDiscussionWorks(user, classId),
  }));
  const selected = works.find((w) => w.id === one(query.work)) ?? works.find((w) => w.posts > 0) ?? works[0] ?? null;
  const discussion = selected
    ? await loadForTeacher((user) => getTeacherDiscussion(user, classId, selected.id, { sort, type }))
    : null;

  const base = `/teacher/classes/${classId}/discussions`;
  const href = (next: { work?: string; sort?: PostSort; type?: string | null }) => {
    const p = new URLSearchParams();
    const w = next.work ?? selected?.id;
    if (w) p.set("work", w);
    const s = next.sort ?? sort;
    if (s !== "new") p.set("sort", s);
    const t = next.type === undefined ? type : next.type;
    if (t) p.set("type", t);
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="grid gap-8">
      <section aria-labelledby="queue-heading" className="grid gap-3">
        <h2 id="queue-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Flag className="size-5 text-destructive" aria-hidden /> Bị báo cáo ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground">
            Không có bài nào đang chờ xem xét. Bài đăng lên ngay; học sinh có nút báo cáo khi thấy nội dung không phù hợp.
          </p>
        ) : (
          <ul className="grid gap-3">
            {queue.map((item) => (
              <li key={item.replyId ?? item.postId} className="grid gap-2 rounded-2xl border-2 border-destructive/30 bg-card p-4">
                <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  {item.replyId ? "Trả lời" : "Bài viết"} · {item.work.title} · của {item.author}
                  {item.hidden ? " · đang ẩn" : ""}
                </p>
                <p className="line-clamp-3 whitespace-pre-line">{item.body}</p>
                <ul className="grid gap-1 text-sm">
                  {item.reports.map((r, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{r.by}</span> báo cáo lúc {formatTimeDayMonth(r.at)}
                      {r.reason ? `: “${r.reason}”` : ""}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {item.replyId ? (
                    <form action={moderateReplyAction}>
                      <input type="hidden" name="replyId" value={item.replyId} />
                      <input type="hidden" name="hidden" value="true" />
                      <Button type="submit" size="sm" variant="destructive">
                        <EyeOff aria-hidden /> Ẩn trả lời
                      </Button>
                    </form>
                  ) : (
                    <form action={moderatePostAction}>
                      <input type="hidden" name="postId" value={item.postId} />
                      <input type="hidden" name="hidden" value="true" />
                      <Button type="submit" size="sm" variant="destructive">
                        <EyeOff aria-hidden /> Ẩn bài
                      </Button>
                    </form>
                  )}
                  <form action={dismissReportsAction}>
                    <input type="hidden" name="postId" value={item.postId} />
                    {item.replyId ? <input type="hidden" name="replyId" value={item.replyId} /> : null}
                    <Button type="submit" size="sm" variant="outline">
                      Giữ lại, bỏ qua báo cáo
                    </Button>
                  </form>
                  <Link href={`${href({ work: item.work.id })}#post-${item.postId}`} className="self-center text-sm font-bold text-brand-blue hover:underline">
                    Xem trong thảo luận
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="threads-heading" className="grid gap-4">
        <h2 id="threads-heading" className="text-xl font-semibold">
          Thảo luận theo tác phẩm
        </h2>
        {works.length === 0 || !discussion ? (
          <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center">
            <Mascot pose="read" size={88} label="" />
            <p className="font-bold">Lớp chưa có thảo luận nào</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Học sinh thảo luận ở trang tác phẩm hoặc bấm “Thảo luận đoạn này” khi đọc.
            </p>
          </div>
        ) : (
          <>
            <nav aria-label="Chọn tác phẩm" className="flex flex-wrap gap-2">
              {works.map((w) => (
                <Chip key={w.id} href={href({ work: w.id })} active={w.id === selected?.id}>
                  {w.title} <span className="font-semibold text-muted-foreground tabular-nums">· {w.posts}</span>
                  {w.openReports > 0 ? <span className="ml-1 text-destructive">· {w.openReports} báo cáo</span> : null}
                </Chip>
              ))}
            </nav>
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
            {discussion.posts.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có bài nào ở mục này.
              </p>
            ) : (
              <div className="grid gap-4">
                {discussion.posts.map((p) => (
                  <PostCard key={p.id} post={p} slug={discussion.work.slug} mode="teacher" />
                ))}
              </div>
            )}
          </>
        )}
      </section>
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
