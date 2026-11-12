"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { gameAnswersSchema } from "@/lib/minigames";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import {
  acknowledgeCelebrations,
  getCelebrations,
  getPlayer,
  setLeaderboardEnabled,
  type Celebrations,
} from "@/server/services/gamification";
import { playGame, type PlayResult } from "@/server/services/minigames";
import type { ActionResult } from "./reading";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

/** The student has seen the pending celebrations (new badges, level-up). */
export async function acknowledgeCelebrationsAction(): Promise<ActionResult<null>> {
  const user = await requireUser("STUDENT");
  return run(async () => {
    await acknowledgeCelebrations(user);
    return null;
  });
}

const playSchema = z.object({ gameId: z.string().min(1), answers: gameAnswersSchema });

export type PlayGameResult = PlayResult & { points: number; celebrations: Celebrations };

export async function playGameAction(input: unknown): Promise<ActionResult<PlayGameResult>> {
  const user = await requireUser("STUDENT");
  const parsed = playSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ." };
  return run(async () => {
    const result = await playGame(user, parsed.data.gameId, parsed.data.answers);
    const [player, celebrations] = await Promise.all([getPlayer(user.id), getCelebrations(user.id)]);
    return { ...result, points: player.points, celebrations };
  });
}

/** Teacher turns the weekly leaderboard of a class on or off (form action). */
export async function setLeaderboardAction(formData: FormData): Promise<void> {
  const user = await requireUser("TEACHER");
  const classId = formData.get("classId");
  if (typeof classId !== "string" || !classId) return;
  await setLeaderboardEnabled(user, classId, formData.get("enabled") === "true");
  refresh();
}
