import { z } from "zod";
import type { MiniGameType } from "@/generated/prisma/enums";

/**
 * Mini games (spec §8.5). The stored data holds the answers; students only
 * ever receive the "public" view, and the server scores submissions.
 *
 * - MATCH ("Ghép nhân vật – sự kiện"): pair each character with an event.
 * - DETAIL ("Đoán chi tiết"): pick the missing detail ("___") in a sentence.
 */

export const MINI_GAME_LABEL: Record<MiniGameType, string> = {
  MATCH: "Ghép nhân vật – sự kiện",
  DETAIL: "Đoán chi tiết",
};

export const matchDataSchema = z.object({
  pairs: z
    .array(z.object({ id: z.string().min(1), left: z.string().min(1), right: z.string().min(1) }))
    .min(2)
    .max(8),
});

export const detailDataSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().includes("___"),
        options: z.array(z.string().min(1)).min(2).max(5),
        answer: z.number().int().min(0),
        explanation: z.string().optional(),
      }),
    )
    .min(1)
    .max(10)
    .refine((items) => items.every((i) => i.answer < i.options.length), "Đáp án nằm ngoài danh sách lựa chọn."),
});

export type MatchData = z.infer<typeof matchDataSchema>;
export type DetailData = z.infer<typeof detailDataSchema>;

export type PublicMatch = {
  type: "MATCH";
  lefts: { id: string; text: string }[];
  rights: { id: string; text: string }[];
};
export type PublicDetail = {
  type: "DETAIL";
  items: { id: string; text: string; options: string[] }[];
};
export type PublicGame = PublicMatch | PublicDetail;

/** Deterministic shuffle (seeded by a string) so a game looks the same on reload. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function parseGameData(type: MiniGameType, data: unknown): MatchData | DetailData {
  return type === "MATCH" ? matchDataSchema.parse(data) : detailDataSchema.parse(data);
}

/** What the student sees: no answers. Right-hand cards are shuffled per game. */
export function publicView(gameId: string, type: MiniGameType, data: unknown): PublicGame {
  if (type === "MATCH") {
    const { pairs } = matchDataSchema.parse(data);
    let rights = seededShuffle(
      pairs.map((p) => ({ id: p.id, text: p.right })),
      gameId,
    );
    // Never show the right column already in the correct order.
    if (rights.every((r, i) => r.id === pairs[i].id)) rights = [...rights.slice(1), rights[0]];
    return { type, lefts: pairs.map((p) => ({ id: p.id, text: p.left })), rights };
  }
  const { items } = detailDataSchema.parse(data);
  return { type, items: items.map(({ id, text, options }) => ({ id, text, options })) };
}

/** Student answers: MATCH maps left id → right id; DETAIL maps item id → option index. */
export const gameAnswersSchema = z.record(z.string(), z.union([z.string(), z.number().int()]));
export type GameAnswers = z.infer<typeof gameAnswersSchema>;

export type GameReview = {
  correct: number;
  total: number;
  /** Per item/pair: was it right, and the right answer (shown after playing). */
  results: { id: string; correct: boolean; answer: string; explanation?: string }[];
};

export function scoreGame(type: MiniGameType, data: unknown, answers: GameAnswers): GameReview {
  if (type === "MATCH") {
    const { pairs } = matchDataSchema.parse(data);
    const results = pairs.map((p) => ({ id: p.id, correct: answers[p.id] === p.id, answer: p.right }));
    return { correct: results.filter((r) => r.correct).length, total: pairs.length, results };
  }
  const { items } = detailDataSchema.parse(data);
  const results = items.map((item) => ({
    id: item.id,
    correct: answers[item.id] === item.answer,
    answer: item.options[item.answer],
    explanation: item.explanation,
  }));
  return { correct: results.filter((r) => r.correct).length, total: items.length, results };
}
