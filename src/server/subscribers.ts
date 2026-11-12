import { LEVEL_LABEL, effectiveLevel, isPassing } from "@/lib/questions/rules";
import { db } from "@/server/db";
import { on } from "@/server/events";
import {
  evaluateBadges,
  recordActivity,
  syncQuestionPoints,
  syncWorkPoints,
} from "@/server/services/gamification";
import { notify } from "@/server/services/notifications";

/**
 * Domain event subscribers (loaded by src/server/events.ts on first emit).
 * Phase 5: points, streak and badges. Phase 7 adds notifications here.
 */

on("AnswerGraded", async ({ userId, answerId, questionId, source }) => {
  await syncQuestionPoints(userId, questionId);
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    select: {
      isCorrect: true,
      level: true,
      teacherLevel: true,
      submittedAt: true,
      question: { select: { prompt: true, segmentId: true, work: { select: { id: true, slug: true } } } },
    },
  });
  // A passing answer keeps the streak alive on the day it was *submitted*,
  // even when the AI graded it later (spec §8.3).
  if (answer && (answer.isCorrect || isPassing(effectiveLevel(answer)))) {
    await recordActivity(userId, answer.submittedAt);
  }
  // Queued AI feedback and teacher overrides reach the student (spec §11); MCQ results are instant.
  if (answer && source !== "auto") {
    const level = effectiveLevel(answer);
    const { work, segmentId, prompt } = answer.question;
    await notify([
      {
        userId,
        kind: source === "teacher" ? "TEACHER_REVIEW" : "GRADED",
        title: source === "teacher" ? "Giáo viên đã chấm lại câu trả lời của bạn" : "Mướp đã nhận xét câu trả lời của bạn",
        body: `${level ? `Mức: ${LEVEL_LABEL[level]} · ` : ""}${prompt.length > 90 ? `${prompt.slice(0, 90)}…` : prompt}`,
        href: `/student/read/${work.slug}${segmentId ? `?seg=${segmentId}` : ""}`,
        workId: work.id,
      },
    ]);
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
