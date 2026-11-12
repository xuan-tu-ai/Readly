/**
 * One-off backfill for data that existed before gamification (phase 5):
 * recomputes every student's ledger, rebuilds streak days from past reads and
 * passing answers, then awards badges. Safe to run again.
 * Run: npm run gamification:backfill
 */
import "dotenv/config";
import { effectiveLevel, isPassing } from "../src/lib/questions/rules";
import { db } from "../src/server/db";
import { evaluateBadges, recalculateUser, recordActivity } from "../src/server/services/gamification";

async function main() {
  const students = await db.user.findMany({ where: { role: "STUDENT" }, select: { id: true, email: true } });
  for (const student of students) {
    await recalculateUser(student.id);
    const [reads, answers] = await Promise.all([
      db.segmentRead.findMany({ where: { userId: student.id }, select: { readAt: true } }),
      db.answer.findMany({
        where: { userId: student.id, status: "GRADED" },
        select: { submittedAt: true, isCorrect: true, level: true, teacherLevel: true },
      }),
    ]);
    for (const r of reads) await recordActivity(student.id, r.readAt);
    for (const a of answers) {
      if (a.isCorrect || isPassing(effectiveLevel(a))) await recordActivity(student.id, a.submittedAt);
    }
    const badges = await evaluateBadges(student.id);
    console.log(`✔ ${student.email}: ${badges.length} huy hiệu mới`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
