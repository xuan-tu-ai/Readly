import { execFileSync } from "node:child_process";
import path from "node:path";

/** Brings the test database schema up to date before any test runs. */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://readly:readly@localhost:5433/readly_test";
  const prismaBin = path.resolve("node_modules/prisma/build/index.js");
  execFileSync(process.execPath, [prismaBin, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
