import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import type { Role } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/roles";

/** Empties every table between tests (keeps the schema and pg-boss tables). */
export async function resetDatabase() {
  await db.$executeRawUnsafe(
    `TRUNCATE "QuizResult", "Segment", "WorkTag", "Tag", "Work", "Session", "ClassMembership", "UserSettings", "Class", "User" RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;
const TEST_PASSWORD = "test-password-123";
let cachedHash: string | undefined;

export async function makeUser(role: Role, overrides: { name?: string; email?: string } = {}) {
  counter += 1;
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  const user = await db.user.create({
    data: {
      role,
      name: overrides.name ?? `${role.toLowerCase()} ${counter}`,
      email: overrides.email ?? `${role.toLowerCase()}${counter}@test.local`,
      passwordHash: cachedHash,
    },
  });
  return { ...user, actor: { id: user.id, role: user.role } satisfies Actor };
}

export async function makeClass(teacherId: string, code: string, name = `Lớp ${code}`) {
  return db.class.create({ data: { name, code, teacherId } });
}

export async function enroll(studentId: string, classId: string) {
  return db.classMembership.create({ data: { studentId, classId } });
}

export { TEST_PASSWORD };
