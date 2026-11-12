import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { ImportWizard } from "@/components/admin/import-wizard";
import { getAdminWork } from "@/server/services/admin/works";
import { loadForAdmin } from "../load";

export const metadata: Metadata = { title: "Nhập văn bản" };

export default function ImportPage({ params }: PageProps<"/admin/works/[id]/import">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Import params={params} />
    </Suspense>
  );
}

async function Import({ params }: Pick<PageProps<"/admin/works/[id]/import">, "params">) {
  const { id } = await params;
  const work = await loadForAdmin((user) => getAdminWork(user, id));
  return (
    <div className="grid gap-4">
      <Link href={`/admin/works/${id}/text`} className="inline-flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground uppercase hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Văn bản
      </Link>
      <ImportWizard workId={work.id} genre={work.genre} existingSegments={work.segments.length} />
    </div>
  );
}
