import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { WorkTabs } from "@/components/admin/work-tabs";
import { GENRE_LABEL } from "@/lib/catalog";
import { requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";

/** Header and tabs of the work editor. */
export default function WorkEditorLayout({ children, params }: LayoutProps<"/admin/works/[id]">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-muted" />}>
        <Header params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function Header({ params }: Pick<LayoutProps<"/admin/works/[id]">, "params">) {
  await requireUser("ADMIN");
  const { id } = await params;
  const work = await db.work.findUnique({ where: { id }, select: { id: true, slug: true, title: true, author: true, genre: true, status: true } });
  if (!work) notFound();
  return (
    <header className="grid gap-4">
      <div>
        <Link href="/admin/works" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground uppercase hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Tất cả tác phẩm
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-heading text-3xl font-semibold">{work.title}</h1>
          <StatusBadge status={work.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {work.author} · {GENRE_LABEL[work.genre]} · <span className="font-mono">/{work.slug}</span>
        </p>
      </div>
      <WorkTabs workId={work.id} />
    </header>
  );
}
