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
  const { seg } = await searchParams;
  const data = await getReader(user, slug);
  if (!data || data.segments.length === 0) notFound();
  return <Reader data={data} startAt={typeof seg === "string" ? seg : undefined} />;
}
