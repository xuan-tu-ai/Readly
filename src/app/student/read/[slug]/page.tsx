import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { Reader } from "@/components/reader/reader";
import { requireUser } from "@/server/auth/dal";
import { getReader } from "@/server/services/reading";

export const metadata: Metadata = { title: "Đọc" };

export default function ReadPage({ params }: PageProps<"/student/read/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReadWork params={params} />
    </Suspense>
  );
}

async function ReadWork({ params }: Pick<PageProps<"/student/read/[slug]">, "params">) {
  const user = await requireUser("STUDENT");
  const { slug } = await params;
  const data = await getReader(user, slug);
  if (!data || data.segments.length === 0) notFound();
  return <Reader data={data} />;
}
