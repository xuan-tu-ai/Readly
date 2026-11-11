import { Prisma } from "@/generated/prisma/client";
import type { Actor, CurrentUser } from "@/lib/roles";
import type { CreateTeacherInput, RegisterStudentInput } from "@/lib/validation";
import { db } from "@/server/db";
import { assertRole, isTeacherOfStudent } from "@/server/authz";
import { DomainError, forbidden, notFound } from "@/server/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { deleteAllSessionsForUser } from "@/server/auth/sessions";
import { findJoinableClass } from "./classes";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function assertEmailFree(email: string) {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new DomainError("EMAIL_TAKEN", "Email này đã được đăng ký.");
}

/** Student self-registration. A valid, active class code is required. */
export async function registerStudent(input: RegisterStudentInput): Promise<CurrentUser> {
  await assertEmailFree(input.email);
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.$transaction(async (tx) => {
      const cls = await findJoinableClass(input.classCode, tx);
      return tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: "STUDENT",
          settings: { create: {} },
          memberships: { create: { classId: cls.id } },
        },
        select: { id: true, name: true, email: true, role: true },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("EMAIL_TAKEN", "Email này đã được đăng ký.");
    }
    throw error;
  }
}

export async function authenticate(email: string, password: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(user.passwordHash, password))) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function createTeacher(actor: Actor, input: CreateTeacherInput) {
  assertRole(actor, "ADMIN");
  await assertEmailFree(input.email);
  return db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "TEACHER",
      settings: { create: {} },
    },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function listTeachers(actor: Actor) {
  assertRole(actor, "ADMIN");
  return db.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { classesTaught: true } },
    },
  });
}

/**
 * Who may reset whose password:
 * - admin → any teacher or student
 * - teacher → students currently in one of their classes
 * The target is signed out of every device afterwards.
 */
export async function resetPassword(actor: Actor, targetUserId: string, newPassword: string) {
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!target) notFound("Không tìm thấy tài khoản.");

  const allowed =
    (actor.role === "ADMIN" && target.role !== "ADMIN") ||
    (actor.role === "TEACHER" &&
      target.role === "STUDENT" &&
      (await isTeacherOfStudent(actor.id, target.id)));
  if (!allowed) forbidden();

  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await deleteAllSessionsForUser(target.id);
}
