import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileUp, Plus } from "lucide-react";
import { segmentCommandAction } from "@/app/actions/admin-content";
import { PageSkeleton } from "@/components/app-shell";
import { SegmentEditor } from "@/components/admin/segment-editor";
import { Mascot } from "@/components/mascot/mascot";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAdminWork } from "@/server/services/admin/works";
import { loadForAdmin } from "../load";

export const metadata: Metadata = { title: "Văn bản tác phẩm" };

export default function WorkTextPage({ params, searchParams }: PageProps<"/admin/works/[id]/text">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Text params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Text({ params, searchParams }: PageProps<"/admin/works/[id]/text">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const work = await loadForAdmin((user) => getAdminWork(user, id));
  // After an import: "?reanchored=<moved>-<orphaned>".
  const reanchored = typeof query.reanchored === "string" ? /^(\d+)-(\d+)$/.exec(query.reanchored) : null;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mỗi phân đoạn là một đơn vị đọc (khổ thơ, cảnh kịch, phần truyện). Sửa văn bản đã xuất bản vẫn giữ nguyên phân đoạn, và
          highlight của học sinh được neo lại tự động. Phân đoạn đã có dữ liệu khi bị xóa sẽ được lưu trữ, không mất lịch sử.
        </p>
        <Link href={`/admin/works/${id}/import`} className={buttonVariants({ className: "uppercase" })}>
          <FileUp aria-hidden /> Nhập từ .docx
        </Link>
      </div>
      {reanchored ? (
        <p role="status" className="rounded-xl border-2 border-primary/40 bg-primary/10 px-4 py-2 text-sm">
          Đã lưu văn bản. Highlight của học sinh: {reanchored[1]} được neo lại vào chỗ mới, {reanchored[2]} không còn trong văn bản.
        </p>
      ) : null}
      {work.orphanedHighlights > 0 ? (
        <p className="rounded-xl border-2 border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-sm">
          {work.orphanedHighlights} highlight của học sinh không còn trong văn bản sau các lần sửa. Chúng vẫn nằm trong hồ sơ đọc của các
          em, nhưng không hiện trên trang đọc.
        </p>
      ) : null}

      {work.segments.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center">
          <Mascot pose="read" size={96} label="" />
          <p className="font-bold">Chưa có văn bản</p>
          <p className="max-w-sm text-sm text-muted-foreground">Nhập tệp Word (.docx), Readly sẽ gợi ý cách chia phân đoạn để bạn chỉnh.</p>
        </div>
      ) : (
        <ol className="grid gap-4">
          {work.segments.map((s, i) => (
            <li key={s.id}>
              <SegmentEditor
                segment={{ id: s.id, order: s.order, title: s.title, content: s.content }}
                usage={s._count}
                first={i === 0}
                last={i === work.segments.length - 1}
              />
            </li>
          ))}
        </ol>
      )}
      <form action={segmentCommandAction}>
        <input type="hidden" name="command" value="add" />
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline">
          <Plus aria-hidden /> Thêm phân đoạn
        </Button>
      </form>
    </div>
  );
}
