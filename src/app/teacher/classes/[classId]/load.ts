import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/roles";
import { requireUser } from "@/server/auth/dal";
import { assertTeacherOfClass } from "@/server/authz";
import { DomainError } from "@/server/errors";

/**
 * Runs a teacher read model for a class page. A DomainError (another
 * teacher's class, a student who left) shows the 404 page, so a teacher can't
 * tell someone else's class from a missing one.
 */
export async function loadForTeacher<T>(load: (user: CurrentUser) => Promise<T>): Promise<T> {
  const user = await requireUser("TEACHER");
  try {
    return await load(user);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
}

export function loadClass(classId: string) {
  return loadForTeacher(async (user) => ({ user, cls: await assertTeacherOfClass(user, classId) }));
}
