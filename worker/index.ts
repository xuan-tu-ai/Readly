/**
 * Background worker: runs pg-boss queues (AI grading, reminders, push… in
 * later phases). Start with `npm run worker`.
 */
import "dotenv/config";
import { PgBoss } from "pg-boss";
import { jobs } from "@/server/jobs/registry";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL chưa được cấu hình");

  const boss = new PgBoss(connectionString);
  boss.on("error", (error) => console.error("[worker] pg-boss error:", error));
  await boss.start();

  for (const job of jobs) {
    await boss.createQueue(job.name, { retryLimit: job.retryLimit ?? 3, retryBackoff: true });
    await boss.work(job.name, async ([incoming]) => {
      const data = job.schema.parse(incoming.data);
      const result = await job.handler(data);
      console.log(`[worker] ${job.name} ${incoming.id} xong`, result ?? "");
      return result;
    });
  }
  console.log(`[worker] sẵn sàng · hàng đợi: ${jobs.map((j) => j.name).join(", ")}`);

  if (process.argv.includes("--ping")) {
    const id = await boss.send("system.ping", { note: "khởi động" });
    console.log(`[worker] đã gửi system.ping (${id})`);
  }

  const shutdown = async () => {
    console.log("[worker] đang dừng…");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
