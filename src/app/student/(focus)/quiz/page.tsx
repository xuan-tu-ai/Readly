import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { QUIZ } from "@/lib/quiz";
import { requireUser } from "@/server/auth/dal";
import { QuizForm } from "./quiz-form";

export const metadata: Metadata = { title: "Bài test sở thích" };

export default function QuizPage({ searchParams }: PageProps<"/student/quiz">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Quiz searchParams={searchParams} />
    </Suspense>
  );
}

async function Quiz({ searchParams }: Pick<PageProps<"/student/quiz">, "searchParams">) {
  const user = await requireUser("STUDENT");
  const { welcome } = await searchParams;
  const firstName = user.name.trim().split(/\s+/).at(-1) ?? user.name;
  return <QuizForm questions={QUIZ} welcomeName={welcome ? firstName : null} />;
}
