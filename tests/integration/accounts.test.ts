import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { authenticate, createTeacher, registerStudent, resetPassword } from "@/server/services/accounts";
import { createSession, getUserBySessionToken, SESSION_TTL_MS } from "@/server/auth/sessions";
import { enroll, makeClass, makeUser, resetDatabase, TEST_PASSWORD } from "../helpers/db";

beforeEach(resetDatabase);

describe("registerStudent", () => {
  it("creates a student in the class matching the code", async () => {
    const teacher = await makeUser("TEACHER");
    const cls = await makeClass(teacher.id, "ABCDEF");

    const student = await registerStudent({
      name: "Lê Thị B",
      email: "b@test.local",
      password: "mat-khau-123",
      classCode: "ABCDEF",
    });

    expect(student.role).toBe("STUDENT");
    const membership = await db.classMembership.findFirstOrThrow({ where: { studentId: student.id } });
    expect(membership.classId).toBe(cls.id);
    expect(membership.leftAt).toBeNull();
    expect(await db.userSettings.count({ where: { userId: student.id } })).toBe(1);
  });

  it("rejects unknown and locked class codes without creating the user", async () => {
    const teacher = await makeUser("TEACHER");
    const locked = await makeClass(teacher.id, "LOCKED");
    await db.class.update({ where: { id: locked.id }, data: { codeActive: false } });
    const input = { name: "Lê Thị B", email: "b@test.local", password: "mat-khau-123" };

    for (const classCode of ["NOPE99", "LOCKED"]) {
      await expect(registerStudent({ ...input, classCode })).rejects.toMatchObject({
        code: "CLASS_CODE_INVALID",
      });
    }
    expect(await db.user.count({ where: { email: "b@test.local" } })).toBe(0);
  });

  it("rejects a duplicate email", async () => {
    const teacher = await makeUser("TEACHER");
    await makeClass(teacher.id, "ABCDEF");
    const input = { name: "A", email: "dup@test.local", password: "mat-khau-123", classCode: "ABCDEF" };
    await registerStudent({ ...input, name: "Học sinh A" });
    await expect(registerStudent({ ...input, name: "Học sinh B" })).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    });
  });
});

describe("authenticate", () => {
  it("accepts the right password and rejects wrong password or unknown email", async () => {
    const user = await makeUser("TEACHER", { email: "gv@test.local" });
    await expect(authenticate("gv@test.local", TEST_PASSWORD)).resolves.toMatchObject({ id: user.id });
    await expect(authenticate("gv@test.local", "wrong-password")).resolves.toBeNull();
    await expect(authenticate("nobody@test.local", TEST_PASSWORD)).resolves.toBeNull();
  });
});

describe("sessions", () => {
  it("resolves a fresh token and stores only its hash", async () => {
    const user = await makeUser("STUDENT");
    const { token } = await createSession(user.id);
    await expect(getUserBySessionToken(token)).resolves.toMatchObject({ id: user.id });
    expect(await db.session.count({ where: { id: token } })).toBe(0);
  });

  it("rejects and deletes expired sessions", async () => {
    const user = await makeUser("STUDENT");
    const past = new Date(Date.now() - SESSION_TTL_MS - 1000);
    const { token } = await createSession(user.id, past);
    await expect(getUserBySessionToken(token)).resolves.toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("createTeacher", () => {
  it("is admin-only", async () => {
    const admin = await makeUser("ADMIN");
    const teacher = await makeUser("TEACHER");
    const input = { name: "Thầy C", email: "c@test.local", password: "mat-khau-123" };

    await expect(createTeacher(teacher.actor, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createTeacher(admin.actor, input)).resolves.toMatchObject({ role: "TEACHER" });
  });
});

describe("resetPassword", () => {
  async function setup() {
    const admin = await makeUser("ADMIN");
    const teacherA = await makeUser("TEACHER");
    const teacherB = await makeUser("TEACHER");
    const classA = await makeClass(teacherA.id, "CLASSA");
    const studentA = await makeUser("STUDENT");
    await enroll(studentA.id, classA.id);
    return { admin, teacherA, teacherB, studentA };
  }

  it("lets a teacher reset their own student and signs the student out", async () => {
    const { teacherA, studentA } = await setup();
    await createSession(studentA.id);

    await resetPassword(teacherA.actor, studentA.id, "mat-khau-moi-1");

    await expect(authenticate(studentA.email, "mat-khau-moi-1")).resolves.not.toBeNull();
    expect(await db.session.count({ where: { userId: studentA.id } })).toBe(0);
  });

  it("forbids a teacher from resetting another class's student", async () => {
    const { teacherB, studentA } = await setup();
    await expect(resetPassword(teacherB.actor, studentA.id, "mat-khau-moi-1")).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(authenticate(studentA.email, TEST_PASSWORD)).resolves.not.toBeNull();
  });

  it("forbids a teacher from resetting another teacher", async () => {
    const { teacherA, teacherB } = await setup();
    await expect(resetPassword(teacherA.actor, teacherB.id, "mat-khau-moi-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets an admin reset a teacher but not another admin", async () => {
    const { admin, teacherA } = await setup();
    const otherAdmin = await makeUser("ADMIN");
    await expect(resetPassword(admin.actor, teacherA.id, "mat-khau-moi-1")).resolves.toBeUndefined();
    await expect(resetPassword(admin.actor, otherAdmin.id, "mat-khau-moi-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
