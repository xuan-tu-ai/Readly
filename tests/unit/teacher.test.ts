import { describe, expect, it } from "vitest";
import {
  compareStudentNames,
  daysUntilDue,
  dueAtFromDate,
  dueLabel,
  heatPassages,
  heatRuns,
  progressText,
  summarizeProgress,
  vnDateString,
  workProgress,
} from "@/lib/teacher";
import { formatDate, formatDateTime, formatDayMonth, formatTimeDayMonth } from "@/lib/vn-date";

describe("deadlines (Vietnam time)", () => {
  it("ends the due day at 23:59:59.999 in Vietnam", () => {
    expect(dueAtFromDate("2026-11-20")?.toISOString()).toBe("2026-11-20T16:59:59.999Z");
  });

  it("rejects malformed or impossible dates", () => {
    expect(dueAtFromDate("2026-02-30")).toBeNull();
    expect(dueAtFromDate("20/11/2026")).toBeNull();
    expect(dueAtFromDate("")).toBeNull();
  });

  it("round-trips the date input value", () => {
    const dueAt = dueAtFromDate("2026-11-20")!;
    expect(vnDateString(dueAt)).toBe("2026-11-20");
    // 23:30 on the 19th in Vietnam is still the 19th there (16:30 UTC).
    expect(vnDateString(new Date("2026-11-19T16:30:00Z"))).toBe("2026-11-19");
    expect(vnDateString(new Date("2026-11-19T17:30:00Z"))).toBe("2026-11-20");
  });

  it("counts calendar days in Vietnam, not 24-hour blocks", () => {
    const dueAt = dueAtFromDate("2026-11-20")!;
    expect(daysUntilDue(dueAt, new Date("2026-11-19T23:00:00Z"))).toBe(0); // already the 20th in Vietnam
    expect(daysUntilDue(dueAt, new Date("2026-11-17T01:00:00Z"))).toBe(3);
    expect(dueLabel(dueAt, new Date("2026-11-19T23:00:00Z"))).toBe("hạn hôm nay");
    expect(dueLabel(dueAt, new Date("2026-11-19T10:00:00Z"))).toBe("hạn ngày mai");
    expect(dueLabel(dueAt, new Date("2026-11-22T10:00:00Z"))).toBe("quá hạn 2 ngày");
    // One minute after the deadline is already overdue.
    expect(dueLabel(dueAt, new Date("2026-11-20T17:00:30Z"))).toBe("quá hạn 1 ngày");
  });
});

describe("Vietnam date text", () => {
  it("formats in Vietnam time with a fixed shape", () => {
    // 17:30 UTC on the 15th is already 00:30 on the 16th in Vietnam.
    const at = new Date("2026-11-15T17:30:00Z");
    expect(formatDayMonth(at)).toBe("16/11");
    expect(formatDate(at)).toBe("16/11/2026");
    expect(formatTimeDayMonth(at)).toBe("00:30 16/11");
    expect(formatDateTime(at)).toBe("00:30 16/11/2026");
  });
});

describe("compareStudentNames", () => {
  it("sorts by given name first, the way Vietnamese class lists do", () => {
    const names = ["Lê Thị Bình", "Trần Minh An", "Nguyễn Văn An", "Phạm Đức Anh"];
    expect([...names].sort(compareStudentNames)).toEqual([
      "Nguyễn Văn An",
      "Trần Minh An",
      "Phạm Đức Anh",
      "Lê Thị Bình",
    ]);
  });
});

describe("workProgress", () => {
  const dueAt = new Date("2026-11-20T16:59:59.999Z");
  const before = new Date("2026-11-18T08:00:00Z");
  const after = new Date("2026-11-21T08:00:00Z");

  it("classifies not started, reading and done", () => {
    expect(workProgress({ totalSegments: 5, readSegments: 0, completedAt: null, dueAt, now: before })).toMatchObject({
      status: "not-started",
      percent: 0,
      overdue: false,
    });
    expect(workProgress({ totalSegments: 5, readSegments: 2, completedAt: null, dueAt, now: before })).toMatchObject({
      status: "reading",
      percent: 40,
    });
    expect(workProgress({ totalSegments: 5, readSegments: 5, completedAt: before, dueAt, now: after })).toMatchObject({
      status: "done",
      percent: 100,
      late: false,
      overdue: false,
    });
  });

  it("all segments read but questions owed is still reading", () => {
    const p = workProgress({ totalSegments: 5, readSegments: 5, completedAt: null, dueAt, now: before });
    expect(p.status).toBe("reading");
    expect(p.percent).toBe(100);
  });

  it("flags overdue and late work", () => {
    expect(workProgress({ totalSegments: 5, readSegments: 3, completedAt: null, dueAt, now: after }).overdue).toBe(true);
    const late = workProgress({ totalSegments: 5, readSegments: 5, completedAt: after, dueAt, now: after });
    expect(late).toMatchObject({ late: true, overdue: false });
  });

  it("works without a deadline (free reading)", () => {
    expect(workProgress({ totalSegments: 4, readSegments: 1, completedAt: null, dueAt: null, now: after })).toMatchObject({
      overdue: false,
      percent: 25,
    });
  });

  it("summarises a class", () => {
    const rows = [
      workProgress({ totalSegments: 5, readSegments: 5, completedAt: before, dueAt, now: after }),
      workProgress({ totalSegments: 5, readSegments: 5, completedAt: after, dueAt, now: after }),
      workProgress({ totalSegments: 5, readSegments: 2, completedAt: null, dueAt, now: after }),
      workProgress({ totalSegments: 5, readSegments: 0, completedAt: null, dueAt, now: after }),
    ];
    expect(summarizeProgress(rows)).toEqual({
      total: 4,
      done: 2,
      onTime: 1,
      late: 1,
      reading: 1,
      notStarted: 1,
      overdue: 2,
      completionRate: 0.5,
    });
    expect(summarizeProgress([]).completionRate).toBe(0);
  });

  it("writes report text", () => {
    const fmt = (d: Date) => vnDateString(d);
    expect(progressText(rowsFor("done-late"), fmt)).toBe("Hoàn thành 2026-11-21 (trễ hạn)");
    expect(progressText(rowsFor("reading-overdue"), fmt)).toBe("Đang đọc 40% – quá hạn");
    expect(progressText(rowsFor("not-started"), fmt)).toBe("Chưa đọc");
  });

  function rowsFor(kind: "done-late" | "reading-overdue" | "not-started") {
    if (kind === "done-late") return workProgress({ totalSegments: 5, readSegments: 5, completedAt: after, dueAt, now: after });
    if (kind === "reading-overdue") return workProgress({ totalSegments: 5, readSegments: 2, completedAt: null, dueAt, now: after });
    return workProgress({ totalSegments: 5, readSegments: 0, completedAt: null, dueAt, now: before });
  }
});

describe("highlight heatmap", () => {
  it("counts distinct students per character and merges equal runs", () => {
    const runs = heatRuns(20, [
      { start: 0, end: 10, userId: "a" },
      { start: 5, end: 15, userId: "b" },
      { start: 6, end: 8, userId: "a" }, // same student again: no extra weight
    ]);
    expect(runs).toEqual([
      { start: 0, end: 5, count: 1 },
      { start: 5, end: 10, count: 2 },
      { start: 10, end: 15, count: 1 },
      { start: 15, end: 20, count: 0 },
    ]);
  });

  it("clamps ranges to the text and ignores empty ones", () => {
    expect(heatRuns(10, [{ start: 8, end: 40, userId: "a" }, { start: 3, end: 3, userId: "b" }])).toEqual([
      { start: 0, end: 8, count: 0 },
      { start: 8, end: 10, count: 1 },
    ]);
    expect(heatRuns(0, [{ start: 0, end: 2, userId: "a" }])).toEqual([]);
  });

  it("ranks passages by how many students touched them", () => {
    const text = "Một câu đầu. Câu thứ hai rất hay. Câu ba.";
    const passages = heatPassages(text, [
      { start: 13, end: 33, userId: "a" },
      { start: 13, end: 33, userId: "b" },
      { start: 20, end: 33, userId: "c" },
      { start: 0, end: 12, userId: "a" },
    ]);
    expect(passages.map((p) => [p.quote, p.students, p.peak])).toEqual([
      ["Câu thứ hai rất hay.", 3, 3],
      ["Một câu đầu.", 1, 1],
    ]);
  });
});
