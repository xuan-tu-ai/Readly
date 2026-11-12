/**
 * Demo class data for the teacher dashboard (SEED_DEMO=true): 14 sample
 * students in class DEMO12 with different reading habits, two assignments
 * (one still open, one past its deadline), graded answers, reading time and
 * highlights. Runs once: skipped when the first demo student already exists.
 *
 * Everything is deterministic (seeded random), so the dashboard looks the
 * same on every machine. Phase 9 can grow this to the full demo dataset.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import type { AnswerLevel, HighlightColor } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/server/auth/password";
import { effectiveLevel, isPassing } from "../src/lib/questions/rules";
import { htmlToText } from "../src/lib/reading/html-text";
import { vnDay } from "../src/lib/reading/active-time";
import { anchorFor, sentenceAt } from "../src/lib/reading/text";
import { dueAtFromDate, vnDateString } from "../src/lib/teacher";
import { db as appDb } from "../src/server/db";
import { evaluateBadges, recalculateUser, recordActivity } from "../src/server/services/gamification";

type Profile = "ace" | "good" | "late" | "behind" | "flagged" | "idle";

const STUDENTS: { name: string; profile: Profile }[] = [
  { name: "Nguyễn Hoàng Anh", profile: "ace" },
  { name: "Lê Thị Bích Ngọc", profile: "good" },
  { name: "Phạm Quốc Bảo", profile: "behind" },
  { name: "Đỗ Thu Hà", profile: "ace" },
  { name: "Vũ Minh Đức", profile: "late" },
  { name: "Bùi Khánh Linh", profile: "good" },
  { name: "Hoàng Gia Huy", profile: "idle" },
  { name: "Ngô Phương Thảo", profile: "good" },
  { name: "Đặng Tuấn Kiệt", profile: "flagged" },
  { name: "Trịnh Mai Chi", profile: "ace" },
  { name: "Lý Nhật Nam", profile: "late" },
  { name: "Phan Thanh Tâm", profile: "behind" },
  { name: "Mai Anh Thư", profile: "good" },
  { name: "Cao Đức Long", profile: "idle" },
];

export const DEMO_STUDENT_PASSWORD = "readly-hs-123";
const emailFor = (i: number) => `hs${String(i + 1).padStart(2, "0")}@demo.readly.local`;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHORT_TEXT: Record<AnswerLevel, string> = {
  SAU_SAC:
    "Chi tiết gió qua hàng tre và nắng vàng trên đê gợi một làng quê yên bình. Em thấy tác giả dùng hình ảnh gần gũi để nói nỗi nhớ quê, nhịp thơ chậm như bước chân người đi xa.",
  DAT: "Chi tiết gió qua hàng tre làm em nhớ quê, khung cảnh rất yên bình và gần gũi với mọi người.",
  CHUA_DAT: "Em thấy đoạn này hay vì tả cảnh đẹp.",
};

const FEEDBACK: Record<AnswerLevel, { strengths: string; improvements: string }> = {
  SAU_SAC: {
    strengths: "Câu trả lời bám sát văn bản, nêu được các ý quan trọng và có cảm nhận riêng.",
    improvements: "Bạn có thể nói thêm về nhịp điệu của câu thơ.",
  },
  DAT: {
    strengths: "Bạn đã nêu được ý chính của câu hỏi.",
    improvements: "Thử bổ sung dẫn chứng cụ thể từ văn bản để câu trả lời sâu sắc hơn.",
  },
  CHUA_DAT: {
    strengths: "Bạn đã bắt đầu trả lời câu hỏi.",
    improvements: "Hãy viết cụ thể hơn và dẫn chứng từ văn bản để làm rõ ý của mình.",
  },
};

const ESSAY_TEXT =
  "Đọc tác phẩm, em ấn tượng nhất với cách tác giả dựng lại khung cảnh làng quê bằng những hình ảnh rất quen: gió qua hàng tre, nắng vàng trên đê, con đường nhỏ dẫn về nhà. Những chi tiết ấy không mới, nhưng được đặt cạnh nhau theo một nhịp chậm rãi, khiến người đọc như đang đi lại con đường tuổi thơ. Em nghĩ điều tác giả muốn gửi gắm là tình yêu với những gì bình dị nhất, thứ mà khi lớn lên và đi xa ta mới thấy quý. Đọc xong, em muốn gọi điện cho ông bà ở quê nhiều hơn.";

const NOTES = [
  "Câu này làm em nhớ quê ngoại.",
  "Không hiểu vì sao tác giả lặp lại hình ảnh này?",
  "Nhịp thơ chậm, đọc to nghe rất hay.",
  "Biện pháp liệt kê làm cảnh hiện lên rõ.",
  "Đoạn này buồn quá.",
];
const COLORS: HighlightColor[] = ["YELLOW", "BLUE", "PINK", "PURPLE"];

type WorkData = Awaited<ReturnType<typeof loadWork>>;

async function loadWork(db: PrismaClient, slug: string) {
  return db.work.findUniqueOrThrow({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      segments: { where: { archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, content: true } },
      questions: {
        where: { required: true },
        select: { id: true, type: true, segmentId: true, correctOptionId: true, options: true, stage: true },
      },
    },
  });
}

export async function seedDemoClass(db: PrismaClient, classId: string, now = new Date()) {
  if (await db.user.findUnique({ where: { email: emailFor(0) }, select: { id: true } })) return null;

  const random = mulberry32(20261112);
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const between = (min: number, max: number) => min + random() * (max - min);

  const poem = await loadWork(db, "tho-mau-01");
  const story = await loadWork(db, "truyen-ngan-mau-01");

  // Open assignment (due in 4 days) and one whose deadline passed 2 days ago.
  const openDue = dueAtFromDate(vnDateString(new Date(now.getTime() + 4 * DAY)))!;
  const pastDue = dueAtFromDate(vnDateString(new Date(now.getTime() - 2 * DAY)))!;
  const assignments = [
    { work: poem, dueAt: openDue, createdAt: new Date(now.getTime() - 10 * DAY) },
    { work: story, dueAt: pastDue, createdAt: new Date(now.getTime() - 14 * DAY) },
  ];
  for (const a of assignments) {
    await db.assignment.upsert({
      where: { classId_workId: { classId, workId: a.work.id } },
      update: {},
      create: { classId, workId: a.work.id, dueAt: a.dueAt, createdAt: a.createdAt },
    });
  }

  const passwordHash = await hashPassword(DEMO_STUDENT_PASSWORD);
  const ids: string[] = [];

  for (const [i, s] of STUDENTS.entries()) {
    const user = await db.user.create({
      data: {
        email: emailFor(i),
        name: s.name,
        role: "STUDENT",
        passwordHash,
        settings: { create: {} },
        memberships: { create: { classId, joinedAt: new Date(now.getTime() - 20 * DAY) } },
      },
    });
    ids.push(user.id);

    /** Reads the first `count` segments, answers their questions, and maybe completes. */
    const read = async (work: WorkData, count: number, end: Date, opts: { level: AnswerLevel; complete: boolean; dueAt: Date; createdAt: Date; flagShort?: boolean }) => {
      const segments = work.segments.slice(0, count);
      const start = end.getTime() - segments.length * between(0.6, 1.6) * HOUR;
      for (const [k, seg] of segments.entries()) {
        const readAt = new Date(start + (k + 1) * ((end.getTime() - start) / Math.max(1, segments.length)));
        await db.segmentRead.create({ data: { userId: user.id, segmentId: seg.id, readAt } });
        await db.readingTime.create({
          data: { userId: user.id, segmentId: seg.id, day: vnDay(readAt), seconds: Math.round(between(90, 420)) },
        });
      }
      const readIds = new Set(segments.map((seg) => seg.id));
      const due = work.questions.filter((q) =>
        q.stage === "DURING" ? q.segmentId !== null && readIds.has(q.segmentId) : opts.complete,
      );
      let flagged = Boolean(opts.flagShort);
      for (const q of due) {
        const at = new Date(end.getTime() - between(0.1, 0.9) * HOUR);
        if (q.type === "MCQ") {
          const wrongFirst = random() < (opts.level === "SAU_SAC" ? 0.1 : 0.35);
          const wrong = (q.options as { id: string }[]).find((o) => o.id !== q.correctOptionId)!.id;
          const tries = wrongFirst ? [wrong, q.correctOptionId!] : [q.correctOptionId!];
          for (const [n, content] of tries.entries()) {
            const isCorrect = content === q.correctOptionId;
            await db.answer.create({
              data: {
                questionId: q.id,
                userId: user.id,
                attempt: n + 1,
                content,
                status: "GRADED",
                isCorrect,
                level: isCorrect ? "DAT" : "CHUA_DAT",
                submittedAt: at,
                gradedAt: at,
              },
            });
          }
          continue;
        }
        const levels: AnswerLevel[] =
          flagged && q.type === "SHORT"
            ? ["CHUA_DAT", "CHUA_DAT", "CHUA_DAT"]
            : opts.level === "DAT" && random() < 0.3
              ? ["CHUA_DAT", "DAT"]
              : [opts.level === "SAU_SAC" && random() < 0.25 ? "DAT" : opts.level];
        if (flagged && q.type === "SHORT") flagged = false;
        for (const [n, level] of levels.entries()) {
          const submittedAt = new Date(at.getTime() + n * 20 * 60_000);
          await db.answer.create({
            data: {
              questionId: q.id,
              userId: user.id,
              attempt: n + 1,
              content: q.type === "ESSAY" ? ESSAY_TEXT : SHORT_TEXT[level],
              status: "GRADED",
              level,
              ...FEEDBACK[level],
              submittedAt,
              gradedAt: new Date(submittedAt.getTime() + 40_000),
            },
          });
        }
      }

      // Highlights: most students mark the same few lines, so the heatmap has hot spots.
      for (const seg of segments) {
        if (random() < 0.45) continue;
        const text = htmlToText(seg.content);
        const lines = [...text.matchAll(/[^\n]+/g)].map((m) => m.index!);
        const popular = lines.slice(1, 3);
        const offset = random() < 0.7 && popular.length ? pick(popular) : pick(lines);
        const span = sentenceAt(text, offset + 2);
        if (!span) continue;
        const note = random() < 0.35 ? pick(NOTES) : null;
        await db.highlight.create({
          data: {
            userId: user.id,
            workId: work.id,
            segmentId: seg.id,
            ...span,
            ...anchorFor(text, span),
            color: pick(COLORS),
            note,
            isPrivate: random() < 0.12,
            createdAt: end,
          },
        });
      }

      const last = segments.at(-1);
      if (last) {
        await db.readingProgress.create({
          data: { userId: user.id, workId: work.id, segmentId: last.id, segmentFraction: 0.9, startedAt: new Date(start), updatedAt: end },
        });
      }
      if (opts.complete && count >= work.segments.length) {
        await db.workCompletion.create({
          data: {
            userId: user.id,
            workId: work.id,
            completedAt: end,
            onTime: end.getTime() <= opts.dueAt.getTime() && end.getTime() >= opts.createdAt.getTime(),
          },
        });
      }
    };

    const ago = (minH: number, maxH: number) => new Date(now.getTime() - between(minH, maxH) * HOUR);
    const [poemA, storyA] = assignments;
    const all = (w: WorkData) => w.segments.length;
    switch (s.profile) {
      case "ace":
        await read(story, all(story), new Date(pastDue.getTime() - between(30, 90) * HOUR), { ...storyA, level: "SAU_SAC", complete: true });
        await read(poem, all(poem), ago(6, 40), { ...poemA, level: "SAU_SAC", complete: true });
        break;
      case "good":
        await read(story, all(story), new Date(pastDue.getTime() - between(4, 40) * HOUR), { ...storyA, level: "DAT", complete: true });
        await read(poem, Math.ceil(all(poem) * between(0.4, 0.8)), ago(2, 30), { ...poemA, level: "DAT", complete: false });
        break;
      case "late":
        await read(story, all(story), new Date(pastDue.getTime() + between(10, 30) * HOUR), { ...storyA, level: "DAT", complete: true });
        await read(poem, 1, ago(20, 60), { ...poemA, level: "DAT", complete: false });
        break;
      case "behind":
        await read(story, Math.ceil(all(story) * 0.6), ago(70, 120), { ...storyA, level: "DAT", complete: false });
        break;
      case "flagged":
        await read(story, all(story), new Date(pastDue.getTime() - 20 * HOUR), { ...storyA, level: "DAT", complete: true, flagShort: true });
        await read(poem, 2, ago(3, 10), { ...poemA, level: "CHUA_DAT", complete: false });
        break;
      case "idle":
        break;
    }
  }

  // Assignment notices for everyone in the class, as if sent when assigned.
  const members = await db.classMembership.findMany({ where: { classId, leftAt: null }, select: { studentId: true } });
  for (const a of assignments) {
    await db.notification.createMany({
      data: members.map((m) => ({
        userId: m.studentId,
        kind: "ASSIGNMENT" as const,
        title: `Bài mới: ${a.work.title}`,
        href: `/student/works/${a.work.slug}`,
        workId: a.work.id,
        createdAt: a.createdAt,
      })),
    });
  }

  // Points, streaks and badges from the history above (same as the backfill script).
  for (const userId of ids) {
    await recalculateUser(userId);
    const [reads, answers] = await Promise.all([
      appDb.segmentRead.findMany({ where: { userId }, select: { readAt: true } }),
      appDb.answer.findMany({ where: { userId, status: "GRADED" }, select: { submittedAt: true, isCorrect: true, level: true, teacherLevel: true } }),
    ]);
    for (const r of reads) await recordActivity(userId, r.readAt);
    for (const a of answers) if (a.isCorrect || isPassing(effectiveLevel(a))) await recordActivity(userId, a.submittedAt);
    await evaluateBadges(userId);
  }
  await appDb.$disconnect();
  return { students: STUDENTS.length, assignments: assignments.length };
}
