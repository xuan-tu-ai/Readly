import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { isTeacherOfStudent } from "@/server/authz";
import {
  createClass,
  getActiveClass,
  getClassRoster,
  joinClassByCode,
  listTeacherClasses,
  regenerateClassCode,
  removeStudentFromClass,
  setClassCodeActive,
} from "@/server/services/classes";
import { enroll, makeClass, makeUser, resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

async function twoClasses() {
  const teacherA = await makeUser("TEACHER");
  const teacherB = await makeUser("TEACHER");
  const classA = await makeClass(teacherA.id, "CLASSA");
  const classB = await makeClass(teacherB.id, "CLASSB");
  const studentA = await makeUser("STUDENT");
  const studentB = await makeUser("STUDENT");
  await enroll(studentA.id, classA.id);
  await enroll(studentB.id, classB.id);
  return { teacherA, teacherB, classA, classB, studentA, studentB };
}

describe("data isolation between classes", () => {
  it("a teacher sees only their own class roster", async () => {
    const { teacherA, classA, classB, studentA } = await twoClasses();

    const roster = await getClassRoster(teacherA.actor, classA.id);
    expect(roster.students.map((s) => s.id)).toEqual([studentA.id]);

    await expect(getClassRoster(teacherA.actor, classB.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("isTeacherOfStudent is true only for the student's current teacher", async () => {
    const { teacherA, teacherB, studentA } = await twoClasses();
    expect(await isTeacherOfStudent(teacherA.id, studentA.id)).toBe(true);
    expect(await isTeacherOfStudent(teacherB.id, studentA.id)).toBe(false);
  });

  it("students and admins cannot read a roster", async () => {
    const { classA, studentA } = await twoClasses();
    const admin = await makeUser("ADMIN");
    for (const actor of [studentA.actor, admin.actor]) {
      await expect(getClassRoster(actor, classA.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("a teacher cannot change another teacher's class", async () => {
    const { teacherA, classB, studentB } = await twoClasses();
    await expect(setClassCodeActive(teacherA.actor, classB.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(regenerateClassCode(teacherA.actor, classB.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeStudentFromClass(teacherA.actor, classB.id, studentB.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("switching class", () => {
  it("moves the student and the old teacher loses access", async () => {
    const { teacherA, teacherB, classB, studentA } = await twoClasses();

    await joinClassByCode(studentA.actor, "CLASSB");

    expect((await getActiveClass(studentA.id))?.id).toBe(classB.id);
    expect(await isTeacherOfStudent(teacherA.id, studentA.id)).toBe(false);
    expect(await isTeacherOfStudent(teacherB.id, studentA.id)).toBe(true);

    const history = await db.classMembership.findMany({
      where: { studentId: studentA.id },
      orderBy: { joinedAt: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ endReason: "SWITCHED" });
    expect(history[0].leftAt).not.toBeNull();
    expect(history[1].leftAt).toBeNull();
  });

  it("refuses the class the student is already in, and locked codes", async () => {
    const { classB, studentA } = await twoClasses();
    await expect(joinClassByCode(studentA.actor, "CLASSA")).rejects.toMatchObject({ code: "ALREADY_IN_CLASS" });

    await db.class.update({ where: { id: classB.id }, data: { codeActive: false } });
    await expect(joinClassByCode(studentA.actor, "CLASSB")).rejects.toMatchObject({ code: "CLASS_CODE_INVALID" });
  });

  it("only students can join by code", async () => {
    const { teacherA } = await twoClasses();
    await expect(joinClassByCode(teacherA.actor, "CLASSB")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("the database refuses two active memberships for one student", async () => {
    const { classB, studentA } = await twoClasses();
    await expect(enroll(studentA.id, classB.id)).rejects.toThrow();
  });
});

describe("removing a student", () => {
  it("ends the membership; the student can rejoin with a code", async () => {
    const { teacherA, classA, studentA } = await twoClasses();

    await removeStudentFromClass(teacherA.actor, classA.id, studentA.id);
    expect(await getActiveClass(studentA.id)).toBeNull();
    expect((await getClassRoster(teacherA.actor, classA.id)).students).toHaveLength(0);
    await expect(removeStudentFromClass(teacherA.actor, classA.id, studentA.id)).rejects.toMatchObject({
      code: "NOT_IN_CLASS",
    });

    await joinClassByCode(studentA.actor, "CLASSB");
    expect((await getActiveClass(studentA.id))?.name).toBe("Lớp CLASSB");
  });
});

describe("class management", () => {
  it("creates classes with unique generated codes and counts active students", async () => {
    const teacher = await makeUser("TEACHER");
    const a = await createClass(teacher.actor, "12A1");
    const b = await createClass(teacher.actor, "12A2");
    expect(a.code).not.toBe(b.code);
    expect(a.code).toMatch(/^[A-Z2-9]{6}$/);

    const student = await makeUser("STUDENT");
    await enroll(student.id, a.id);
    const list = await listTeacherClasses(teacher.actor);
    expect(list.find((c) => c.id === a.id)?.studentCount).toBe(1);
  });

  it("regenerating the code invalidates the old one", async () => {
    const { teacherA, classA } = await twoClasses();
    const updated = await regenerateClassCode(teacherA.actor, classA.id);
    expect(updated.code).not.toBe("CLASSA");
    const newcomer = await makeUser("STUDENT");
    await expect(joinClassByCode(newcomer.actor, "CLASSA")).rejects.toMatchObject({ code: "CLASS_CODE_INVALID" });
    await expect(joinClassByCode(newcomer.actor, updated.code)).resolves.toMatchObject({ id: classA.id });
  });
});
