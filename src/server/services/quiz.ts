import type { Actor } from "@/lib/roles";
import { quizAnswersSchema, rankWorks, type QuizAnswers } from "@/lib/quiz";
import { db } from "@/server/db";
import { assertRole } from "@/server/authz";
import { listVisibleWorks } from "./works";

export async function saveQuizResult(actor: Actor, answers: QuizAnswers) {
  assertRole(actor, "STUDENT");
  return db.quizResult.create({ data: { userId: actor.id, answers } });
}

/** Latest valid answers, or null if the student never finished the quiz. */
export async function getLatestQuizAnswers(userId: string): Promise<QuizAnswers | null> {
  const latest = await db.quizResult.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { answers: true },
  });
  if (!latest) return null;
  // The quiz may have changed since; stale answers are treated as "not taken".
  const parsed = quizAnswersSchema.safeParse(latest.answers);
  return parsed.success ? parsed.data : null;
}

export async function getRecommendations(userId: string, limit = 6) {
  const answers = await getLatestQuizAnswers(userId);
  if (!answers) return null;
  return rankWorks(await listVisibleWorks(), answers, limit);
}
