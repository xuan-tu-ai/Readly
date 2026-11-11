import { z } from "zod";
import { getAiProvider } from "@/lib/ai";

/**
 * Background job definitions, run by the worker process (worker/index.ts)
 * through pg-boss. Later phases add: grade-answer, compare-prediction,
 * deadline reminders, push delivery…
 */
export type JobDefinition<T> = {
  name: string;
  schema: z.ZodType<T>;
  handler: (data: T) => Promise<unknown>;
  retryLimit?: number;
};

/** Smoke-test job: proves the worker, the queue and the AI provider are wired up. */
export const pingJob: JobDefinition<{ note?: string }> = {
  name: "system.ping",
  schema: z.object({ note: z.string().optional() }),
  retryLimit: 2,
  async handler(data) {
    const ai = getAiProvider();
    const result = await ai.generateStructured({
      task: "ping",
      system: "Trả về JSON {\"ok\": true}.",
      prompt: data.note ?? "ping",
      schema: z.object({ ok: z.boolean() }),
    });
    return { provider: ai.name, ...result };
  },
};

// Heterogeneous list: each job validates its own payload with `schema` before `handler` runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const jobs: JobDefinition<any>[] = [pingJob];
