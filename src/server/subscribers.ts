import { isPassing, effectiveLevel } from "@/lib/questions/rules";
import { db } from "@/server/db";
import { on } from "@/server/events";
import {
  evaluateBadges,
  recordActivity,
  syncQuestionPoints,
  syncWorkPoints,
} from "@/server/services/gamification";

/**
 * Domain event subscribers (loaded by src/server/events.ts on first emit).
 * Phase 5: points, streak and badges. Phase 7 adds notifications here.
 */

on("AnswerGraded", async ({ userId, answerId, questionId }) => {
  await syncQuestionPoints(userId, questionId);
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    select: { isCorrect: true, level: true, teacherLevel: true, submittedAt: true },
  });
  // A passing answer keeps the streak alive on the day it was *submitted*,
  // even when the AI graded it later (spec §8.3).
  if (answer && (answer.isCorrect || isPassing(effectiveLevel(answer)))) {
    await recordActivity(userId, answer.submittedAt);
  }
  await evaluateBadges(userId);
});

on("WorkCompleted", async ({ userId, workId }) => {
  await syncWorkPoints(userId, workId);
  await evaluateBadges(userId);
});

on("SegmentsRead", async ({ userId }) => {
  if (await recordActivity(userId)) await evaluateBadges(userId);
});
