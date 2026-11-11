import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Role } from "@/generated/prisma/enums";
import { homePathFor, type CurrentUser } from "@/lib/roles";
import { readSessionToken } from "./cookie";
import { getUserBySessionToken } from "./sessions";

/**
 * Data Access Layer entry point: the only place that turns the session cookie
 * into a user. Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  // The expiry check compares against the current time: request-time only.
  await connection();
  return getUserBySessionToken(token);
});

/**
 * Use at the top of every protected page and server action.
 * Not signed in → /login. Wrong role → the user's own home.
 */
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length > 0 && !roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}
