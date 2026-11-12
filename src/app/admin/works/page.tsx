import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import type { WorkStatus } from "@/generated/prisma/enums";
import { PageSkeleton } from "@/components/app-shell";
import { NewWorkForm } from "@/components/admin/new-work-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { GENRE_LABEL } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/vn-date";
import { requireUser } from "@/server/auth/dal";
import { STATUS_LABEL, listAdminWorks } from "@/server/services/admin/works";

export const metadata: Metadata = { title: "Tác phẩm" };

const STATUSES = ["DRAFT", "PUBLISHED", "COMING_SOON"] as const satisfies readonly WorkStatus[];

export default function AdminWorksPage({ searchParams }: PageProps<"/admin/works">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Works searchParams={searchParams} />
    </Suspense>
  );
}

async function Works({ searchParams }: Pick<PageProps<"/admin/works">, "searchParams">) {
  const user = await requireUser("ADMIN");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const status = STATUSES.find((s) => s === query.status);
  const works = await listAdminWorks(user, { q, status });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section className="grid min-w-0 gap-4" aria-labelledby="works-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 id="works-heading" className="text-2xl font-semibold">
            Tác phẩm ({works.length})
          </h1>
        </div>
        <form className="flex flex-wrap gap-2" role="search">
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Tìm theo tên hoặc tác giả</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Tìm theo tên hoặc tác giả"
              className="h-10 w-full rounded-xl border-2 bg-background pr-3 pl-9 text-sm"
            />
          </label>
          {status ? <input type="hidden" name="status" value={status} /> : null}
        </form>
        <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
          {[undefined, ...STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={`/admin/works?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) })}`}
              aria-current={s === status ? "page" : undefined}
              className={cn(
                "rounded-full border-2 px-3 py-1 text-sm font-bold hover:bg-muted",
                s === status && "border-primary bg-primary/10 hover:bg-primary/10",
              )}
            >
              {s ? STATUS_LABEL[s] : "Tất cả"}
            </Link>
          ))}
        </nav>
        <div className="overflow-x-auto rounded-2xl border-2 bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b-2">
                <th className="px-4 py-3 font-bold">Tác phẩm</th>
                <th className="px-2 py-3 font-bold">Thể loại</th>
                <th className="px-2 py-3 font-bold">Trạng thái</th>
                <th className="px-2 py-3 text-right font-bold">Phân đoạn</th>
                <th className="px-2 py-3 text-right font-bold">Câu hỏi</th>
                <th className="px-2 py-3 font-bold">Sửa lúc</th>
                <th className="w-8" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id} className="relative border-t hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/works/${w.id}`} className="font-bold after:absolute after:inset-0 hover:underline">
                      {w.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{w.author}</p>
                  </td>
                  <td className="px-2 py-2.5">{GENRE_LABEL[w.genre]}</td>
                  <td className="px-2 py-2.5">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{w.segments}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{w.questions}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">{formatDayMonth(w.updatedAt)}</td>
                  <td className="pr-3">
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </td>
                </tr>
              ))}
              {works.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Không có tác phẩm nào khớp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="grid gap-3 rounded-2xl border-2 bg-card p-5" aria-labelledby="new-work-heading">
        <h2 id="new-work-heading" className="text-lg font-semibold">
          Thêm tác phẩm
        </h2>
        <p className="text-sm text-muted-foreground">Tác phẩm mới ở trạng thái Nháp. Nhập văn bản, soạn câu hỏi rồi mới xuất bản.</p>
        <NewWorkForm />
      </aside>
    </div>
  );
}
