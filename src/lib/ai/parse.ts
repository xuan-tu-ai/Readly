import type { z } from "zod";
import { AiRetryableError } from "./types";

/** Some models wrap JSON in a markdown fence even in JSON mode. */
const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/u;

/**
 * Validates model output against the task schema. Empty, malformed or
 * off-contract output is retryable: the next attempt usually succeeds.
 */
export function parseStructured<T>(
  text: string | null | undefined,
  schema: z.ZodType<T>,
  task: string,
  provider = "AI",
): T {
  const trimmed = text?.trim();
  if (!trimmed) throw new AiRetryableError(`${provider} trả về rỗng cho "${task}"`);
  const body = FENCE.exec(trimmed)?.[1] ?? trimmed;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (error) {
    throw new AiRetryableError(`${provider} trả về JSON không hợp lệ cho "${task}"`, { cause: error });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AiRetryableError(`${provider} trả về sai định dạng cho "${task}"`, { cause: parsed.error });
  }
  return parsed.data;
}
