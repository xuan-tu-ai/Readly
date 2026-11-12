"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import {
  assertReadableWork,
  getCompletionStatus,
  getQuestionsForReader,
  submitAnswer,
  type QuestionView,
} from "@/server/services/questions";
import { getCelebrations, totalPoints, type Celebrations } from "@/server/services/gamification";
import type { ActionResult } from "./reading";

type Completion = Awaited<ReturnType<typeof getCompletionStatus>>;

/** Points total and pending celebrations, so the reader can show rewards right away. */
type Rewards = { points: number; celebrations: Celebrations };

async function rewardsFor(userId: string): Promise<Rewards> {
  const [points, celebrations] = await Promise.all([totalPoints(userId), getCelebrations(userId)]);
  return { points, celebrations };
}

const submitSchema = z.object({
  questionId: z.string().min(1),
  workId: z.string().min(1),
  content: z.string().max(5000),
});

export async function submitAnswerAction(
  input: unknown,
): Promise<ActionResult<{ question: QuestionView; completion: Completion } & Rewards>> {
  const user = await requireUser("STUDENT");
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ." };
  try {
    const question = await submitAnswer(user, parsed.data.questionId, parsed.data.content);
    const [completion, rewards] = await Promise.all([getCompletionStatus(user.id, parsed.data.workId), rewardsFor(user.id)]);
    return { ok: true, data: { question, completion, ...rewards } };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Polled by the reader while an answer is waiting for AI feedback. */
export async function refreshQuestionsAction(
  workId: unknown,
): Promise<ActionResult<{ questions: QuestionView[]; completion: Completion } & Rewards>> {
  const user = await requireUser("STUDENT");
  if (typeof workId !== "string" || !workId) return { ok: false, error: "Dữ liệu không hợp lệ." };
  try {
    await assertReadableWork(workId);
  } catch {
    return { ok: false, error: "Không tìm thấy tác phẩm." };
  }
  const [questions, completion, rewards] = await Promise.all([
    getQuestionsForReader(user.id, workId),
    getCompletionStatus(user.id, workId),
    rewardsFor(user.id),
  ]);
  return { ok: true, data: { questions, completion, ...rewards } };
}
