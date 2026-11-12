import { describe, expect, it } from "vitest";
import {
  DEFAULT_POINTS,
  badgeCaption,
  badgeProgress,
  levelFor,
  miniGamePoints,
  questionPoints,
  starsFor,
  streakFrom,
  weekStart,
  type GradedAnswer,
} from "@/lib/gamification";
import { publicView, scoreGame, seededShuffle } from "@/lib/minigames";

const graded = (attempt: number, extra: Partial<GradedAnswer>): GradedAnswer => ({
  attempt,
  status: "GRADED",
  level: null,
  teacherLevel: null,
  isCorrect: null,
  ...extra,
});

describe("questionPoints", () => {
  it("MCQ: only a correct first attempt earns points", () => {
    expect(questionPoints("MCQ", [graded(1, { isCorrect: true })], DEFAULT_POINTS)).toBe(5);
    expect(questionPoints("MCQ", [graded(1, { isCorrect: false }), graded(2, { isCorrect: true })], DEFAULT_POINTS)).toBe(0);
  });

  it("SHORT / ESSAY: best level counts; a teacher override wins over the AI", () => {
    const answers = [graded(1, { level: "CHUA_DAT" }), graded(2, { level: "DAT" })];
    expect(questionPoints("SHORT", answers, DEFAULT_POINTS)).toBe(10);
    expect(questionPoints("ESSAY", answers, DEFAULT_POINTS)).toBe(20);
    expect(questionPoints("SHORT", [graded(1, { level: "DAT", teacherLevel: "SAU_SAC" })], DEFAULT_POINTS)).toBe(20);
    expect(questionPoints("ESSAY", [graded(1, { level: "SAU_SAC", teacherLevel: "CHUA_DAT" })], DEFAULT_POINTS)).toBe(0);
  });

  it("ignores pending answers and predictions", () => {
    expect(questionPoints("SHORT", [{ ...graded(1, { level: "SAU_SAC" }), status: "PENDING" }], DEFAULT_POINTS)).toBe(0);
    expect(questionPoints("PREDICTION", [graded(1, {})], DEFAULT_POINTS)).toBe(0);
  });
});

describe("mini game scoring", () => {
  it("points follow the best share of the maximum; stars by ratio", () => {
    expect(miniGamePoints({ correct: 3, total: 3 }, DEFAULT_POINTS)).toBe(30);
    expect(miniGamePoints({ correct: 2, total: 3 }, DEFAULT_POINTS)).toBe(20);
    expect(miniGamePoints(null, DEFAULT_POINTS)).toBe(0);
    expect([starsFor(3, 3), starsFor(3, 4), starsFor(2, 4), starsFor(1, 4)]).toEqual([3, 2, 1, 0]);
  });

  it("public view hides answers and never shows the right column pre-solved", () => {
    const data = {
      pairs: [
        { id: "a", left: "A", right: "1" },
        { id: "b", left: "B", right: "2" },
        { id: "c", left: "C", right: "3" },
      ],
    };
    for (const id of ["g1", "g2", "g3", "g4", "g5"]) {
      const view = publicView(id, "MATCH", data);
      if (view.type !== "MATCH") throw new Error("expected MATCH");
      expect(view.rights.map((r) => r.id)).not.toEqual(["a", "b", "c"]);
      expect(JSON.stringify(view)).not.toContain('"answer"');
    }
    const detail = publicView("g", "DETAIL", { items: [{ id: "x", text: "a ___ b", options: ["p", "q"], answer: 1 }] });
    expect(JSON.stringify(detail)).not.toContain("answer");
  });

  it("scores MATCH and DETAIL answers", () => {
    const match = { pairs: [{ id: "a", left: "A", right: "1" }, { id: "b", left: "B", right: "2" }] };
    expect(scoreGame("MATCH", match, { a: "a", b: "a" })).toMatchObject({ correct: 1, total: 2 });
    const detail = { items: [{ id: "x", text: "a ___ b", options: ["p", "q"], answer: 1 }] };
    expect(scoreGame("DETAIL", detail, { x: 1 })).toMatchObject({ correct: 1, total: 1, results: [{ answer: "q" }] });
  });

  it("seeded shuffle is stable for a seed", () => {
    expect(seededShuffle([1, 2, 3, 4, 5], "s")).toEqual(seededShuffle([1, 2, 3, 4, 5], "s"));
  });
});

describe("levelFor", () => {
  it("maps points to the five levels with progress to the next", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, name: "Tân thủ", next: 300, progress: 0 });
    expect(levelFor(650)).toMatchObject({ level: 2, min: 300, next: 1000, progress: 0.5 });
    expect(levelFor(5000)).toMatchObject({ level: 5, name: "Văn nhân", next: null, progress: 1 });
    expect(levelFor(-20).level).toBe(1);
  });
});

describe("streakFrom (Vietnam days)", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it("counts back from today, or from yesterday before today's reading", () => {
    const days = [d("2026-11-10"), d("2026-11-11"), d("2026-11-12")];
    expect(streakFrom(days, new Date("2026-11-12T03:00:00Z"))).toMatchObject({ current: 3, today: true });
    // 13 Nov, 09:00 in Vietnam: nothing read yet today, streak still alive.
    expect(streakFrom(days, new Date("2026-11-13T02:00:00Z"))).toMatchObject({ current: 3, today: false });
    // 14 Nov: a whole day missed.
    expect(streakFrom(days, new Date("2026-11-14T02:00:00Z")).current).toBe(0);
  });

  it("uses the Vietnam calendar day, not UTC", () => {
    // 12 Nov 23:30 in Vietnam is still 12 Nov 16:30 UTC; 13 Nov 00:30 Vietnam is 12 Nov 17:30 UTC.
    const days = [d("2026-11-12")];
    expect(streakFrom(days, new Date("2026-11-12T16:30:00Z")).today).toBe(true);
    expect(streakFrom(days, new Date("2026-11-12T17:30:00Z")).today).toBe(false);
  });

  it("tracks the longest run and the last 7 days", () => {
    const days = [d("2026-11-01"), d("2026-11-02"), d("2026-11-03"), d("2026-11-04"), d("2026-11-11"), d("2026-11-12")];
    const info = streakFrom(days, new Date("2026-11-12T03:00:00Z"));
    expect(info).toMatchObject({ current: 2, longest: 4 });
    expect(info.week.map((w) => w.active)).toEqual([false, false, false, false, false, true, true]);
  });
});

describe("weekStart", () => {
  it("is Monday 00:00 in Vietnam", () => {
    // Thursday 12 Nov 2026, 10:00 Vietnam → Monday 9 Nov 00:00 Vietnam = 8 Nov 17:00 UTC.
    expect(weekStart(new Date("2026-11-12T03:00:00Z")).toISOString()).toBe("2026-11-08T17:00:00.000Z");
    // Sunday 15 Nov 23:59 Vietnam is still the same week.
    expect(weekStart(new Date("2026-11-15T16:59:00Z")).toISOString()).toBe("2026-11-08T17:00:00.000Z");
    // Monday 16 Nov 00:00 Vietnam starts a new week.
    expect(weekStart(new Date("2026-11-15T17:00:00Z")).toISOString()).toBe("2026-11-15T17:00:00.000Z");
  });
});

describe("badges", () => {
  const stats = {
    worksCompleted: 3,
    genresCompleted: 2,
    longestStreak: 7,
    deepAnswers: 0,
    completedWorkIds: new Set(["w1"]),
  };

  it("progress for each rule template", () => {
    expect(badgeProgress({ rule: "WORKS_COMPLETED", threshold: 5, workId: null }, stats)).toEqual({ value: 3, target: 5, earned: false });
    expect(badgeProgress({ rule: "GENRES_COMPLETED", threshold: 2, workId: null }, stats).earned).toBe(true);
    expect(badgeProgress({ rule: "STREAK_DAYS", threshold: 7, workId: null }, stats).earned).toBe(true);
    expect(badgeProgress({ rule: "DEEP_ANSWERS", threshold: 1, workId: null }, stats).earned).toBe(false);
    expect(badgeProgress({ rule: "WORK_COMPLETED", threshold: null, workId: "w1" }, stats).earned).toBe(true);
    expect(badgeProgress({ rule: "WORK_COMPLETED", threshold: null, workId: "w2" }, stats).earned).toBe(false);
  });

  it("captions", () => {
    expect(badgeCaption("STREAK_DAYS", 7)).toBe("7 NGÀY");
    expect(badgeCaption("WORK_COMPLETED", null)).toBeUndefined();
  });
});
