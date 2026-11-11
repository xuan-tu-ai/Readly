import type { Prisma } from "@/generated/prisma/client";
import type { AnswerLevel, QuestionStage, QuestionType } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/roles";
import { getAiProvider } from "@/lib/ai";
import { htmlToText } from "@/lib/reading/html-text";
import {
  isResolved,
  isWorkComplete,
  mcqOptionsSchema,
  questionState,
  rubricSchema,
  validateAnswerContent,
  type McqOption,
  type QuestionState,
} from "@/lib/questions/rules";
import { db } from "@/server/db";
import { assertRole } from "@/server/authz";
import { DomainError, notFound } from "@/server/errors";
import { emit } from "@/server/events";
import { buildGradingRequest, buildPredictionRequest } from "@/server/grading/prompts";
import { QUEUES, enqueue } from "@/server/queue";

// ───────────────────────── Reader view ─────────────────────────

const answerSelect = {
  id: true,
  attempt: true,
  content: true,
  status: true,
  level: true,
  isCorrect: true,
  strengths: true,
  improvements: true,
  feedback: true,
  aiHidden: true,
  teacherLevel: true,
  teacherNote: true,
  submittedAt: true,
} satisfies Prisma.AnswerSelect;

type AnswerRow = Prisma.AnswerGetPayload<{ select: typeof answerSelect }>;

/** What the student may see of an answer (AI text hidden if the teacher hid it). */
function toAnswerView(a: AnswerRow) {
  return {
    id: a.id,
    attempt: a.attempt,
    content: a.content,
    status: a.status,
    level: a.teacherLevel ?? a.level,
    isCorrect: a.isCorrect,
    strengths: a.aiHidden ? null : a.strengths,
    improvements: a.aiHidden ? null : a.improvements,
    feedback: a.aiHidden ? null : a.feedback,
    teacherNote: a.teacherNote,
    submittedAt: a.submittedAt,
  };
}

export type AnswerView = ReturnType<typeof toAnswerView>;

export type QuestionView = {
  id: string;
  stage: QuestionStage;
  type: QuestionType;
  segmentId: string | null;
  prompt: string;
  required: boolean;
  options: McqOption[] | null;
  outline: string | null;
  minWords: number | null;
  maxWords: number | null;
  /** Revealed only once the MCQ is resolved. */
  correctOptionId: string | null;
  explanation: string | null;
  answers: AnswerView[];
  state: QuestionState;
};

const questionSelect = {
  id: true,
  stage: true,
  type: true,
  segmentId: true,
  prompt: true,
  required: true,
  options: true,
  correctOptionId: true,
  explanation: true,
  outline: true,
  minWords: true,
  maxWords: true,
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionSelect }>;

function toQuestionView(q: QuestionRow, answers: AnswerRow[]): QuestionView {
  const state = questionState(q.type, answers);
  const resolved = state.status === "passed" || state.status === "exhausted";
  const options = q.type === "MCQ" ? mcqOptionsSchema.safeParse(q.options) : null;
  return {
    id: q.id,
    stage: q.stage,
    type: q.type,
    segmentId: q.segmentId,
    prompt: q.prompt,
    required: q.required,
    options: options?.success ? options.data : null,
    outline: q.outline,
    minWords: q.minWords,
    maxWords: q.maxWords,
    correctOptionId: q.type === "MCQ" && resolved ? q.correctOptionId : null,
    explanation: q.type === "MCQ" && resolved ? q.explanation : null,
    answers: answers.map(toAnswerView),
    state,
  };
}

/** Throws NOT_FOUND unless the work is published (students never see drafts). */
export async function assertReadableWork(workId: string) {
  const work = await db.work.findFirst({ where: { id: workId, status: "PUBLISHED" }, select: { id: true } });
  if (!work) notFound("Không tìm thấy tác phẩm.");
}

/** Questions of a work (in reading order) with this student's answers and state. */
export async function getQuestionsForReader(userId: string, workId: string): Promise<QuestionView[]> {
  const questions = await db.question.findMany({
    where: { workId, OR: [{ segmentId: null }, { segment: { archivedAt: null } }] },
    orderBy: [{ stage: "asc" }, { segment: { order: "asc" } }, { order: "asc" }],
    select: { ...questionSelect, answers: { where: { userId }, orderBy: { attempt: "asc" }, select: answerSelect } },
  });
  return questions.map(({ answers, ...q }) => toQuestionView(q, answers));
}

export async function getQuestionView(userId: string, questionId: string): Promise<QuestionView> {
  const q = await db.question.findUniqueOrThrow({
    where: { id: questionId },
    select: { ...questionSelect, answers: { where: { userId }, orderBy: { attempt: "asc" }, select: answerSelect } },
  });
  const { answers, ...rest } = q;
  return toQuestionView(rest, answers);
}

// ───────────────────────── Submitting ─────────────────────────

/**
 * A student submits an answer. MCQ and predictions are settled immediately;
 * SHORT/ESSAY answers are stored as PENDING and graded by the worker.
 */
export async function submitAnswer(actor: Actor, questionId: string, rawContent: string): Promise<QuestionView> {
  assertRole(actor, "STUDENT");
  const question = await db.question.findFirst({
    where: { id: questionId, work: { status: "PUBLISHED" } },
    select: {
      id: true,
      workId: true,
      type: true,
      options: true,
      correctOptionId: true,
      minWords: true,
      maxWords: true,
      answers: { where: { userId: actor.id }, select: { attempt: true, status: true, level: true, teacherLevel: true } },
    },
  });
  if (!question) notFound("Không tìm thấy câu hỏi.");

  const state = questionState(question.type, question.answers);
  if (!state.canSubmit) {
    const message =
      state.status === "pending"
        ? "Câu trả lời trước đang chờ nhận xét."
        : state.status === "answered"
          ? "Bạn đã trả lời câu này."
          : "Câu hỏi này đã hoàn tất.";
    throw new DomainError("FORBIDDEN", message);
  }
  const error = validateAnswerContent(question, rawContent);
  if (error) throw new DomainError("FORBIDDEN", error);

  const content = rawContent.trim();
  const attempt = Math.max(0, ...question.answers.map((a) => a.attempt)) + 1;
  const base = { questionId, userId: actor.id, attempt, content };

  if (question.type === "MCQ") {
    const isCorrect = content === question.correctOptionId;
    await db.answer.create({
      data: { ...base, status: "GRADED", isCorrect, level: isCorrect ? "DAT" : "CHUA_DAT", gradedAt: new Date() },
    });
    await afterGraded(actor.id, question.workId, questionId);
  } else if (question.type === "PREDICTION") {
    await db.answer.create({ data: { ...base, status: "GRADED", gradedAt: new Date() } });
    await refreshCompletion(actor.id, question.workId);
  } else {
    const answer = await db.answer.create({ data: { ...base, status: "PENDING" }, select: { id: true } });
    await enqueue(QUEUES.gradeAnswer, { answerId: answer.id });
  }
  return getQuestionView(actor.id, questionId);
}

async function afterGraded(userId: string, workId: string, questionId: string, answerId?: string) {
  if (answerId) await emit({ type: "AnswerGraded", userId, answerId, questionId, workId });
  await refreshCompletion(userId, workId);
}

// ───────────────────────── Completion ─────────────────────────

export async function getCompletionStatus(userId: string, workId: string) {
  const [segments, readSegments, questions, completion] = await Promise.all([
    db.segment.count({ where: { workId, archivedAt: null } }),
    db.segmentRead.count({ where: { userId, segment: { workId, archivedAt: null } } }),
    db.question.findMany({
      where: { workId, required: true, OR: [{ segmentId: null }, { segment: { archivedAt: null } }] },
      select: {
        type: true,
        answers: { where: { userId }, select: { attempt: true, status: true, level: true, teacherLevel: true } },
      },
    }),
    db.workCompletion.findUnique({ where: { userId_workId: { userId, workId } }, select: { completedAt: true } }),
  ]);
  const requiredStates = questions.map((q) => questionState(q.type, q.answers));
  return {
    totalSegments: segments,
    readSegments,
    owedQuestions: requiredStates.filter((s) => !isResolved(s)).length,
    complete: isWorkComplete({ totalSegments: segments, readSegments, requiredStates }),
    completedAt: completion?.completedAt ?? null,
  };
}

/**
 * Records completion the first time the conditions hold. Completion is never
 * revoked (e.g. if a teacher later lowers a level), to keep points stable.
 */
export async function refreshCompletion(userId: string, workId: string): Promise<boolean> {
  const status = await getCompletionStatus(userId, workId);
  if (status.completedAt || !status.complete) return false;

  const { count } = await db.workCompletion.createMany({ data: [{ userId, workId }], skipDuplicates: true });
  if (count === 0) return false;

  const prediction = await db.answer.findFirst({
    where: { userId, question: { workId, type: "PREDICTION" }, feedback: null },
    select: { id: true },
  });
  if (prediction) await enqueue(QUEUES.comparePrediction, { answerId: prediction.id });
  await emit({ type: "WorkCompleted", userId, workId });
  return true;
}

// ───────────────────────── Worker jobs ─────────────────────────

/** Text the model grades against: the question's segment, or the whole work for PRE/POST. */
async function sourceTextFor(workId: string, segmentId: string | null): Promise<string> {
  const segments = await db.segment.findMany({
    where: segmentId ? { id: segmentId } : { workId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { title: true, content: true },
  });
  return segments.map((s) => `${s.title ? `${s.title}\n` : ""}${htmlToText(s.content)}`).join("\n");
}

/** Job: grade one PENDING answer. Idempotent; AI errors throw so pg-boss retries. */
export async function gradeAnswerJob(answerId: string) {
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      userId: true,
      content: true,
      status: true,
      question: {
        select: { id: true, workId: true, segmentId: true, type: true, prompt: true, rubric: true, keyPoints: true, outline: true },
      },
    },
  });
  if (!answer || answer.status !== "PENDING") return { skipped: true };
  const { question } = answer;
  if (question.type !== "SHORT" && question.type !== "ESSAY") return { skipped: true };

  const rubric = rubricSchema.safeParse(question.rubric);
  const request = buildGradingRequest({
    type: question.type,
    prompt: question.prompt,
    rubric: rubric.success ? rubric.data : null,
    keyPoints: question.keyPoints,
    outline: question.outline,
    sourceText: await sourceTextFor(question.workId, question.segmentId),
    answer: answer.content,
  });
  const result = await getAiProvider().generateStructured(request);

  const { count } = await db.answer.updateMany({
    where: { id: answer.id, status: "PENDING" },
    data: {
      status: "GRADED",
      level: result.level as AnswerLevel,
      strengths: result.strengths,
      improvements: result.improvements || null,
      gradedAt: new Date(),
    },
  });
  if (count > 0) await afterGraded(answer.userId, question.workId, question.id, answer.id);
  return { level: result.level };
}

/** Dead-letter job: grading kept failing. The student may submit again (failed runs are free). */
export async function markGradingFailedJob(answerId: string) {
  await db.answer.updateMany({ where: { id: answerId, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Job: after completion, the AI compares the student's prediction with the work. */
export async function comparePredictionJob(answerId: string) {
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    select: { id: true, content: true, feedback: true, question: { select: { workId: true, prompt: true, type: true } } },
  });
  if (!answer || answer.feedback || answer.question.type !== "PREDICTION") return { skipped: true };
  const result = await getAiProvider().generateStructured(
    buildPredictionRequest({
      prompt: answer.question.prompt,
      prediction: answer.content,
      sourceText: await sourceTextFor(answer.question.workId, null),
    }),
  );
  await db.answer.update({ where: { id: answer.id }, data: { feedback: result.feedback } });
  return { ok: true };
}
