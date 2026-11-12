import type { Prisma } from "@/generated/prisma/client";
import { getAiProvider } from "@/lib/ai";
import { buildDraftQuestionsRequest, buildDraftRubricRequest, type DraftQuestion } from "@/lib/ai/drafts";
import type { QuestionInput } from "@/lib/content/schemas";
import { htmlToText } from "@/lib/reading/html-text";
import { mcqOptionsSchema, rubricSchema } from "@/lib/questions/rules";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";

/** Admin: authoring the three reading stages' questions (spec §3.1, §13). */

const OPTION_IDS = ["a", "b", "c", "d", "e"];

export async function listWorkQuestions(actor: Actor, workId: string) {
  assertRole(actor, "ADMIN");
  const questions = await db.question.findMany({
    where: { workId },
    orderBy: [{ stage: "asc" }, { segment: { order: "asc" } }, { order: "asc" }],
    include: { segment: { select: { id: true, order: true, title: true, archivedAt: true } }, _count: { select: { answers: true } } },
  });
  return questions.map(({ _count, ...q }) => {
    const options = mcqOptionsSchema.safeParse(q.options);
    const rubric = rubricSchema.safeParse(q.rubric);
    return {
      ...q,
      options: options.success ? options.data : [],
      rubric: rubric.success ? rubric.data : null,
      answers: _count.answers,
    };
  });
}

export type AdminQuestion = Awaited<ReturnType<typeof listWorkQuestions>>[number];

async function assertSegmentOf(workId: string, segmentId: string | null | undefined) {
  if (!segmentId) return null;
  const segment = await db.segment.findFirst({ where: { id: segmentId, workId, archivedAt: null }, select: { id: true } });
  if (!segment) throw new DomainError("INVALID_INPUT", "Phân đoạn không thuộc tác phẩm này.");
  return segment.id;
}

/** Form input → database columns (only the fields that matter for the type). */
function toColumns(input: QuestionInput) {
  const options = input.options.map((o) => o.trim()).filter(Boolean);
  const mcq = input.type === "MCQ";
  const open = input.type === "SHORT" || input.type === "ESSAY";
  const correct = mcq && input.correctIndex !== null && input.correctIndex !== undefined ? input.options[input.correctIndex]?.trim() : null;
  return {
    stage: input.stage,
    type: input.type,
    prompt: input.prompt,
    required: input.type === "PREDICTION" ? false : input.required,
    options: mcq ? (options.map((text, i) => ({ id: OPTION_IDS[i], text })) as Prisma.InputJsonValue) : undefined,
    correctOptionId: mcq && correct ? OPTION_IDS[options.indexOf(correct)] : null,
    explanation: mcq ? input.explanation ?? null : null,
    rubric: open ? ({ chuaDat: input.rubricChuaDat!, dat: input.rubricDat!, sauSac: input.rubricSauSac! } as Prisma.InputJsonValue) : undefined,
    keyPoints: open ? input.keyPoints.map((k) => k.trim()).filter(Boolean) : [],
    outline: input.type === "ESSAY" ? input.outline ?? null : null,
    minWords: input.type === "ESSAY" ? input.minWords ?? null : null,
    maxWords: input.type === "ESSAY" ? input.maxWords ?? null : null,
  };
}

export async function createQuestion(actor: Actor, workId: string, input: QuestionInput) {
  assertRole(actor, "ADMIN");
  if (!(await db.work.findUnique({ where: { id: workId }, select: { id: true } }))) notFound("Không tìm thấy tác phẩm.");
  const segmentId = input.stage === "DURING" ? await assertSegmentOf(workId, input.segmentId) : null;
  const last = await db.question.findFirst({
    where: { workId, stage: input.stage, segmentId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return db.question.create({ data: { workId, segmentId, order: (last?.order ?? -1) + 1, ...toColumns(input) }, select: { id: true } });
}

export async function updateQuestion(actor: Actor, questionId: string, input: QuestionInput) {
  assertRole(actor, "ADMIN");
  const question = await db.question.findUnique({ where: { id: questionId }, select: { workId: true, type: true, _count: { select: { answers: true } } } });
  if (!question) notFound("Không tìm thấy câu hỏi.");
  if (question._count.answers > 0 && question.type !== input.type) {
    throw new DomainError("INVALID_INPUT", "Câu hỏi đã có học sinh trả lời nên không đổi loại được. Hãy tạo câu mới.");
  }
  const segmentId = input.stage === "DURING" ? await assertSegmentOf(question.workId, input.segmentId) : null;
  await db.question.update({ where: { id: questionId }, data: { segmentId, ...toColumns(input) } });
}

/** Deleting would erase students' answers and points; such questions are made optional instead. */
export async function deleteQuestion(actor: Actor, questionId: string) {
  assertRole(actor, "ADMIN");
  const question = await db.question.findUnique({ where: { id: questionId }, select: { _count: { select: { answers: true } } } });
  if (!question) notFound("Không tìm thấy câu hỏi.");
  if (question._count.answers > 0) {
    throw new DomainError("INVALID_INPUT", "Câu hỏi đã có học sinh trả lời, không xóa được. Bỏ đánh dấu “bắt buộc” nếu muốn thôi dùng.");
  }
  await db.question.delete({ where: { id: questionId } });
}

// ───────────────────────── AI drafts ─────────────────────────

async function workText(workId: string) {
  const work = await db.work.findUnique({
    where: { id: workId },
    select: { title: true, author: true, segments: { where: { archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, order: true, title: true, content: true } } },
  });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  if (work.segments.length === 0) throw new DomainError("INVALID_INPUT", "Tác phẩm chưa có văn bản để AI đọc.");
  return {
    ...work,
    segments: work.segments.map((s) => ({ id: s.id, order: s.order, title: s.title ?? `Phần ${s.order}`, text: htmlToText(s.content).trim() })),
  };
}

function aiFailure(error: unknown): never {
  console.error("[ai-draft]", error);
  throw new DomainError("INVALID_INPUT", "AI chưa soạn được lúc này (mạng hoặc hạn mức). Thử lại sau ít phút.");
}

/** Drafts a full question set; nothing is saved until the admin picks what to keep. */
export async function draftQuestions(actor: Actor, workId: string): Promise<DraftQuestion[]> {
  assertRole(actor, "ADMIN");
  const work = await workText(workId);
  const result = await getAiProvider()
    .generateStructured(buildDraftQuestionsRequest({ title: work.title, author: work.author, segments: work.segments }))
    .catch(aiFailure);
  const orders = new Set(work.segments.map((s) => s.order));
  // Drop drafts the model attached to a segment that does not exist.
  return result.questions.filter((q) => q.stage !== "DURING" || (q.segment !== null && orders.has(q.segment)));
}

/** Saves the drafts the admin selected (after their edits), mapping segment numbers to ids. */
export async function addDraftQuestions(actor: Actor, workId: string, drafts: QuestionInput[]) {
  assertRole(actor, "ADMIN");
  let created = 0;
  for (const draft of drafts) {
    await createQuestion(actor, workId, draft);
    created++;
  }
  return created;
}

export function draftToInput(draft: DraftQuestion, segmentIdByOrder: Map<number, string>): QuestionInput {
  return {
    stage: draft.stage,
    type: draft.type,
    segmentId: draft.segment ? segmentIdByOrder.get(draft.segment) ?? null : null,
    prompt: draft.prompt,
    required: draft.type !== "PREDICTION",
    options: draft.options ?? [],
    correctIndex: draft.correctIndex,
    explanation: draft.explanation,
    rubricChuaDat: draft.rubric?.chuaDat ?? null,
    rubricDat: draft.rubric?.dat ?? null,
    rubricSauSac: draft.rubric?.sauSac ?? null,
    keyPoints: draft.keyPoints ?? [],
    outline: draft.outline,
    minWords: null,
    maxWords: null,
  };
}

/** Rubric + key points for one open question, from the segment (or the whole work). */
export async function draftRubric(actor: Actor, input: { workId: string; segmentId?: string | null; type: "SHORT" | "ESSAY"; prompt: string }) {
  assertRole(actor, "ADMIN");
  const work = await workText(input.workId);
  const segment = input.segmentId ? work.segments.find((s) => s.id === input.segmentId) : null;
  const sourceText = segment ? segment.text : work.segments.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  return getAiProvider()
    .generateStructured(buildDraftRubricRequest({ type: input.type, prompt: input.prompt, sourceText }))
    .catch(aiFailure);
}
