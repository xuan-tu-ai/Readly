import type { z } from "zod";

/**
 * One structured call to the model. Every AI feature (grading answers,
 * comparing predictions, drafting questions…) is a `task` with a zod schema
 * describing the JSON it must return.
 *
 * Prompts carry only literary content, questions, rubrics and answer text –
 * never names, emails or user IDs.
 */
export type StructuredRequest<T> = {
  /** Stable identifier, e.g. "grade-answer". Used for logging and by the mock provider. */
  task: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
};

export interface AiProvider {
  readonly name: "gemini" | "mock";
  generateStructured<T>(request: StructuredRequest<T>): Promise<T>;
}

/** Temporary failure (network, quota, malformed output) – the job queue should retry. */
export class AiRetryableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiRetryableError";
  }
}

/** Misconfiguration – retrying will not help. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}
