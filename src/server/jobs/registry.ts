import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { QUEUES } from "@/server/queue";
import { comparePredictionJob, gradeAnswerJob, markGradingFailedJob } from "@/server/services/questions";

/**
 * Background job definitions, run by the worker process (worker/index.ts)
 * through pg-boss.
 */
export type JobDefinition<T> = {
  name: string;
  schema: z.ZodType<T>;
  handler: (data: T) => Promise<unknown>;
  retryLimit?: number;
  /** Queue that receives the job once retries are exhausted. */
  deadLetter?: string;
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

const answerPayload = z.object({ answerId: z.string().min(1) });

/** AI grading. Retries with exponential backoff (network, quota, malformed JSON). */
export const gradeAnswer: JobDefinition<z.infer<typeof answerPayload>> = {
  name: QUEUES.gradeAnswer,
  schema: answerPayload,
  retryLimit: 5,
  deadLetter: QUEUES.gradeAnswerFailed,
  handler: ({ answerId }) => gradeAnswerJob(answerId),
};

/** Grading gave up: mark the answer FAILED so the student can resubmit for free. */
export const gradeAnswerFailed: JobDefinition<z.infer<typeof answerPayload>> = {
  name: QUEUES.gradeAnswerFailed,
  schema: answerPayload,
  retryLimit: 3,
  handler: ({ answerId }) => markGradingFailedJob(answerId),
};

export const comparePrediction: JobDefinition<z.infer<typeof answerPayload>> = {
  name: QUEUES.comparePrediction,
  schema: answerPayload,
  retryLimit: 5,
  handler: ({ answerId }) => comparePredictionJob(answerId),
};

/** Dead-letter targets first: a queue's deadLetter must exist before the queue. */
// Heterogeneous list: each job validates its own payload with `schema` before `handler` runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const jobs: JobDefinition<any>[] = [pingJob, gradeAnswerFailed, gradeAnswer, comparePrediction];
