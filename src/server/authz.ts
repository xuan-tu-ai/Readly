import type { Role } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/roles";
import { db } from "@/server/db";
import { forbidden, notFound } from "@/server/errors";

/**
 * Authorization rules. Every service function that reads or changes another
 * user's data goes through one of these checks, close to the data.
 */

export function assertRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) forbidden();
}

/** A teacher may see a student only while the student is an active member of one of the teacher's classes. */
export async function isTeacherOfStudent(teacherId: string, studentId: string): Promise<boolean> {
  const membership = await db.classMembership.findFirst({
    where: { studentId, leftAt: null, class: { teacherId } },
    select: { id: true },
  });
  return membership !== null;
}

export async function assertTeacherOfStudent(actor: Actor, studentId: string): Promise<void> {
  assertRole(actor, "TEACHER");
  if (!(await isTeacherOfStudent(actor.id, studentId))) {
    forbidden("Học sinh này không thuộc lớp của bạn.");
  }
}

export async function assertTeacherOfClass(actor: Actor, classId: string) {
  assertRole(actor, "TEACHER");
  const cls = await db.class.findUnique({ where: { id: classId } });
  if (!cls) notFound("Không tìm thấy lớp.");
  if (cls.teacherId !== actor.id) forbidden("Đây không phải lớp của bạn.");
  return cls;
}
