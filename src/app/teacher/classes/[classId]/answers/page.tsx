import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageSkeleton } from "@/components/app-shell";
import { Mascot } from "@/components/mascot/mascot";
import { AnswerCard } from "@/components/teacher/answer-card";
import { cn } from "@/lib/utils";
import { ANSWER_FILTERS, listClassAnswers, type AnswerFilter } from "@/server/services/teacher";
import { loadForTeacher } from "../load";

export const metadata: Metadata = { title: "Câu trả lời" };

const FILTER_LABEL: Record<AnswerFilter, string> = {
  all: "Gần đây",
  flagged: "Hết 3 lượt",
  "chua-dat": "Chưa đạt",
  reviewed: "Đã chỉnh",
};

export default function ClassAnswersPage({ params, searchParams }: PageProps<"/teacher/classes/[classId]/answers">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Answers params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Answers({ params, searchParams }: PageProps<"/teacher/classes/[classId]/answers">) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const filter = ANSWER_FILTERS.find((f) => f === query.filter) ?? "all";
  const answers = await loadForTeacher((user) => listClassAnswers(user, classId, filter));

  return (
    <section className="grid gap-4" aria-labelledby="answers-heading">
      <div className="grid gap-1">
        <h2 id="answers-heading" className="text-2xl font-semibold">
          Câu trả lời được AI nhận xét
        </h2>
        <p className="text-sm text-muted-foreground">
          Tự luận ngắn và đoạn cảm nhận của học sinh trong lớp. Bạn có thể chỉnh mức (điểm được tính lại), viết nhận xét, ẩn nhận
          xét AI không phù hợp hoặc báo admin xem lại rubric.
        </p>
      </div>
      <nav aria-label="Lọc câu trả lời" className="flex flex-wrap gap-2">
        {ANSWER_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? `/teacher/classes/${classId}/answers` : `/teacher/classes/${classId}/answers?filter=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors hover:bg-muted",
              f === filter && "border-primary bg-primary/10 text-foreground hover:bg-primary/10",
            )}
          >
            {FILTER_LABEL[f]}
          </Link>
        ))}
      </nav>
      {answers.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center">
          <Mascot pose="sleep" size={96} label="" />
          <p className="font-bold">Chưa có câu trả lời nào ở mục này</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {answers.map((a) => (
            <AnswerCard key={a.id} answer={a} classId={classId} />
          ))}
        </div>
      )}
    </section>
  );
}
