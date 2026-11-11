"use server";

import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import {
  createHighlight,
  createHighlightSchema,
  deleteHighlight,
  readingSettingsSchema,
  updateHighlight,
  updateHighlightSchema,
  updateReadingSettings,
  type OwnHighlight,
} from "@/server/services/reading";

/** Result shape for the reader's client-side calls. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}

const INVALID = { ok: false, error: "Dữ liệu không hợp lệ." } as const;

export async function createHighlightAction(input: unknown): Promise<ActionResult<OwnHighlight>> {
  const user = await requireUser("STUDENT");
  const parsed = createHighlightSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  return run(() => createHighlight(user, parsed.data));
}

export async function updateHighlightAction(input: unknown): Promise<ActionResult<OwnHighlight>> {
  const user = await requireUser("STUDENT");
  const parsed = updateHighlightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID.error };
  return run(() => updateHighlight(user, parsed.data));
}

export async function deleteHighlightAction(id: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("STUDENT");
  if (typeof id !== "string" || !id) return INVALID;
  return run(async () => {
    await deleteHighlight(user, id);
    return null;
  });
}

export async function updateReadingSettingsAction(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = readingSettingsSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  return run(async () => {
    await updateReadingSettings(user, parsed.data);
    return null;
  });
}
