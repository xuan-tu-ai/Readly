import { starsFor } from "@/lib/gamification";
import { publicView, scoreGame, type GameAnswers, type GameReview, type PublicGame } from "@/lib/minigames";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { evaluateBadges, recordActivity, syncGamePoints } from "./gamification";

/**
 * Mini games (spec §8.5): each opens once its segment has been read, so it
 * never spoils what comes after. Answers stay on the server; points follow
 * the best play (only the improvement is added when a record is broken).
 */

const gameWhere = (gameId: string) => ({ id: gameId, published: true, work: { status: "PUBLISHED" as const } });

async function bestPlay(userId: string, gameId: string) {
  const plays = await db.miniGamePlay.findMany({ where: { userId, gameId }, select: { correct: true, total: true } });
  return plays.reduce<{ correct: number; total: number } | null>(
    (top, p) => (!top || p.correct / p.total > top.correct / top.total ? p : top),
    null,
  );
}

export type WorkGame = {
  id: string;
  title: string;
  type: "MATCH" | "DETAIL";
  unlockSegmentId: string;
  unlockSegmentTitle: string;
  unlocked: boolean;
  bestStars: number | null;
};

/** The work's published games with lock state and this student's best stars. */
export async function listWorkGames(userId: string, workId: string): Promise<WorkGame[]> {
  const games = await db.miniGame.findMany({
    where: { workId, published: true, unlockSegment: { archivedAt: null } },
    orderBy: [{ unlockSegment: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      unlockSegmentId: true,
      unlockSegment: { select: { title: true, order: true, reads: { where: { userId }, select: { userId: true } } } },
      plays: { where: { userId }, select: { correct: true, total: true } },
    },
  });
  return games.map((g) => ({
    id: g.id,
    title: g.title,
    type: g.type,
    unlockSegmentId: g.unlockSegmentId,
    unlockSegmentTitle: g.unlockSegment.title ?? `Phần ${g.unlockSegment.order}`,
    unlocked: g.unlockSegment.reads.length > 0,
    bestStars: g.plays.length ? Math.max(...g.plays.map((p) => starsFor(p.correct, p.total))) : null,
  }));
}

async function loadUnlockedGame(userId: string, gameId: string) {
  const game = await db.miniGame.findFirst({
    where: gameWhere(gameId),
    select: {
      id: true,
      title: true,
      type: true,
      data: true,
      work: { select: { id: true, slug: true, title: true } },
      unlockSegment: { select: { id: true, title: true, order: true, archivedAt: true } },
    },
  });
  if (!game || game.unlockSegment.archivedAt) notFound("Không tìm thấy mini game.");
  const read = await db.segmentRead.findUnique({
    where: { userId_segmentId: { userId, segmentId: game.unlockSegment.id } },
  });
  if (!read) {
    const segment = game.unlockSegment.title ?? `Phần ${game.unlockSegment.order}`;
    throw new DomainError("FORBIDDEN", `Đọc xong "${segment}" để mở mini game này.`);
  }
  return game;
}

export type PlayableGame = {
  id: string;
  title: string;
  work: { slug: string; title: string };
  game: PublicGame;
  bestStars: number | null;
};

export async function getGameForPlay(actor: Actor, gameId: string): Promise<PlayableGame> {
  assertRole(actor, "STUDENT");
  const game = await loadUnlockedGame(actor.id, gameId);
  const best = await bestPlay(actor.id, gameId);
  return {
    id: game.id,
    title: game.title,
    work: { slug: game.work.slug, title: game.work.title },
    game: publicView(game.id, game.type, game.data),
    bestStars: best ? starsFor(best.correct, best.total) : null,
  };
}

export type PlayResult = GameReview & { stars: number; pointsAdded: number; newRecord: boolean };

export async function playGame(actor: Actor, gameId: string, answers: GameAnswers): Promise<PlayResult> {
  assertRole(actor, "STUDENT");
  const game = await loadUnlockedGame(actor.id, gameId);
  const previous = await bestPlay(actor.id, gameId);
  const review = scoreGame(game.type, game.data, answers);

  await db.miniGamePlay.create({
    data: { userId: actor.id, gameId, correct: review.correct, total: review.total },
  });
  const pointsAdded = await syncGamePoints(actor.id, gameId);
  await recordActivity(actor.id);
  await evaluateBadges(actor.id);

  return {
    ...review,
    stars: starsFor(review.correct, review.total),
    pointsAdded,
    newRecord: !previous || review.correct / review.total > previous.correct / previous.total,
  };
}
