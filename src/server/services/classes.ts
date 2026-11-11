import { randomInt } from "node:crypto";
import type { Actor } from "@/lib/roles";
import { CLASS_CODE_LENGTH } from "@/lib/validation";
import { db, type Tx } from "@/server/db";
import { assertRole, assertTeacherOfClass } from "@/server/authz";
import { DomainError } from "@/server/errors";

// No 0/O, 1/I/L to avoid misreading codes written on a board.
export const CLASS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateClassCode(random: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < CLASS_CODE_LENGTH; i++) {
    code += CLASS_CODE_ALPHABET[random(CLASS_CODE_ALPHABET.length)];
  }
  return code;
}

async function uniqueClassCode(client: Tx | typeof db = db): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateClassCode();
    const taken = await client.class.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new DomainError("CODE_GENERATION_FAILED", "Không tạo được mã lớp, vui lòng thử lại.");
}

/** Finds a class that currently accepts new students. */
export async function findJoinableClass(code: string, client: Tx | typeof db = db) {
  const cls = await client.class.findUnique({ where: { code } });
  if (!cls || !cls.codeActive) {
    throw new DomainError("CLASS_CODE_INVALID", "Mã lớp không đúng hoặc đã bị khóa.");
  }
  return cls;
}

export async function createClass(actor: Actor, name: string) {
  assertRole(actor, "TEACHER");
  const code = await uniqueClassCode();
  return db.class.create({ data: { name, code, teacherId: actor.id } });
}

export async function listTeacherClasses(actor: Actor) {
  assertRole(actor, "TEACHER");
  const classes = await db.class.findMany({
    where: { teacherId: actor.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: { where: { leftAt: null } } } } },
  });
  return classes.map(({ _count, ...cls }) => ({ ...cls, studentCount: _count.memberships }));
}

export async function getClassRoster(actor: Actor, classId: string) {
  const cls = await assertTeacherOfClass(actor, classId);
  const memberships = await db.classMembership.findMany({
    where: { classId, leftAt: null },
    orderBy: { student: { name: "asc" } },
    select: {
      joinedAt: true,
      student: { select: { id: true, name: true, email: true } },
    },
  });
  return {
    class: cls,
    students: memberships.map((m) => ({ ...m.student, joinedAt: m.joinedAt })),
  };
}

export async function getActiveClass(studentId: string) {
  const membership = await db.classMembership.findFirst({
    where: { studentId, leftAt: null },
    select: {
      joinedAt: true,
      class: { select: { id: true, name: true, teacher: { select: { name: true } } } },
    },
  });
  return membership ? { ...membership.class, joinedAt: membership.joinedAt } : null;
}

/**
 * Student enters a new class code. Personal data (progress, points, badges,
 * highlights) is tied to the user, so it stays; only the membership changes.
 */
export async function joinClassByCode(actor: Actor, code: string) {
  assertRole(actor, "STUDENT");
  return db.$transaction(async (tx) => {
    const cls = await findJoinableClass(code, tx);
    const active = await tx.classMembership.findFirst({
      where: { studentId: actor.id, leftAt: null },
    });
    if (active?.classId === cls.id) {
      throw new DomainError("ALREADY_IN_CLASS", "Bạn đang ở lớp này rồi.");
    }
    if (active) {
      await tx.classMembership.update({
        where: { id: active.id },
        data: { leftAt: new Date(), endReason: "SWITCHED" },
      });
    }
    await tx.classMembership.create({ data: { classId: cls.id, studentId: actor.id } });
    return cls;
  });
}

export async function removeStudentFromClass(actor: Actor, classId: string, studentId: string) {
  await assertTeacherOfClass(actor, classId);
  const { count } = await db.classMembership.updateMany({
    where: { classId, studentId, leftAt: null },
    data: { leftAt: new Date(), endReason: "REMOVED" },
  });
  if (count === 0) {
    throw new DomainError("NOT_IN_CLASS", "Học sinh không còn trong lớp này.");
  }
}

export async function setClassCodeActive(actor: Actor, classId: string, active: boolean) {
  await assertTeacherOfClass(actor, classId);
  return db.class.update({ where: { id: classId }, data: { codeActive: active } });
}

export async function regenerateClassCode(actor: Actor, classId: string) {
  await assertTeacherOfClass(actor, classId);
  const code = await uniqueClassCode();
  return db.class.update({ where: { id: classId }, data: { code } });
}
