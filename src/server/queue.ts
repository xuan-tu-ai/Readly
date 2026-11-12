import { PgBoss } from "pg-boss";

/**
 * Enqueues background jobs from the web app. The app only *sends*; the worker
 * process (worker/index.ts) creates the queues and runs the handlers.
 *
 * Tests swap the sender with `setJobSender` to capture jobs and run handlers
 * directly.
 */

export const QUEUES = {
  gradeAnswer: "answer.grade",
  gradeAnswerFailed: "answer.grade.failed",
  comparePrediction: "prediction.compare",
} as const;

export type JobSender = (queue: string, data: object) => Promise<void>;

const globalForBoss = globalThis as unknown as { __readlyBoss?: Promise<PgBoss> };

function sendOnlyBoss(): Promise<PgBoss> {
  globalForBoss.__readlyBoss ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL chưa được cấu hình");
    // No maintenance or cron in the web process – the worker does that.
    const boss = new PgBoss({ connectionString: url, supervise: false, schedule: false });
    boss.on("error", (error) => console.error("[queue] pg-boss error:", error));
    return boss.start();
  })();
  return globalForBoss.__readlyBoss;
}

let sender: JobSender = async (queue, data) => {
  const boss = await sendOnlyBoss();
  await boss.send(queue, data);
};

export function setJobSender(next: JobSender) {
  sender = next;
}

export function enqueue(queue: string, data: object): Promise<void> {
  return sender(queue, data);
}
