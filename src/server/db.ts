import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaClient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL chưa được cấu hình");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const globalForPrisma = globalThis as unknown as { __readlyPrisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.__readlyPrisma) {
    globalForPrisma.__readlyPrisma = createPrismaClient();
  }
  return globalForPrisma.__readlyPrisma;
}

/**
 * Lazily-created shared Prisma client. Lazy so that importing this module
 * (e.g. during `next build`) does not require DATABASE_URL.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
