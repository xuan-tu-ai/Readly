import { Suspense } from "react";
import type { Metadata } from "next";
import type { QuestionStage } from "@/generated/prisma/enums";
import { PageSkeleton } from "@/components/app-shell";
import { AiQuestionDrafts, NewQuestion, QuestionRow, type QuestionRowData } from "@/components/admin/question-editor";
import { STAGE_LABEL } from "@/lib/content/labels";
import type { QuestionInput } from "@/lib/content/schemas";
import { listWorkQuestions, type AdminQuestion } from "@/server/services/admin/questions";
import { segmentOptions } from "@/server/services/admin/works";
import { loadForAdmin } from "../load";

export const metadata: Metadata = { title: "Câu hỏi" };

export default function QuestionsPage({ params }: PageProps<"/admin/works/[id]/questions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Questions params={params} />
    </Suspense>
  );
}

function toInput(q: AdminQuestion): QuestionInput {
  return {
    stage: q.stage,
    type: q.type,
    segmentId: q.segmentId,
    prompt: q.prompt,
    required: q.required,
    options: q.type === "MCQ" ? [...q.options.map((o) => o.text), "", "", "", ""].slice(0, Math.max(4, q.options.length)) : ["", "", "", ""],
    correctIndex: Math.max(0, q.options.findIndex((o) => o.id === q.correctOptionId)),
    explanation: q.explanation,
    rubricChuaDat: q.rubric?.chuaDat ?? null,
    rubricDat: q.rubric?.dat ?? null,
    rubricSauSac: q.rubric?.sauSac ?? null,
    keyPoints: q.keyPoints,
    outline: q.outline,
    minWords: q.minWords,
    maxWords: q.maxWords,
  };
}

function summary(q: AdminQuestion): string | null {
  if (q.type === "MCQ") return q.options.map((o) => `${o.id === q.correctOptionId ? "✓ " : ""}${o.text}`).join(" · ");
  if (q.type === "SHORT" || q.type === "ESSAY") return q.keyPoints.length ? `Ý chính: ${q.keyPoints.join("; ")}` : null;
  return null;
}

async function Questions({ params }: Pick<PageProps<"/admin/works/[id]/questions">, "params">) {
  const { id } = await params;
  const [questions, segments] = await Promise.all([loadForAdmin((user) => listWorkQuestions(user, id)), segmentOptions(id)]);
  const choices = segments.map((s) => ({ id: s.id, label: s.title ?? `Phần ${s.order}` }));
  const rows: (QuestionRowData & { archived: boolean })[] = questions.map((q) => ({
    id: q.id,
    input: toInput(q),
    stage: q.stage,
    type: q.type,
    prompt: q.prompt,
    required: q.required,
    segmentLabel: q.segment ? `${q.segment.title ?? `Phần ${q.segment.order}`}${q.segment.archivedAt ? " (đã lưu trữ)" : ""}` : null,
    answers: q.answers,
    summary: summary(q),
    archived: Boolean(q.segment?.archivedAt),
  }));

  return (
    <div className="grid gap-6">
      <AiQuestionDrafts workId={id} disabled={segments.length === 0} />
      {(["PRE", "DURING", "POST"] as QuestionStage[]).map((stage) => {
        const list = rows.filter((r) => r.stage === stage);
        return (
          <section key={stage} className="grid gap-2" aria-labelledby={`stage-${stage}`}>
            <h2 id={`stage-${stage}`} className="text-lg font-semibold">
              {STAGE_LABEL[stage]} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
            </h2>
            {list.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có câu hỏi.</p> : null}
            {list.map((r) => (
              <QuestionRow key={r.id} workId={id} row={r} segments={choices} />
            ))}
          </section>
        );
      })}
      {segments.length > 0 ? <NewQuestion workId={id} segments={choices} /> : null}
    </div>
  );
}
