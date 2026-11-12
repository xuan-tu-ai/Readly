import { vnDay } from "@/lib/reading/active-time";

/**
 * Pure rules for the teacher area (spec §10): deadlines in Vietnam time,
 * per-student progress on an assigned work, class summaries and the
 * highlight heatmap. No database here, so everything is unit-tested.
 */

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// ───────────────────────── Deadlines ─────────────────────────

/**
 * A due date typed by the teacher ("YYYY-MM-DD", a Vietnam calendar day) →
 * the last millisecond of that day in Vietnam. Null for anything invalid.
 */
export function dueAtFromDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const midnight = Date.UTC(year, month - 1, day);
  const check = new Date(midnight);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return new Date(midnight + DAY_MS - VN_OFFSET_MS - 1);
}

/** The Vietnam calendar date of an instant as "YYYY-MM-DD" (value of a date input). */
export function vnDateString(at: Date): string {
  return vnDay(at).toISOString().slice(0, 10);
}

/** Whole Vietnam days from today to the due day: 0 = due today, negative = overdue. */
export function daysUntilDue(dueAt: Date, now: Date): number {
  return Math.round((vnDay(dueAt).getTime() - vnDay(now).getTime()) / DAY_MS);
}

/** "còn 3 ngày", "hạn hôm nay", "quá hạn 2 ngày". */
export function dueLabel(dueAt: Date, now: Date): string {
  const days = daysUntilDue(dueAt, now);
  if (now.getTime() > dueAt.getTime()) return `quá hạn ${Math.max(1, -days)} ngày`;
  if (days === 0) return "hạn hôm nay";
  if (days === 1) return "hạn ngày mai";
  return `còn ${days} ngày`;
}

// ───────────────────────── Class lists ─────────────────────────

const nameCollator = new Intl.Collator("vi", { sensitivity: "base" });

/**
 * Vietnamese class lists sort by given name (the last word), then by the
 * full name: "Trần Minh An" comes before "Lê Thị Bình".
 */
export function compareStudentNames(a: string, b: string): number {
  const given = (name: string) => name.trim().split(/\s+/).at(-1) ?? "";
  return nameCollator.compare(given(a), given(b)) || nameCollator.compare(a, b);
}

// ───────────────────────── Progress ─────────────────────────

export type ProgressStatus = "done" | "reading" | "not-started";

export type WorkProgress = {
  status: ProgressStatus;
  /** Share of segments read, 0–100. */
  percent: number;
  completedAt: Date | null;
  /** Finished, but after the deadline. */
  late: boolean;
  /** Not finished and the deadline has passed. */
  overdue: boolean;
};

export function workProgress(input: {
  totalSegments: number;
  readSegments: number;
  completedAt: Date | null;
  dueAt: Date | null;
  now: Date;
}): WorkProgress {
  const { totalSegments, readSegments, completedAt, dueAt, now } = input;
  const percent = completedAt
    ? 100
    : totalSegments > 0
      ? Math.min(100, Math.round((Math.min(readSegments, totalSegments) * 100) / totalSegments))
      : 0;
  return {
    status: completedAt ? "done" : readSegments > 0 ? "reading" : "not-started",
    percent,
    completedAt,
    late: Boolean(completedAt && dueAt && completedAt.getTime() > dueAt.getTime()),
    overdue: !completedAt && dueAt !== null && now.getTime() > dueAt.getTime(),
  };
}

export type AssignmentSummary = {
  total: number;
  done: number;
  /** Finished on or before the deadline. */
  onTime: number;
  late: number;
  reading: number;
  notStarted: number;
  /** Not finished after the deadline (counted inside reading / notStarted too). */
  overdue: number;
  /** done / total, 0–1 (0 for an empty class). */
  completionRate: number;
};

export function summarizeProgress(rows: WorkProgress[]): AssignmentSummary {
  const count = (pred: (p: WorkProgress) => boolean) => rows.filter(pred).length;
  const done = count((p) => p.status === "done");
  const late = count((p) => p.late);
  return {
    total: rows.length,
    done,
    onTime: done - late,
    late,
    reading: count((p) => p.status === "reading"),
    notStarted: count((p) => p.status === "not-started"),
    overdue: count((p) => p.overdue),
    completionRate: rows.length > 0 ? done / rows.length : 0,
  };
}

/** Short status text for tables and the .xlsx report. */
export function progressText(p: WorkProgress, formatDate: (d: Date) => string): string {
  if (p.status === "done") return `Hoàn thành ${formatDate(p.completedAt!)}${p.late ? " (trễ hạn)" : ""}`;
  if (p.status === "reading") return `Đang đọc ${p.percent}%${p.overdue ? " – quá hạn" : ""}`;
  return p.overdue ? "Chưa đọc – quá hạn" : "Chưa đọc";
}

// ───────────────────────── Highlight heatmap ─────────────────────────

export type HeatRange = { start: number; end: number; userId: string };
export type HeatRun = { start: number; end: number; count: number };

/**
 * Splits a segment's text [0, length) into runs by how many *different*
 * students highlighted each character (one student highlighting the same
 * words twice still counts once). Adjacent runs with equal counts merge.
 */
export function heatRuns(length: number, ranges: HeatRange[]): HeatRun[] {
  if (length <= 0) return [];
  const clamped = ranges
    .map((r) => ({ ...r, start: Math.max(0, Math.min(r.start, length)), end: Math.max(0, Math.min(r.end, length)) }))
    .filter((r) => r.end > r.start);
  const cuts = [...new Set([0, length, ...clamped.flatMap((r) => [r.start, r.end])])].sort((a, b) => a - b);

  const runs: HeatRun[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i], cuts[i + 1]];
    const users = new Set(clamped.filter((r) => r.start <= start && r.end >= end).map((r) => r.userId));
    const last = runs.at(-1);
    if (last && last.count === users.size) last.end = end;
    else runs.push({ start, end, count: users.size });
  }
  return runs;
}

export type HeatPassage = { start: number; end: number; quote: string; students: number; peak: number };

/**
 * Highlighted stretches of a segment (maximal runs with at least one student),
 * ranked by how many students touched them, then by peak overlap.
 */
export function heatPassages(text: string, ranges: HeatRange[], limit = 5): HeatPassage[] {
  const runs = heatRuns(text.length, ranges);
  const passages: HeatPassage[] = [];
  let current: { start: number; end: number; peak: number } | null = null;
  const flush = () => {
    if (!current) return;
    const { start, end, peak } = current;
    const students = new Set(ranges.filter((r) => r.start < end && r.end > start).map((r) => r.userId)).size;
    passages.push({ start, end, quote: text.slice(start, end).trim(), students, peak });
    current = null;
  };
  for (const run of runs) {
    if (run.count === 0) flush();
    else if (current) {
      current.end = run.end;
      current.peak = Math.max(current.peak, run.count);
    } else current = { start: run.start, end: run.end, peak: run.count };
  }
  flush();
  return passages
    .filter((p) => p.quote.length > 0)
    .sort((a, b) => b.students - a.students || b.peak - a.peak || a.start - b.start)
    .slice(0, limit);
}
