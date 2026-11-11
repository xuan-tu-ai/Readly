import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { QUIZ } from "@/lib/quiz";
import { requireUser } from "@/server/auth/dal";
import { QuizForm } from "./quiz-form";

export const metadata: Metadata = { title: "Bài test sở thích" };

export default function QuizPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Bài test sở thích</h1>
        <p className="text-muted-foreground">{QUIZ.length} câu hỏi nhanh để tìm tác phẩm hợp với bạn. Làm lại bất cứ lúc nào.</p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Quiz />
      </Suspense>
    </div>
  );
}

async function Quiz() {
  await requireUser("STUDENT");
  return <QuizForm questions={QUIZ} />;
}
