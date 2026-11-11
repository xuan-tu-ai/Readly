import { z } from "zod";
import type { Genre, WorkStatus } from "@/generated/prisma/enums";

export const GENRES = ["THO", "TRUYEN_NGAN", "TIEU_THUYET", "KICH", "KI", "NGHI_LUAN"] as const satisfies readonly Genre[];

export const GENRE_LABEL: Record<Genre, string> = {
  THO: "Thơ",
  TRUYEN_NGAN: "Truyện ngắn",
  TIEU_THUYET: "Tiểu thuyết",
  KICH: "Kịch",
  KI: "Kí",
  NGHI_LUAN: "Nghị luận",
};

export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Dễ", 2: "Vừa", 3: "Khó" };

export function difficultyLabel(value: number): string {
  return DIFFICULTY_LABEL[value as Difficulty] ?? "—";
}

/** Reading-time buckets used by both the library filter and the interest quiz. */
export const LENGTHS = ["short", "medium", "long"] as const;
export type LengthBucket = (typeof LENGTHS)[number];

export const LENGTH_LABEL: Record<LengthBucket, string> = {
  short: "Ngắn (≤ 20 phút)",
  medium: "Vừa (21–60 phút)",
  long: "Dài (> 60 phút)",
};

export const LENGTH_RANGE: Record<LengthBucket, { min: number; max: number | null }> = {
  short: { min: 0, max: 20 },
  medium: { min: 21, max: 60 },
  long: { min: 61, max: null },
};

export function lengthBucket(estMinutes: number): LengthBucket {
  if (estMinutes <= LENGTH_RANGE.short.max!) return "short";
  if (estMinutes <= LENGTH_RANGE.medium.max!) return "medium";
  return "long";
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/** Statuses a student can see in the library. */
export const VISIBLE_STATUSES = ["PUBLISHED", "COMING_SOON"] as const satisfies readonly WorkStatus[];

/**
 * Lower-case and strip Vietnamese diacritics (including đ) so "tac pham"
 * matches "Tác phẩm".
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function workSearchText(work: { title: string; author: string }): string {
  return normalizeSearch(`${work.title} ${work.author}`);
}

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === "all" ? undefined : v), z.enum(values).optional()).catch(undefined);

/** Library filters from URL search params. Invalid values are ignored, never an error. */
export const libraryFilterSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v : undefined)),
  genre: optionalEnum(GENRES),
  length: optionalEnum(LENGTHS),
  difficulty: z
    .preprocess((v) => (v === "" || v === "all" || v === undefined ? undefined : Number(v)), z.union([z.literal(1), z.literal(2), z.literal(3)]).optional())
    .catch(undefined),
});

export type LibraryFilters = Partial<z.infer<typeof libraryFilterSchema>>;

export function parseLibraryFilters(params: Record<string, string | string[] | undefined>): LibraryFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return libraryFilterSchema.parse({
    q: first(params.q),
    genre: first(params.genre),
    length: first(params.length),
    difficulty: first(params.difficulty),
  });
}
