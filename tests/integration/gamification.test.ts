import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/roles";
import { db } from "@/server/db";
import { setJobSender } from "@/server/queue";
import {
  acknowledgeCelebrations,
  evaluateBadges,
  getCelebrations,
  getClassLeaderboard,
  getPlayer,
  getStreak,
  listBadges,
  recalculateAll,
  recordActivity,
  setLeaderboardEnabled,
  syncQuestionPoints,
  totalPoints,
} from "@/server/services/gamification";
import { getGameForPlay, listWorkGames, playGame } from "@/server/services/minigames";
import { gradeAnswerJob, submitAnswer } from "@/server/services/questions";
import { markSegmentsRead } from "@/server/services/reading";
import { enroll, makeClass, makeUser, resetDatabase } from "../helpers/db";

beforeEach(async () => {
  await resetDatabase();
  setJobSender(async () => {});
});

const GOOD = "Hình ảnh gió qua hàng tre và nắng vàng trên đê gợi một làng quê yên bình, gần gũi.";

async function makeWork(slug = "tac-pham", genre: "THO" | "KICH" = "THO") {
  const work = await db.work.create({
    data: {
      slug,
      title: `Tác phẩm ${slug}`,
      author: "Tác giả",
      authorBio: "",
      summary: "",
      genre,
      difficulty: 1,
      estMinutes: 10,
      status: "PUBLISHED",
      searchText: slug,
      segments: {
        create: [
          { order: 1, content: "<p>Gió qua hàng tre, nắng vàng trên đê.</p>" },
          { order: 2, content: "<p>Đêm xuống trên sông.</p>" },
        ],
      },
    },
    include: { segments: { orderBy: { order: "asc" } } },
  });
  const [s1, s2] = work.segments;
  const mcq = await db.question.create({
    data: {
      workId: work.id,
      segmentId: s1.id,
      stage: "DURING",
      type: "MCQ",
      prompt: "Chọn?",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionId: "b",
    },
  });
  const short = await db.question.create({
    data: {
      workId: work.id,
      segmentId: s2.id,
      stage: "DURING",
      type: "SHORT",
      prompt: "Vì sao?",
      rubric: { chuaDat: "chung chung", dat: "có ý", sauSac: "đủ ý" },
      keyPoints: ["gió qua hàng tre", "nắng vàng trên đê"],
    },
  });
  return { work, s1, s2, mcq, short };
}

async function gradeShort(actor: Actor, questionId: string, text = GOOD) {
  const view = await submitAnswer(actor, questionId, text);
  await gradeAnswerJob(view.answers.at(-1)!.id);
  return view.answers.at(-1)!.id;
}

describe("point ledger", () => {
  it("awards MCQ points only for a correct first attempt, once", async () => {
    const student = await makeUser("STUDENT");
    const { mcq } = await makeWork();
    await submitAnswer(student.actor, mcq.id, "b");
    expect(await totalPoints(student.id)).toBe(5);
    // Re-syncing never double-awards.
    await syncQuestionPoints(student.id, mcq.id);
    await syncQuestionPoints(student.id, mcq.id);
    expect(await totalPoints(student.id)).toBe(5);

    const other = await makeUser("STUDENT");
    await submitAnswer(other.actor, mcq.id, "a");
    await submitAnswer(other.actor, mcq.id, "b");
    expect(await totalPoints(other.id)).toBe(0);
  });

  it("AI grading adds points; a teacher override corrects them with an adjusting entry", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();
    const answerId = await gradeShort(student.actor, short.id);
    expect(await totalPoints(student.id)).toBe(20); // mock grades GOOD as Sâu sắc

    await db.answer.update({ where: { id: answerId }, data: { teacherLevel: "DAT" } });
    expect(await syncQuestionPoints(student.id, short.id)).toBe(-10);
    expect(await totalPoints(student.id)).toBe(10);
    const entries = await db.pointEntry.findMany({ where: { userId: student.id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => e.amount)).toEqual([20, -10]);
  });

  it("completing a work adds 100 once; recalculation after a table change keeps ledgers right", async () => {
    const student = await makeUser("STUDENT");
    const { work, s1, s2, mcq, short } = await makeWork();
    await markSegmentsRead(student.actor, [s1.id, s2.id]);
    await submitAnswer(student.actor, mcq.id, "b");
    await gradeShort(student.actor, short.id);
    expect(await totalPoints(student.id)).toBe(5 + 20 + 100);
    expect(await db.workCompletion.count({ where: { workId: work.id } })).toBe(1);

    await db.gamificationConfig.create({ data: { id: 1, workCompleted: 150, mcqFirstTry: 10 } });
    await recalculateAll();
    expect(await totalPoints(student.id)).toBe(10 + 20 + 150);
    await recalculateAll();
    expect(await totalPoints(student.id)).toBe(180);
  });
});

describe("streak", () => {
  it("counts reading days in Vietnam time", async () => {
    const student = await makeUser("STUDENT");
    // 10 Nov 23:30 and 11 Nov 00:30 in Vietnam are two different days.
    expect(await recordActivity(student.id, new Date("2026-11-10T16:30:00Z"))).toBe(true);
    expect(await recordActivity(student.id, new Date("2026-11-10T17:30:00Z"))).toBe(true);
    expect(await recordActivity(student.id, new Date("2026-11-10T20:00:00Z"))).toBe(false);
    const streak = await getStreak(student.id, new Date("2026-11-11T05:00:00Z"));
    expect(streak).toMatchObject({ current: 2, longest: 2, today: true });
  });

  it("reading a new segment and a passing answer count; a failing one does not", async () => {
    const student = await makeUser("STUDENT");
    const { s1, mcq } = await makeWork();
    await submitAnswer(student.actor, mcq.id, "a");
    expect(await db.streakDay.count()).toBe(0);
    await markSegmentsRead(student.actor, [s1.id]);
    expect(await db.streakDay.count()).toBe(1);
  });

  it("a late-graded answer counts for the day it was submitted", async () => {
    const student = await makeUser("STUDENT");
    const { short } = await makeWork();
    const view = await submitAnswer(student.actor, short.id, GOOD);
    const answerId = view.answers[0].id;
    await db.answer.update({ where: { id: answerId }, data: { submittedAt: new Date("2026-11-01T03:00:00Z") } });
    await gradeAnswerJob(answerId);
    const days = await db.streakDay.findMany({ where: { userId: student.id } });
    expect(days.map((d) => d.day.toISOString().slice(0, 10))).toEqual(["2026-11-01"]);
  });
});

describe("badges", () => {
  async function badge(rule: "WORKS_COMPLETED" | "GENRES_COMPLETED" | "STREAK_DAYS" | "DEEP_ANSWERS" | "WORK_COMPLETED", extra: { threshold?: number; workId?: string } = {}) {
    return db.badgeDefinition.create({
      data: { name: rule, description: "", rule, emblem: "books", tier: "gold", threshold: extra.threshold ?? null, workId: extra.workId ?? null },
    });
  }

  it("each template awards once, and only when its rule holds", async () => {
    const student = await makeUser("STUDENT");
    const { work, s1, s2, mcq, short } = await makeWork();
    const other = await makeWork("kich", "KICH");
    const works1 = await badge("WORKS_COMPLETED", { threshold: 1 });
    const works2 = await badge("WORKS_COMPLETED", { threshold: 2 });
    const genres1 = await badge("GENRES_COMPLETED", { threshold: 1 });
    const deep1 = await badge("DEEP_ANSWERS", { threshold: 1 });
    const specific = await badge("WORK_COMPLETED", { workId: work.id });
    const specificOther = await badge("WORK_COMPLETED", { workId: other.work.id });
    const streak2 = await badge("STREAK_DAYS", { threshold: 2 });

    await markSegmentsRead(student.actor, [s1.id, s2.id]);
    await submitAnswer(student.actor, mcq.id, "b");
    await gradeShort(student.actor, short.id); // Sâu sắc + completes the work

    const earned = new Set((await db.userBadge.findMany({ where: { userId: student.id } })).map((b) => b.badgeId));
    expect(earned).toEqual(new Set([works1.id, genres1.id, deep1.id, specific.id]));
    expect(earned.has(works2.id) || earned.has(specificOther.id) || earned.has(streak2.id)).toBe(false);

    // Streak badge once a second consecutive day exists.
    await recordActivity(student.id, new Date(Date.now() - 86_400_000));
    expect(await evaluateBadges(student.id)).toEqual([streak2.id]);
    expect(await evaluateBadges(student.id)).toEqual([]);
    expect(await db.userBadge.count({ where: { userId: student.id } })).toBe(5);
  });

  it("lists progress and celebrates new badges and level-ups once", async () => {
    const student = await makeUser("STUDENT");
    const { s1, s2, mcq, short } = await makeWork();
    await badge("WORKS_COMPLETED", { threshold: 1 });
    const later = await badge("WORKS_COMPLETED", { threshold: 3 });
    await markSegmentsRead(student.actor, [s1.id, s2.id]);
    await submitAnswer(student.actor, mcq.id, "b");
    await gradeShort(student.actor, short.id);

    const badges = await listBadges(student.id);
    expect(badges[0]).toMatchObject({ earned: true });
    expect(badges.find((b) => b.id === later.id)).toMatchObject({ earned: false, progress: { value: 1, target: 3 } });

    await db.gamificationConfig.create({ data: { id: 1, levelThresholds: [0, 100, 1000, 2500, 5000] } });
    const celebrations = await getCelebrations(student.id);
    expect(celebrations.badges).toHaveLength(1);
    expect(celebrations.levelUp).toMatchObject({ level: 2, name: "Người đọc" });

    await acknowledgeCelebrations(student.actor);
    expect(await getCelebrations(student.id)).toEqual({ badges: [], levelUp: null });
  });
});

describe("mini games", () => {
  async function makeGame(unlockSegmentId: string, workId: string) {
    return db.miniGame.create({
      data: {
        workId,
        unlockSegmentId,
        type: "DETAIL",
        title: "Đoán",
        data: {
          items: [
            { id: "x", text: "gió qua hàng ___", options: ["tre", "cau"], answer: 0 },
            { id: "y", text: "nắng ___ trên đê", options: ["đỏ", "vàng"], answer: 1 },
          ],
        },
      },
    });
  }

  it("stays locked until its segment is read and never sends the answers", async () => {
    const student = await makeUser("STUDENT");
    const { work, s1 } = await makeWork();
    const game = await makeGame(s1.id, work.id);

    expect((await listWorkGames(student.id, work.id))[0]).toMatchObject({ unlocked: false, bestStars: null });
    await expect(getGameForPlay(student.actor, game.id)).rejects.toThrow("để mở mini game");
    await expect(playGame(student.actor, game.id, { x: 0, y: 1 })).rejects.toThrow("để mở mini game");

    await markSegmentsRead(student.actor, [s1.id]);
    const playable = await getGameForPlay(student.actor, game.id);
    expect(JSON.stringify(playable)).not.toContain("answer");
    expect((await listWorkGames(student.id, work.id))[0].unlocked).toBe(true);
  });

  it("points follow the best play: only a new record adds the difference", async () => {
    const student = await makeUser("STUDENT");
    const { work, s1 } = await makeWork();
    const game = await makeGame(s1.id, work.id);
    await markSegmentsRead(student.actor, [s1.id]);

    const first = await playGame(student.actor, game.id, { x: 0, y: 0 });
    expect(first).toMatchObject({ correct: 1, total: 2, stars: 1, pointsAdded: 15, newRecord: true });
    const worse = await playGame(student.actor, game.id, { x: 1, y: 0 });
    expect(worse).toMatchObject({ correct: 0, pointsAdded: 0, newRecord: false });
    const best = await playGame(student.actor, game.id, { x: 0, y: 1 });
    expect(best).toMatchObject({ stars: 3, pointsAdded: 15, newRecord: true });
    expect(await totalPoints(student.id)).toBe(30);
    expect(await db.streakDay.count({ where: { userId: student.id } })).toBe(1);
  });
});

describe("weekly class leaderboard", () => {
  it("ranks this week's points, shows my row, and respects the class switch", async () => {
    const teacher = await makeUser("TEACHER");
    const cls = await makeClass(teacher.id, "LOP1");
    const [a, b, c] = await Promise.all([
      makeUser("STUDENT", { name: "An" }),
      makeUser("STUDENT", { name: "Bình" }),
      makeUser("STUDENT", { name: "Chi" }),
    ]);
    const outsider = await makeUser("STUDENT", { name: "Dũng" });
    for (const s of [a, b, c]) await enroll(s.id, cls.id);

    const now = new Date("2026-11-12T03:00:00Z"); // Thursday
    const lastWeek = new Date("2026-11-08T16:00:00Z"); // Sunday 23:00 Vietnam
    await db.pointEntry.createMany({
      data: [
        { userId: a.id, key: "x", reason: "MCQ", amount: 30, createdAt: now },
        { userId: b.id, key: "x", reason: "MCQ", amount: 30, createdAt: now },
        { userId: c.id, key: "x", reason: "MCQ", amount: 500, createdAt: lastWeek },
        { userId: outsider.id, key: "x", reason: "MCQ", amount: 900, createdAt: now },
      ],
    });

    const board = await getClassLeaderboard(c.id, now);
    if (board.state !== "ok") throw new Error("expected a leaderboard");
    expect(board.top.map((r) => [r.name, r.points, r.rank])).toEqual([
      ["An", 30, 1],
      ["Bình", 30, 1],
      ["Chi", 0, 3],
    ]);
    expect(board.me).toMatchObject({ name: "Chi", rank: 3, me: true });

    await setLeaderboardEnabled(teacher.actor, cls.id, false);
    expect(await getClassLeaderboard(a.id, now)).toMatchObject({ state: "disabled" });
    expect(await getClassLeaderboard(outsider.id, now)).toEqual({ state: "no-class" });

    const otherTeacher = await makeUser("TEACHER");
    await expect(setLeaderboardEnabled(otherTeacher.actor, cls.id, true)).rejects.toThrow();
  });

  it("player summary combines points, week points, level and streak", async () => {
    const student = await makeUser("STUDENT");
    await db.pointEntry.create({ data: { userId: student.id, key: "x", reason: "MCQ", amount: 320 } });
    await recordActivity(student.id);
    expect(await getPlayer(student.id)).toMatchObject({
      points: 320,
      weekPoints: 320,
      level: { level: 2, name: "Người đọc" },
      streak: { current: 1, today: true },
      badges: 0,
    });
  });
});
