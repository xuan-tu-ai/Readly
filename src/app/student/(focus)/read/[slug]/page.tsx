import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { Reader } from "@/components/reader/reader";
import { requireUser } from "@/server/auth/dal";
import { getReader } from "@/server/services/reading";

export const metadata: Metadata = { title: "Đọc" };

export default function ReadPage({ params, searchParams }: PageProps<"/student/read/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReadWork params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ReadWork({ params, searchParams }: PageProps<"/student/read/[slug]">) {
  const user = await requireUser("STUDENT");
  const { slug } = await params;
  const { seg, q } = await searchParams;
  const data = await getReader(user, slug);
  if (!data || data.segments.length === 0) notFound();
  const startAt = typeof seg === "string" ? seg : undefined;
  // "?q=start-end" marks a quoted passage (from the discussion) inside that segment.
  const range = typeof q === "string" ? /^(\d+)-(\d+)$/.exec(q) : null;
  const focus =
    startAt && range && Number(range[1]) < Number(range[2])
      ? { segmentId: startAt, start: Number(range[1]), end: Number(range[2]) }
      : undefined;
  // A new target in the URL starts a fresh reader: a kept-alive one would restore its old place.
  return <Reader key={`${startAt ?? ""}|${focus ? `${focus.start}-${focus.end}` : ""}`} data={data} startAt={startAt} focus={focus} />;
}
