import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";
import type { CurrentUser } from "@/lib/roles";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash of the token is stored, so DB rows cannot be used as cookies. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, now = new Date()) {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: hashSessionToken(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

export async function getUserBySessionToken(
  token: string,
  now = new Date(),
): Promise<CurrentUser | null> {
  const session = await db.session.findUnique({
    where: { id: hashSessionToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: hashSessionToken(token) } });
}

/** Signs a user out everywhere, e.g. after a password reset. */
export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
