import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/app-shell";
import { DeleteWorkForm, NewTagForm, WorkInfoForm } from "@/components/admin/work-info-form";
import { getAdminWork, listTags } from "@/server/services/admin/works";
import { loadForAdmin } from "./load";

export const metadata: Metadata = { title: "Sửa tác phẩm" };

export default function WorkInfoPage({ params }: PageProps<"/admin/works/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Info params={params} />
    </Suspense>
  );
}

async function Info({ params }: Pick<PageProps<"/admin/works/[id]">, "params">) {
  const { id } = await params;
  const [work, tags] = await Promise.all([loadForAdmin((user) => getAdminWork(user, id)), listTags()]);
  const used = work._count.progress + work._count.highlights + work._count.completions;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section className="rounded-2xl border-2 bg-card p-5" aria-label="Thông tin tác phẩm">
        <WorkInfoForm
          work={{
            id: work.id,
            title: work.title,
            author: work.author,
            authorBio: work.authorBio,
            genre: work.genre,
            summary: work.summary,
            difficulty: work.difficulty,
            estMinutes: work.estMinutes,
            status: work.status,
            coverUrl: work.coverUrl,
            background: work.background,
            tags: work.tags.map((t) => t.slug),
          }}
          segments={work.segments.length}
          allTags={tags}
        />
      </section>
      <aside className="grid gap-4">
        <section className="grid gap-2 rounded-2xl border-2 bg-card p-5 text-sm">
          <h2 className="text-base font-semibold">Số liệu</h2>
          <p>{work.segments.length} phân đoạn đang dùng</p>
          <p>{work._count.progress} học sinh đã mở · {work._count.completions} đã hoàn thành</p>
          <p>{work._count.highlights} highlight{work.orphanedHighlights ? ` (${work.orphanedHighlights} không còn trong văn bản)` : ""}</p>
        </section>
        <section className="grid gap-3 rounded-2xl border-2 bg-card p-5">
          <h2 className="text-base font-semibold">Thêm tag mới</h2>
          <NewTagForm />
        </section>
        <section className="grid gap-3 rounded-2xl border-2 border-destructive/30 bg-card p-5">
          <h2 className="text-base font-semibold">Xóa tác phẩm</h2>
          <p className="text-sm text-muted-foreground">
            {used > 0 || work.status !== "DRAFT"
              ? "Chỉ xóa được tác phẩm nháp chưa có học sinh dùng. Muốn ẩn tác phẩm, hãy chuyển trạng thái về Nháp."
              : "Tác phẩm nháp, chưa ai dùng: xóa được hẳn."}
          </p>
          <DeleteWorkForm id={work.id} title={work.title} disabled={used > 0 || work.status !== "DRAFT"} />
        </section>
      </aside>
    </div>
  );
}
