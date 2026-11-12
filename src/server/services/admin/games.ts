import type { Prisma } from "@/generated/prisma/client";
import { getAiProvider } from "@/lib/ai";
import { buildDraftDetailRequest, buildDraftMatchRequest } from "@/lib/ai/drafts";
import type { GameInput } from "@/lib/content/schemas";
import { detailDataSchema, matchDataSchema } from "@/lib/minigames";
import { htmlToText } from "@/lib/reading/html-text";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";

/** Admin: mini games (spec §8.5): authoring, publishing and AI drafts. */

export async function listWorkGames(actor: Actor, workId: string) {
  assertRole(actor, "ADMIN");
  const games = await db.miniGame.findMany({
    where: { workId },
    orderBy: [{ unlockSegment: { order: "asc" } }, { order: "asc" }],
    include: { unlockSegment: { select: { order: true, title: true } }, _count: { select: { plays: true } } },
  });
  return games.map(({ _count, ...g }) => ({ ...g, plays: _count.plays }));
}

export type AdminGame = Awaited<ReturnType<typeof listWorkGames>>[number];

/** Form rows → stored game data, validated with the same schemas the player uses. */
function toData(input: GameInput): Prisma.InputJsonValue {
  if (input.type === "MATCH") {
    const pairs = input.pairs.filter((p) => p.left || p.right).map((p, i) => ({ id: `p${i + 1}`, left: p.left, right: p.right }));
    const parsed = matchDataSchema.safeParse({ pairs });
    if (!parsed.success) throw new DomainError("INVALID_INPUT", "Ghép cặp cần 2–8 cặp, mỗi cặp đủ hai vế.");
    return parsed.data;
  }
  const items = input.items
    .filter((it) => it.text || it.options.some(Boolean))
    .map((it, i) => {
      // Blank option boxes are dropped, so the answer index must follow the kept ones.
      const kept = it.options.map((text, index) => ({ text, index })).filter((o) => o.text);
      return {
        id: `d${i + 1}`,
        text: it.text,
        options: kept.map((o) => o.text),
        answer: kept.findIndex((o) => o.index === it.answer),
        ...(it.explanation ? { explanation: it.explanation } : {}),
      };
    });
  const parsed = detailDataSchema.safeParse({ items });
  if (!parsed.success) {
    throw new DomainError("INVALID_INPUT", "Mỗi câu cần có “___” trong câu, 2–5 lựa chọn và chọn đáp án đúng (1–10 câu).");
  }
  return parsed.data;
}

async function unlockSegmentOf(workId: string, segmentId: string) {
  const segment = await db.segment.findFirst({ where: { id: segmentId, workId, archivedAt: null }, select: { id: true } });
  if (!segment) throw new DomainError("INVALID_INPUT", "Phân đoạn mở khóa không thuộc tác phẩm này.");
  return segment.id;
}

export async function createGame(actor: Actor, workId: string, input: GameInput) {
  assertRole(actor, "ADMIN");
  const unlockSegmentId = await unlockSegmentOf(workId, input.unlockSegmentId);
  const count = await db.miniGame.count({ where: { workId } });
  return db.miniGame.create({
    data: { workId, unlockSegmentId, type: input.type, title: input.title, published: input.published, order: count, data: toData(input) },
    select: { id: true },
  });
}

export async function updateGame(actor: Actor, gameId: string, input: GameInput) {
  assertRole(actor, "ADMIN");
  const game = await db.miniGame.findUnique({ where: { id: gameId }, select: { workId: true, type: true, _count: { select: { plays: true } } } });
  if (!game) notFound("Không tìm thấy mini game.");
  if (game._count.plays > 0 && game.type !== input.type) {
    throw new DomainError("INVALID_INPUT", "Mini game đã có lượt chơi nên không đổi loại được.");
  }
  const unlockSegmentId = await unlockSegmentOf(game.workId, input.unlockSegmentId);
  await db.miniGame.update({
    where: { id: gameId },
    data: { unlockSegmentId, type: input.type, title: input.title, published: input.published, data: toData(input) },
  });
}

/** Games already played keep their record (and points): they can only be unpublished. */
export async function deleteGame(actor: Actor, gameId: string) {
  assertRole(actor, "ADMIN");
  const game = await db.miniGame.findUnique({ where: { id: gameId }, select: { _count: { select: { plays: true } } } });
  if (!game) notFound("Không tìm thấy mini game.");
  if (game._count.plays > 0) throw new DomainError("INVALID_INPUT", "Mini game đã có lượt chơi, không xóa được. Hãy bỏ xuất bản.");
  await db.miniGame.delete({ where: { id: gameId } });
}

/** AI draft for the form; the admin edits it before saving. */
export async function draftGame(actor: Actor, input: { workId: string; segmentId: string; type: "MATCH" | "DETAIL" }) {
  assertRole(actor, "ADMIN");
  const work = await db.work.findUnique({ where: { id: input.workId }, select: { title: true } });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  // The game may only use text up to its unlock segment (no spoilers).
  const unlock = await db.segment.findFirst({ where: { id: input.segmentId, workId: input.workId, archivedAt: null }, select: { order: true } });
  if (!unlock) throw new DomainError("INVALID_INPUT", "Chọn phân đoạn mở khóa trước.");
  const segments = await db.segment.findMany({
    where: { workId: input.workId, archivedAt: null, order: { lte: unlock.order } },
    orderBy: { order: "asc" },
    select: { content: true },
  });
  const text = segments.map((s) => htmlToText(s.content).trim()).join("\n\n");
  try {
    const ai = getAiProvider();
    return input.type === "MATCH"
      ? { type: "MATCH" as const, ...(await ai.generateStructured(buildDraftMatchRequest({ title: work.title, text }))) }
      : { type: "DETAIL" as const, ...(await ai.generateStructured(buildDraftDetailRequest({ title: work.title, text }))) };
  } catch (error) {
    console.error("[ai-draft]", error);
    throw new DomainError("INVALID_INPUT", "AI chưa soạn được lúc này (mạng hoặc hạn mức). Thử lại sau ít phút.");
  }
}
