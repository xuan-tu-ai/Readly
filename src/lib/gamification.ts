import type { AnswerStatus, BadgeRule, QuestionType } from "@/generated/prisma/enums";
import { LEVELS, type LevelNumber } from "@/lib/art";
import { effectiveLevel, type AnswerLike } from "@/lib/questions/rules";
import { vnDay } from "@/lib/reading/active-time";

/**
 * Pure gamification rules (spec §8): points per source, levels, streaks,
 * the weekly leaderboard window and badge captions. No database here.
 */

export type PointTable = {
  mcqFirstTry: number;
  shortDat: number;
  shortSauSac: number;
  essayDat: number;
  essaySauSac: number;
  workCompleted: number;
  workEarlyBonus: number;
  miniGameMax: number;
  levelThresholds: number[];
};

export const DEFAULT_POINTS: PointTable = {
  mcqFirstTry: 5,
  shortDat: 10,
  shortSauSac: 20,
  essayDat: 20,
  essaySauSac: 40,
  workCompleted: 100,
  workEarlyBonus: 50,
  miniGameMax: 30,
  levelThresholds: LEVELS.map((l) => l.minPoints),
};

export type GradedAnswer = AnswerLike & { isCorrect?: boolean | null; status: AnswerStatus };

/**
 * What a question is worth to a student now:
 * - MCQ: only when the first attempt was correct;
 * - SHORT / ESSAY: by the best level reached (a teacher's override wins);
 * - PREDICTION: nothing.
 */
export function questionPoints(type: QuestionType, answers: GradedAnswer[], table: PointTable): number {
  const graded = answers.filter((a) => a.status === "GRADED");
  switch (type) {
    case "MCQ": {
      const first = graded.find((a) => a.attempt === 1);
      return first?.isCorrect ? table.mcqFirstTry : 0;
    }
    case "SHORT":
    case "ESSAY": {
      const [dat, sauSac] = type === "SHORT" ? [table.shortDat, table.shortSauSac] : [table.essayDat, table.essaySauSac];
      return Math.max(
        0,
        ...graded.map((a) => {
          const level = effectiveLevel(a);
          return level === "SAU_SAC" ? sauSac : level === "DAT" ? dat : 0;
        }),
      );
    }
    default:
      return 0;
  }
}

/** Mini game points: the best play's share of the maximum, rounded. */
export function miniGamePoints(best: { correct: number; total: number } | null, table: PointTable): number {
  if (!best || best.total <= 0) return 0;
  return Math.round((table.miniGameMax * Math.min(best.correct, best.total)) / best.total);
}

/** 0–3 stars for a mini game result. */
export function starsFor(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const ratio = correct / total;
  if (ratio >= 1) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}

// ───────────────────────── Levels ─────────────────────────

export type LevelInfo = {
  level: LevelNumber;
  name: string;
  min: number;
  /** Points needed for the next level; null at the top. */
  next: number | null;
  /** 0–1 progress towards the next level (1 at the top). */
  progress: number;
};

export function levelFor(points: number, thresholds: number[] = DEFAULT_POINTS.levelThresholds): LevelInfo {
  let index = 0;
  for (let i = 0; i < thresholds.length && i < LEVELS.length; i++) {
    if (points >= thresholds[i]) index = i;
  }
  const min = thresholds[index] ?? 0;
  const next = index + 1 < Math.min(thresholds.length, LEVELS.length) ? thresholds[index + 1] : null;
  return {
    level: LEVELS[index].level,
    name: LEVELS[index].name,
    min,
    next,
    progress: next === null ? 1 : Math.max(0, Math.min(1, (points - min) / (next - min))),
  };
}

// ───────────────────────── Days, streaks, weeks ─────────────────────────

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export type StreakInfo = {
  /** Consecutive days up to today, or up to yesterday if today has no activity yet. */
  current: number;
  longest: number;
  /** Today already counts. */
  today: boolean;
  /** Last 7 Vietnam days, oldest first. */
  week: { day: Date; active: boolean }[];
};

export function streakFrom(days: Date[], now = new Date()): StreakInfo {
  const set = new Set(days.map(dayKey));
  const today = vnDay(now);
  const yesterday = new Date(today.getTime() - DAY_MS);

  let current = 0;
  const start = set.has(dayKey(today)) ? today : set.has(dayKey(yesterday)) ? yesterday : null;
  if (start) {
    for (let d = start; set.has(dayKey(d)); d = new Date(d.getTime() - DAY_MS)) current++;
  }

  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const time of [...set].map((k) => Date.parse(`${k}T00:00:00Z`)).sort((a, b) => a - b)) {
    run = previous !== null && time - previous === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = time;
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today.getTime() - (6 - i) * DAY_MS);
    return { day, active: set.has(dayKey(day)) };
  });
  return { current, longest, today: set.has(dayKey(today)), week };
}

/** Start of the leaderboard week: Monday 00:00 in Vietnam, as an instant. */
export function weekStart(now = new Date()): Date {
  const today = vnDay(now); // UTC midnight of the Vietnam date
  const weekday = (today.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(today.getTime() - weekday * DAY_MS - VN_OFFSET_MS);
}

// ───────────────────────── Badges ─────────────────────────

/** Short ribbon text for a badge, e.g. "7 NGÀY". */
export function badgeCaption(rule: BadgeRule, threshold: number | null): string | undefined {
  if (threshold === null) return undefined;
  switch (rule) {
    case "WORKS_COMPLETED":
      return `${threshold} TÁC PHẨM`;
    case "GENRES_COMPLETED":
      return `${threshold} THỂ LOẠI`;
    case "STREAK_DAYS":
      return `${threshold} NGÀY`;
    case "DEEP_ANSWERS":
      return `${threshold} SÂU SẮC`;
    default:
      return undefined;
  }
}

export type BadgeStats = {
  worksCompleted: number;
  genresCompleted: number;
  longestStreak: number;
  deepAnswers: number;
  completedWorkIds: Set<string>;
};

/** Progress towards a badge: current value and target (target 1 for "complete work X"). */
export function badgeProgress(
  badge: { rule: BadgeRule; threshold: number | null; workId: string | null },
  stats: BadgeStats,
): { value: number; target: number; earned: boolean } {
  const target = badge.rule === "WORK_COMPLETED" ? 1 : Math.max(1, badge.threshold ?? 1);
  const value = (() => {
    switch (badge.rule) {
      case "WORKS_COMPLETED":
        return stats.worksCompleted;
      case "GENRES_COMPLETED":
        return stats.genresCompleted;
      case "STREAK_DAYS":
        return stats.longestStreak;
      case "DEEP_ANSWERS":
        return stats.deepAnswers;
      case "WORK_COMPLETED":
        return badge.workId && stats.completedWorkIds.has(badge.workId) ? 1 : 0;
    }
  })();
  return { value: Math.min(value, target), target, earned: value >= target };
}
