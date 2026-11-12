import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/roles";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";

/** Runs an admin read model; a missing work shows the 404 page. */
export async function loadForAdmin<T>(load: (user: CurrentUser) => Promise<T>): Promise<T> {
  const user = await requireUser("ADMIN");
  try {
    return await load(user);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
}
