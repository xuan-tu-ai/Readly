import { z } from "zod";
import type { AnswerLevel, AnswerStatus, QuestionType } from "@/generated/prisma/enums";

/**
 * Pure rules for questions and answers (spec §6.3, §9). No database here, so
 * every rule is unit-tested.
 */

export const MAX_ATTEMPTS = 3;
export const SHORT_MAX_CHARS = 1000;
export const DEFAULT_ESSAY_WORDS = { min: 150, max: 300 };

export const LEVEL_LABEL: Record<AnswerLevel, string> = {
  CHUA_DAT: "Chưa đạt",
  DAT: "Đạt",
  SAU_SAC: "Sâu sắc",
};

const LEVEL_RANK: Record<AnswerLevel, number> = { CHUA_DAT: 0, DAT: 1, SAU_SAC: 2 };

export type AnswerLike = {
  attempt: number;
  status: AnswerStatus;
  level: AnswerLevel | null;
  teacherLevel?: AnswerLevel | null;
};

/** A teacher's override wins over the AI's level. */
export function effectiveLevel(answer: Pick<AnswerLike, "level" | "teacherLevel">): AnswerLevel | null {
  return answer.teacherLevel ?? answer.level;
}

export function isPassing(level: AnswerLevel | null): boolean {
  return level !== null && LEVEL_RANK[level] >= LEVEL_RANK.DAT;
}

export type QuestionStatus =
  | "unanswered"
  | "pending" // waiting for AI
  | "retry" // graded Chưa đạt, attempts left
  | "passed" // Đạt / Sâu sắc / correct MCQ
  | "exhausted" // 3 graded attempts, none passing – unlocked, no points, flagged
  | "answered"; // prediction submitted (never graded)

export type QuestionState = {
  status: QuestionStatus;
  /** GRADED submissions only – pending and failed ones are free. */
  attemptsUsed: number;
  attemptsLeft: number;
  canSubmit: boolean;
  /** True when the 3 attempts ran out without passing (teacher sees a flag). */
  flagged: boolean;
};

export function questionState(type: QuestionType, answers: AnswerLike[]): QuestionState {
  const sorted = [...answers].sort((a, b) => a.attempt - b.attempt);
  const graded = sorted.filter((a) => a.status === "GRADED");
  const attemptsUsed = graded.length;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
  const pending = sorted.some((a) => a.status === "PENDING");

  if (type === "PREDICTION") {
    const answered = graded.length > 0;
    return { status: answered ? "answered" : "unanswered", attemptsUsed, attemptsLeft: answered ? 0 : 1, canSubmit: !answered, flagged: false };
  }

  const passed = graded.some((a) => isPassing(effectiveLevel(a)));
  let status: QuestionStatus;
  if (passed) status = "passed";
  else if (pending) status = "pending";
  else if (attemptsUsed >= MAX_ATTEMPTS) status = "exhausted";
  else if (attemptsUsed > 0) status = "retry";
  else status = "unanswered";

  return {
    status,
    attemptsUsed,
    attemptsLeft,
    canSubmit: status === "unanswered" || status === "retry",
    flagged: status === "exhausted",
  };
}

/** Required questions no longer block completion once passed or out of attempts. */
export function isResolved(state: QuestionState): boolean {
  return state.status === "passed" || state.status === "exhausted" || state.status === "answered";
}

export function isWorkComplete(input: {
  totalSegments: number;
  readSegments: number;
  requiredStates: QuestionState[];
}): boolean {
  return (
    input.totalSegments > 0 &&
    input.readSegments >= input.totalSegments &&
    input.requiredStates.every(isResolved)
  );
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export const mcqOptionsSchema = z.array(z.object({ id: z.string(), text: z.string() })).min(2);
export type McqOption = z.infer<typeof mcqOptionsSchema>[number];

export const rubricSchema = z.object({ chuaDat: z.string(), dat: z.string(), sauSac: z.string() });
export type Rubric = z.infer<typeof rubricSchema>;

type ValidatableQuestion = {
  type: QuestionType;
  options: unknown;
  minWords: number | null;
  maxWords: number | null;
};

/** Returns a Vietnamese error message, or null if the content is acceptable. */
export function validateAnswerContent(question: ValidatableQuestion, raw: string): string | null {
  const content = raw.trim();
  switch (question.type) {
    case "MCQ": {
      const options = mcqOptionsSchema.safeParse(question.options);
      return options.success && options.data.some((o) => o.id === content) ? null : "Vui lòng chọn một đáp án.";
    }
    case "PREDICTION":
    case "SHORT":
      if (!content) return "Vui lòng nhập câu trả lời.";
      if (content.length > SHORT_MAX_CHARS) return `Câu trả lời tối đa ${SHORT_MAX_CHARS} ký tự.`;
      return null;
    case "ESSAY": {
      const min = question.minWords ?? DEFAULT_ESSAY_WORDS.min;
      const max = question.maxWords ?? DEFAULT_ESSAY_WORDS.max;
      const words = countWords(content);
      if (words < min) return `Đoạn văn cần ít nhất ${min} chữ (hiện có ${words}).`;
      if (words > max) return `Đoạn văn tối đa ${max} chữ (hiện có ${words}).`;
      return null;
    }
  }
}

/** JSON the model must return when grading an open answer. */
export const gradingResultSchema = z.object({
  level: z.enum(["CHUA_DAT", "DAT", "SAU_SAC"]),
  strengths: z.string().min(1).max(600),
  improvements: z.string().max(600),
});
export type GradingResult = z.infer<typeof gradingResultSchema>;

export const predictionFeedbackSchema = z.object({
  feedback: z.string().min(1).max(800),
});
