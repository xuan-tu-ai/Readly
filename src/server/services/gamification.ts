import type { PointReason } from "@/generated/prisma/enums";
import { BADGE_EMBLEMS, BADGE_TIERS, avatarFor, type AvatarKey, type BadgeEmblem, type BadgeTier } from "@/lib/art";
import {
  DEFAULT_POINTS,
  badgeCaption,
  badgeProgress,
  levelFor,
  miniGamePoints,
  questionPoints,
  streakFrom,
  weekStart,
  type BadgeStats,
  type PointTable,
} from "@/lib/gamification";
import { vnDay } from "@/lib/reading/active-time";
import type { Actor } from "@/lib/roles";
import { assertRole, assertTeacherOfClass } from "@/server/authz";
import { db } from "@/server/db";

/**
 * Points, levels, streaks, badges and the weekly leaderboard (spec §8).
 * Called from domain event subscribers (src/server/subscribers.ts) and from
 * the mini game service; nothing here is triggered by the client directly.
 */

// ───────────────────────── Point table ─────────────────────────

export async function getPointTable(): Promise<PointTable> {
  const row = await db.gamificationConfig.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_POINTS;
  return {
    mcqFirstTry: row.mcqFirstTry,
    shortDat: row.shortDat,
    shortSauSac: row.shortSauSac,
    essayDat: row.essayDat,
    essaySauSac: row.essaySauSac,
    workCompleted: row.workCompleted,
    workEarlyBonus: row.workEarlyBonus,
    miniGameMax: row.miniGameMax,
    levelThresholds: row.levelThresholds,
  };
}

// ───────────────────────── Ledger ─────────────────────────

const KEY = {
  question: (id: string) => `question:${id}`,
  work: (id: string) => `work:${id}`,
  game: (id: string) => `game:${id}`,
};

/**
 * Brings one source to its target value by writing the difference. Serialised
 * per (user, key) with an advisory lock so concurrent jobs cannot double-award.
 * Returns the points added (negative for a correction).
 */
async function syncKey(userId: string, key: string, reason: PointReason, target: number): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}|${key}`}))::text`;
    const held = await tx.pointEntry.aggregate({ where: { userId, key }, _sum: { amount: true } });
    const delta = target - (held._sum.amount ?? 0);
    if (delta !== 0) await tx.pointEntry.create({ data: { userId, key, reason, amount: delta } });
    return delta;
  });
}

export async function syncQuestionPoints(userId: string, questionId: string, table?: PointTable): Promise<number> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      type: true,
      answers: {
        where: { userId },
        select: { attempt: true, status: true, level: true, teacherLevel: true, isCorrect: true },
      },
    },
  });
  if (!question || question.type === "PREDICTION") return 0;
  const target = questionPoints(question.type, question.answers, table ?? (await getPointTable()));
  return syncKey(userId, KEY.question(questionId), question.type, target);
}

export async function syncWorkPoints(userId: string, workId: string, table?: PointTable): Promise<number> {
  const completion = await db.workCompletion.findUnique({ where: { userId_workId: { userId, workId } } });
  const target = completion ? (table ?? (await getPointTable())).workCompleted : 0;
  return syncKey(userId, KEY.work(workId), "WORK_COMPLETED", target);
}

export async function syncGamePoints(userId: string, gameId: string, table?: PointTable): Promise<number> {
  const plays = await db.miniGamePlay.findMany({ where: { userId, gameId }, select: { correct: true, total: true } });
  const best = plays.reduce<{ correct: number; total: number } | null>(
    (top, p) => (!top || p.correct / p.total > top.correct / top.total ? p : top),
    null,
  );
  return syncKey(userId, KEY.game(gameId), "MINIGAME", miniGamePoints(best, table ?? (await getPointTable())));
}

/** Recomputes every source of one student (after the point table changes). */
export async function recalculateUser(userId: string, table?: PointTable) {
  const points = table ?? (await getPointTable());
  const [questions, completions, games] = await Promise.all([
    db.answer.findMany({ where: { userId }, distinct: ["questionId"], select: { questionId: true } }),
    db.workCompletion.findMany({ where: { userId }, select: { workId: true } }),
    db.miniGamePlay.findMany({ where: { userId }, distinct: ["gameId"], select: { gameId: true } }),
  ]);
  for (const q of questions) await syncQuestionPoints(userId, q.questionId, points);
  for (const c of completions) await syncWorkPoints(userId, c.workId, points);
  for (const g of games) await syncGamePoints(userId, g.gameId, points);
}

/** Recomputes all students; run after an admin changes the point table (phase 8). */
export async function recalculateAll() {
  const table = await getPointTable();
  const students = await db.user.findMany({ where: { role: "STUDENT" }, select: { id: true } });
  for (const s of students) await recalculateUser(s.id, table);
  return students.length;
}

export async function totalPoints(userId: string, since?: Date): Promise<number> {
  const sum = await db.pointEntry.aggregate({
    where: { userId, ...(since ? { createdAt: { gte: since } } : {}) },
    _sum: { amount: true },
  });
  return sum._sum.amount ?? 0;
}

// ───────────────────────── Streak ─────────────────────────

/** Marks the Vietnam day of `at` as active. Returns true when the day is new. */
export async function recordActivity(userId: string, at: Date = new Date()): Promise<boolean> {
  const { count } = await db.streakDay.createMany({ data: [{ userId, day: vnDay(at) }], skipDuplicates: true });
  return count > 0;
}

export async function getStreak(userId: string, now = new Date()) {
  const days = await db.streakDay.findMany({ where: { userId }, select: { day: true } });
  return streakFrom(
    days.map((d) => d.day),
    now,
  );
}

// ───────────────────────── Badges ─────────────────────────

async function badgeStats(userId: string): Promise<BadgeStats> {
  const [completions, streak, deep] = await Promise.all([
    db.workCompletion.findMany({ where: { userId }, select: { workId: true, work: { select: { genre: true } } } }),
    getStreak(userId),
    db.answer.findMany({
      where: {
        userId,
        status: "GRADED",
        OR: [{ teacherLevel: "SAU_SAC" }, { teacherLevel: null, level: "SAU_SAC" }],
      },
      distinct: ["questionId"],
      select: { questionId: true },
    }),
  ]);
  return {
    worksCompleted: completions.length,
    genresCompleted: new Set(completions.map((c) => c.work.genre)).size,
    longestStreak: streak.longest,
    deepAnswers: deep.length,
    completedWorkIds: new Set(completions.map((c) => c.workId)),
  };
}

/**
 * Awards every active badge whose rule now holds. Idempotent: a badge is
 * awarded once (primary key + skipDuplicates). Returns the new badge ids.
 */
export async function evaluateBadges(userId: string): Promise<string[]> {
  const pending = await db.badgeDefinition.findMany({
    where: { active: true, awards: { none: { userId } } },
    select: { id: true, rule: true, threshold: true, workId: true },
  });
  if (pending.length === 0) return [];
  const stats = await badgeStats(userId);
  const earned = pending.filter((b) => badgeProgress(b, stats).earned).map((b) => b.id);
  if (earned.length === 0) return [];
  await db.userBadge.createMany({ data: earned.map((badgeId) => ({ userId, badgeId })), skipDuplicates: true });
  return earned;
}

const asEmblem = (key: string): BadgeEmblem =>
  (BADGE_EMBLEMS.some((e) => e.key === key) ? key : "books") as BadgeEmblem;
const asTier = (key: string): BadgeTier => (BADGE_TIERS.some((t) => t.key === key) ? key : "bronze") as BadgeTier;

export type BadgeView = {
  id: string;
  name: string;
  description: string;
  emblem: BadgeEmblem;
  tier: BadgeTier;
  caption?: string;
  earned: boolean;
  awardedAt: Date | null;
  progress: { value: number; target: number };
};

/** All active badges with this student's progress, earned ones first (newest first). */
export async function listBadges(userId: string): Promise<BadgeView[]> {
  const [defs, stats] = await Promise.all([
    db.badgeDefinition.findMany({
      where: { active: true },
      orderBy: [{ rule: "asc" }, { threshold: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        rule: true,
        threshold: true,
        workId: true,
        emblem: true,
        tier: true,
        awards: { where: { userId }, select: { awardedAt: true } },
      },
    }),
    badgeStats(userId),
  ]);
  const views = defs.map((d) => {
    const progress = badgeProgress(d, stats);
    const awardedAt = d.awards[0]?.awardedAt ?? null;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      emblem: asEmblem(d.emblem),
      tier: asTier(d.tier),
      caption: badgeCaption(d.rule, d.threshold),
      earned: awardedAt !== null,
      awardedAt,
      progress: { value: progress.value, target: progress.target },
    };
  });
  return [
    ...views.filter((v) => v.earned).sort((a, b) => b.awardedAt!.getTime() - a.awardedAt!.getTime()),
    ...views.filter((v) => !v.earned),
  ];
}

// ───────────────────────── Player summary ─────────────────────────

export async function getPlayer(userId: string, now = new Date()) {
  const [table, points, weekPoints, streak, badges] = await Promise.all([
    getPointTable(),
    totalPoints(userId),
    totalPoints(userId, weekStart(now)),
    getStreak(userId, now),
    db.userBadge.count({ where: { userId } }),
  ]);
  return { points, weekPoints, level: levelFor(points, table.levelThresholds), streak, badges };
}

export type Player = Awaited<ReturnType<typeof getPlayer>>;

// ───────────────────────── Celebrations ─────────────────────────

/** New badges and a level-up the student has not seen yet. */
export async function getCelebrations(userId: string) {
  const [unseen, state, player] = await Promise.all([
    db.userBadge.findMany({
      where: { userId, seenAt: null },
      orderBy: { awardedAt: "asc" },
      select: {
        badge: { select: { id: true, name: true, description: true, emblem: true, tier: true, rule: true, threshold: true } },
      },
    }),
    db.playerState.findUnique({ where: { userId }, select: { celebratedLevel: true } }),
    getPlayer(userId),
  ]);
  const celebrated = state?.celebratedLevel ?? 1;
  return {
    badges: unseen.map(({ badge }) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      emblem: asEmblem(badge.emblem),
      tier: asTier(badge.tier),
      caption: badgeCaption(badge.rule, badge.threshold),
    })),
    levelUp: player.level.level > celebrated ? player.level : null,
  };
}

export type Celebrations = Awaited<ReturnType<typeof getCelebrations>>;

export async function acknowledgeCelebrations(actor: Actor) {
  assertRole(actor, "STUDENT");
  const player = await getPlayer(actor.id);
  await db.$transaction([
    db.userBadge.updateMany({ where: { userId: actor.id, seenAt: null }, data: { seenAt: new Date() } }),
    db.playerState.upsert({
      where: { userId: actor.id },
      update: { celebratedLevel: player.level.level },
      create: { userId: actor.id, celebratedLevel: player.level.level },
    }),
  ]);
}

// ───────────────────────── Leaderboard ─────────────────────────

export type LeaderboardRow = { userId: string; name: string; avatar: AvatarKey; points: number; rank: number; me: boolean };

export type Leaderboard =
  | { state: "no-class" }
  | { state: "disabled"; className: string }
  | {
      state: "ok";
      className: string;
      weekStart: Date;
      /** Whole days until the Monday reset (at least 1). */
      daysLeft: number;
      top: LeaderboardRow[];
      me: LeaderboardRow | null;
      size: number;
    };

/** Weekly class leaderboard: points earned since Monday 00:00 (Vietnam), top 10 + own row. */
export async function getClassLeaderboard(userId: string, now = new Date(), limit = 10): Promise<Leaderboard> {
  const membership = await db.classMembership.findFirst({
    where: { studentId: userId, leftAt: null },
    select: { class: { select: { id: true, name: true, leaderboardEnabled: true } } },
  });
  if (!membership) return { state: "no-class" };
  const cls = membership.class;
  if (!cls.leaderboardEnabled) return { state: "disabled", className: cls.name };

  const since = weekStart(now);
  const members = await db.classMembership.findMany({
    where: { classId: cls.id, leftAt: null },
    select: { student: { select: { id: true, name: true, player: { select: { avatar: true } } } } },
  });
  const sums = await db.pointEntry.groupBy({
    by: ["userId"],
    where: { userId: { in: members.map((m) => m.student.id) }, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  const byUser = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));
  const collator = new Intl.Collator("vi");
  const sorted = members
    .map((m) => ({
      userId: m.student.id,
      name: m.student.name,
      avatar: avatarFor(m.student.id, m.student.player?.avatar),
      points: byUser.get(m.student.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || collator.compare(a.name, b.name));

  // Equal points share a rank (1, 2, 2, 4…).
  const rows: LeaderboardRow[] = [];
  sorted.forEach((row, i) => {
    const rank = i > 0 && row.points === sorted[i - 1].points ? rows[i - 1].rank : i + 1;
    rows.push({ ...row, rank, me: row.userId === userId });
  });
  return {
    state: "ok",
    className: cls.name,
    weekStart: since,
    daysLeft: Math.max(1, Math.ceil((since.getTime() + 7 * 86_400_000 - now.getTime()) / 86_400_000)),
    top: rows.slice(0, limit),
    me: rows.find((r) => r.me) ?? null,
    size: rows.length,
  };
}

/** Teacher switches the class leaderboard on or off. */
export async function setLeaderboardEnabled(actor: Actor, classId: string, enabled: boolean) {
  await assertTeacherOfClass(actor, classId);
  await db.class.update({ where: { id: classId }, data: { leaderboardEnabled: enabled } });
}
