import { daysUntilDue } from "@/lib/teacher";

/**
 * Pure rules for class discussions (spec §7) and deadline reminders
 * (spec §11). No database here, so everything is unit-tested.
 */

export const POST_MAX = 2000;
export const REPLY_MAX = 1000;
export const REPORT_REASON_MAX = 300;

export const POST_TYPE_LABEL = { QUESTION: "Câu hỏi", REFLECTION: "Cảm nhận" } as const;
export type PostTypeKey = keyof typeof POST_TYPE_LABEL;

// ───────────────────────── Banned words ─────────────────────────

/**
 * Simple word filter that blocks a post before it is published (spec §7).
 * Words keep their Vietnamese diacritics on purpose: stripping accents would
 * turn harmless words ("lớn", "đi", "dở") into matches. A few common
 * accent-free abbreviations are listed separately. The list is a starting
 * point (spec §17 leaves it open) and can grow without code changes elsewhere.
 */
export const BANNED_WORDS = [
  "địt",
  "đụ",
  "đéo",
  "cặc",
  "lồn",
  "buồi",
  "đĩ",
  "óc chó",
  "đồ chó",
  "con chó má",
  "vãi lồn",
  "đm",
  "đmm",
  "dm",
  "dmm",
  "đcm",
  "dcm",
  "vcl",
  "vkl",
  "clm",
  "fuck",
  "shit",
  "bitch",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole words only: not preceded or followed by a letter or digit.
const BANNED = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${BANNED_WORDS.map((w) => escape(w).replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);

/** The first banned word found in `text`, or null. */
export function findBannedWord(text: string): string | null {
  return BANNED.exec(text.normalize("NFC").toLowerCase())?.[0] ?? null;
}

// ───────────────────────── Sorting ─────────────────────────

export const POST_SORTS = ["new", "top"] as const;
export type PostSort = (typeof POST_SORTS)[number];

type Sortable = { pinned: boolean; likes: number; replies: number; createdAt: Date };

/**
 * Pinned posts first. "Mới nhất": newest first. "Nổi bật": most likes, then
 * most replies, then newest.
 */
export function comparePosts(sort: PostSort) {
  return (a: Sortable, b: Sortable) =>
    Number(b.pinned) - Number(a.pinned) ||
    (sort === "top" ? b.likes - a.likes || b.replies - a.replies : 0) ||
    b.createdAt.getTime() - a.createdAt.getTime();
}

// ───────────────────────── Deadline reminders ─────────────────────────

/** Reminders go out 2 days and 1 day before the deadline (spec §11). */
export const DEADLINE_STAGES = [2, 1] as const;
/** Not before 07:00 in Vietnam, so nobody is pinged at midnight. */
export const REMINDER_EARLIEST_HOUR = 7;

/**
 * Which automatic reminder is due for a deadline right now: 2, 1, or null.
 * The cron job runs hourly; a dedupe key makes each stage go out once.
 */
export function deadlineStage(dueAt: Date, now: Date): 2 | 1 | null {
  if (now.getTime() >= dueAt.getTime()) return null;
  const hour = new Date(now.getTime() + 7 * 3_600_000).getUTCHours();
  if (hour < REMINDER_EARLIEST_HOUR) return null;
  const days = daysUntilDue(dueAt, now);
  return days === 2 || days === 1 ? days : null;
}
