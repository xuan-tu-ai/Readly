import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/roles";
import { vnDateString } from "@/lib/teacher";
import { db } from "@/server/db";
import { setJobSender } from "@/server/queue";
import { buildClassWorkbook } from "@/server/reports/class-report";
import {
  createAssignment,
  deleteAssignment,
  listStudentAssignments,
  remindStudents,
  updateAssignmentDue,
} from "@/server/services/assignments";
import { joinClassByCode } from "@/server/services/classes";
import { totalPoints } from "@/server/services/gamification";
import { getQuestionView, gradeAnswerJob, submitAnswer } from "@/server/services/questions";
import { createHighlight, markSegmentsRead, updateHighlight } from "@/server/services/reading";
import {
  getClassDashboard,
  getClassHighlights,
  getStudentReport,
  listClassAnswers,
  reportAiFeedback,
  reviewAnswer,
} from "@/server/services/teacher";
import { enroll, makeClass, makeUser, resetDatabase } from "../helpers/db";

beforeEach(async () => {
  await resetDatabase();
  setJobSender(async () => {});
});

const DAY = 86_400_000;
const GOOD = "Hình ảnh gió qua hàng tre và nắng vàng trên đê gợi một làng quê yên bình, gần gũi.";
const WEAK = "Em không biết ạ.";

async function makeWork(slug = "tac-pham") {
  const work = await db.work.create({
    data: {
      slug,
      title: `Tác phẩm ${slug}`,
      author: "Tác giả",
      authorBio: "",
      summary: "",
      genre: "THO",
      difficulty: 1,
      estMinutes: 10,
      status: "PUBLISHED",
      searchText: slug,
      segments: {
        create: [
          { order: 1, content: "<p>Gió qua hàng tre, nắng vàng trên đê.</p>" },
          { order: 2, content: "<p>Đêm xuống trên sông. Trăng lên đầu núi.</p>" },
        ],
      },
    },
    include: { segments: { orderBy: { order: "asc" } } },
  });
  const [s1, s2] = work.segments;
  const short = await db.question.create({
    data: {
      workId: work.id,
      segmentId: s2.id,
      stage: "DURING",
      type: "SHORT",
      prompt: "Vì sao?",
      rubric: { chuaDat: "chung chung", dat: "có ý", sauSac: "đủ ý" },
      keyPoints: ["gió qua hàng tre", "nắng vàng trên đê"],
    },
  });
  return { work, s1, s2, short };
}

async function answerShort(actor: Actor, questionId: string, text: string) {
  const view = await submitAnswer(actor, questionId, text);
  const answerId = view.answers.at(-1)!.id;
  await gradeAnswerJob(answerId);
  return answerId;
}

/** Reads every segment and answers well → the work completes now. */
async function finish(actor: Actor, w: Awaited<ReturnType<typeof makeWork>>) {
  await markSegmentsRead(actor, [w.s1.id, w.s2.id]);
  return answerShort(actor, w.short.id, GOOD);
}

async function setup() {
  const teacher = await makeUser("TEACHER", { name: "Cô Lan" });
  const otherTeacher = await makeUser("TEACHER");
  const cls = await makeClass(teacher.id, "LOPAAA", "12A1");
  const otherClass = await makeClass(otherTeacher.id, "LOPBBB", "12B2");
  const [an, binh, chi] = await Promise.all([
    makeUser("STUDENT", { name: "Trần Minh An" }),
    makeUser("STUDENT", { name: "Lê Thị Bình" }),
    makeUser("STUDENT", { name: "Phạm Chi" }),
  ]);
  for (const s of [an, binh, chi]) await enroll(s.id, cls.id);
  return { teacher, otherTeacher, cls, otherClass, an, binh, chi };
}

const inDays = (days: number) => vnDateString(new Date(Date.now() + days * DAY));

describe("assignments", () => {
  it("assigns a work and notifies only current students", async () => {
    const { teacher, cls, an, binh, chi, otherClass } = await setup();
    await joinClassByCode(chi.actor, otherClass.code); // Chi left before the assignment
    const w = await makeWork();

    const { notified } = await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(5) });
    expect(notified).toBe(2);
    const notices = await db.notification.findMany({ where: { kind: "ASSIGNMENT" }, select: { userId: true, href: true } });
    expect(notices.map((n) => n.userId).sort()).toEqual([an.id, binh.id].sort());
    expect(notices[0].href).toBe(`/student/works/${w.work.slug}`);
  });

  it("rejects past deadlines, duplicates and other teachers' classes", async () => {
    const { teacher, otherTeacher, cls } = await setup();
    const w = await makeWork();
    await expect(
      createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(-1) }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      createAssignment(otherTeacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(3) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { assignment } = await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(3) });
    await expect(
      createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(4) }),
    ).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
    await expect(updateAssignmentDue(otherTeacher.actor, assignment.id, inDays(9))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await updateAssignmentDue(teacher.actor, assignment.id, inDays(9));
    expect(vnDateString((await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } })).dueAt)).toBe(inDays(9));
  });
});

describe("dashboard progress", () => {
  it("counts done / reading / not started and overdue for current students only", async () => {
    const { teacher, cls, an, binh, chi, otherClass } = await setup();
    const w = await makeWork();
    const { assignment } = await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(2) });
    await finish(an.actor, w);
    await markSegmentsRead(binh.actor, [w.s1.id]);

    const today = await getClassDashboard(teacher.actor, cls.id);
    const row = today.assignments.find((a) => a.id === assignment.id)!;
    expect(row.summary).toMatchObject({ total: 3, done: 1, onTime: 1, reading: 1, notStarted: 1, overdue: 0 });
    expect(row.students.find((s) => s.id === binh.id)).toMatchObject({ status: "reading", percent: 50 });

    // After the deadline the two unfinished students are overdue.
    const later = await getClassDashboard(teacher.actor, cls.id, new Date(Date.now() + 5 * DAY));
    expect(later.assignments[0].summary.overdue).toBe(2);
    expect(later.behind.map((b) => b.name)).toEqual(["Lê Thị Bình", "Phạm Chi"]);

    // A student who switches class disappears from the old class's numbers.
    await joinClassByCode(chi.actor, otherClass.code);
    const after = await getClassDashboard(teacher.actor, cls.id);
    expect(after.assignments[0].summary.total).toBe(2);
    expect(after.members.map((m) => m.name)).toEqual(["Trần Minh An", "Lê Thị Bình"]);
  });

  it("only the class's teacher can open it", async () => {
    const { otherTeacher, cls, an } = await setup();
    await expect(getClassDashboard(otherTeacher.actor, cls.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClassDashboard(an.actor, cls.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("early completion bonus", () => {
  it("adds the bonus when an assigned work is finished before the deadline", async () => {
    const { teacher, cls, an } = await setup();
    const w = await makeWork();
    await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(3) });
    await finish(an.actor, w);
    const completion = await db.workCompletion.findUniqueOrThrow({ where: { userId_workId: { userId: an.id, workId: w.work.id } } });
    expect(completion.onTime).toBe(true);
    expect(await totalPoints(an.id)).toBe(20 + 100 + 50); // Sâu sắc + completion + early bonus
  });

  it("gives no bonus after the deadline or for works that were not assigned", async () => {
    const { teacher, cls, an, binh } = await setup();
    const late = await makeWork("tre-han");
    const free = await makeWork("tu-do");
    // Assigned in the past with a deadline that has already passed.
    await createAssignment(teacher.actor, { classId: cls.id, workId: late.work.id, dueDate: "2020-01-10" }, new Date("2020-01-01T00:00:00Z"));
    await finish(an.actor, late);
    await finish(binh.actor, free);
    expect(await totalPoints(an.id)).toBe(120);
    expect(await totalPoints(binh.id)).toBe(120);
  });

  it("keeps the bonus when the assignment is later removed", async () => {
    const { teacher, cls, an } = await setup();
    const w = await makeWork();
    const { assignment } = await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(3) });
    await finish(an.actor, w);
    await deleteAssignment(teacher.actor, assignment.id);
    expect(await totalPoints(an.id)).toBe(170);
  });
});

describe("teacher review of AI feedback", () => {
  it("lowering a level takes the points back; the student sees the teacher's level and note", async () => {
    const { teacher, an } = await setup();
    const w = await makeWork();
    const answerId = await answerShort(an.actor, w.short.id, GOOD);
    expect(await totalPoints(an.id)).toBe(20);

    await reviewAnswer(teacher.actor, answerId, { level: "DAT", note: "Cần dẫn chứng rõ hơn.", hideAi: true });
    expect(await totalPoints(an.id)).toBe(10);
    const view = await getQuestionView(an.id, w.short.id);
    expect(view.answers[0]).toMatchObject({
      level: "DAT",
      levelByTeacher: true,
      strengths: null,
      improvements: null,
      teacherNote: "Cần dẫn chứng rõ hơn.",
    });

    // Clearing the override goes back to the AI's level.
    await reviewAnswer(teacher.actor, answerId, { level: null, note: null, hideAi: false });
    expect(await totalPoints(an.id)).toBe(20);
  });

  it("raising a failed answer can complete the work", async () => {
    const { teacher, an } = await setup();
    const w = await makeWork();
    await markSegmentsRead(an.actor, [w.s1.id, w.s2.id]);
    const answerId = await answerShort(an.actor, w.short.id, WEAK);
    expect(await db.workCompletion.count()).toBe(0);

    await reviewAnswer(teacher.actor, answerId, { level: "DAT", note: null, hideAi: false });
    expect(await db.workCompletion.count()).toBe(1);
    expect(await totalPoints(an.id)).toBe(10 + 100);
  });

  it("requires a note when hiding the AI feedback and reports only once", async () => {
    const { teacher, an } = await setup();
    const w = await makeWork();
    const answerId = await answerShort(an.actor, w.short.id, GOOD);
    await expect(reviewAnswer(teacher.actor, answerId, { level: null, note: "  ", hideAi: true })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await reportAiFeedback(teacher.actor, answerId, "Nhận xét khen quá mức so với rubric.");
    await expect(reportAiFeedback(teacher.actor, answerId, "Lần nữa nhé")).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
    const [feed] = await listClassAnswers(teacher.actor, (await db.class.findFirstOrThrow()).id);
    expect(feed).toMatchObject({ reported: true, aiLevel: "SAU_SAC" });
  });

  it("lists flagged questions once (3 graded attempts without passing)", async () => {
    const { teacher, cls, an } = await setup();
    const w = await makeWork();
    for (let i = 0; i < 3; i++) await answerShort(an.actor, w.short.id, WEAK);
    const flagged = await listClassAnswers(teacher.actor, cls.id, "flagged");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ flagged: true, attempt: 3, attemptsUsed: 3 });
    expect(await listClassAnswers(teacher.actor, cls.id, "chua-dat")).toHaveLength(3);
  });
});

describe("access after a student switches class", () => {
  it("the old teacher loses the student, the new teacher gains them", async () => {
    const { teacher, otherTeacher, cls, otherClass, an } = await setup();
    const w = await makeWork();
    const answerId = await answerShort(an.actor, w.short.id, GOOD);
    expect((await getStudentReport(teacher.actor, cls.id, an.id)).student.name).toBe("Trần Minh An");

    await joinClassByCode(an.actor, otherClass.code);
    await expect(getStudentReport(teacher.actor, cls.id, an.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reviewAnswer(teacher.actor, answerId, { level: "DAT", note: null, hideAi: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await listClassAnswers(teacher.actor, cls.id)).toHaveLength(0);

    const report = await getStudentReport(otherTeacher.actor, otherClass.id, an.id);
    expect(report.works[0].questions[0].attempts[0].aiLevel).toBe("SAU_SAC");
    await reviewAnswer(otherTeacher.actor, answerId, { level: "DAT", note: null, hideAi: false });
  });
});

describe("reminders", () => {
  it("reminds unfinished current students once per cooldown and shows it to them", async () => {
    const { teacher, otherTeacher, cls, an, binh, chi } = await setup();
    const w = await makeWork();
    const { assignment } = await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(2) });
    await finish(an.actor, w);

    const now = new Date();
    const first = await remindStudents(teacher.actor, assignment.id, [an.id, binh.id, chi.id], null, now);
    expect(first).toEqual({ sent: 2, skipped: 1 });
    const again = await remindStudents(teacher.actor, assignment.id, [binh.id], "Đọc đi em", new Date(now.getTime() + 60_000));
    expect(again.sent).toBe(0);
    const later = await remindStudents(teacher.actor, assignment.id, [binh.id], "Còn 1 ngày!", new Date(now.getTime() + 11 * 60_000));
    expect(later.sent).toBe(1);
    await expect(remindStudents(otherTeacher.actor, assignment.id, [binh.id], null)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const [mine] = await listStudentAssignments(binh.id);
    expect(mine.reminder).toMatchObject({ body: "Còn 1 ngày!", from: "Cô Lan" });
    const [done] = await listStudentAssignments(an.id);
    expect(done.progress.status).toBe("done");
    expect(done.reminder).toBeNull();
  });
});

describe("class highlights", () => {
  it("builds the heatmap from current students' public highlights", async () => {
    const { teacher, cls, otherClass, an, binh, chi } = await setup();
    const w = await makeWork();
    // "Đêm xuống trên sông." is 0..20 of segment 2.
    await createHighlight(an.actor, { segmentId: w.s2.id, start: 0, end: 20, color: "YELLOW" });
    const noted = await createHighlight(binh.actor, { segmentId: w.s2.id, start: 0, end: 20, color: "PINK" });
    await updateHighlight(binh.actor, { id: noted.id, note: "Câu này buồn quá" });
    const secret = await createHighlight(chi.actor, { segmentId: w.s2.id, start: 21, end: 39, color: "BLUE" });
    await updateHighlight(chi.actor, { id: secret.id, isPrivate: true, note: "riêng tư" });
    const gone = await makeUser("STUDENT");
    await enroll(gone.id, cls.id);
    await createHighlight(gone.actor, { segmentId: w.s1.id, start: 0, end: 3, color: "YELLOW" });
    await joinClassByCode(gone.actor, otherClass.code);

    const result = await getClassHighlights(teacher.actor, cls.id);
    expect(result.works).toEqual([{ id: w.work.id, title: w.work.title, count: 2 }]);
    expect(result.heat!.students).toBe(2);
    expect(result.heat!.maxCount).toBe(2);
    expect(result.heat!.segments[0].runs).toEqual([{ start: 0, end: result.heat!.segments[0].text.length, count: 0 }]);
    expect(result.heat!.passages[0]).toMatchObject({ quote: "Đêm xuống trên sông.", students: 2 });
    expect(result.feed.map((f) => [f.student, f.note])).toEqual([["Lê Thị Bình", "Câu này buồn quá"]]);
  });
});

describe(".xlsx report", () => {
  it("writes the detail and summary sheets in Vietnamese", async () => {
    const { teacher, cls, an, binh } = await setup();
    const w = await makeWork();
    await createAssignment(teacher.actor, { classId: cls.id, workId: w.work.id, dueDate: inDays(4) });
    await finish(an.actor, w);
    await markSegmentsRead(binh.actor, [w.s1.id]);

    const buffer = await buildClassWorkbook(await getClassDashboard(teacher.actor, cls.id));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(book.worksheets.map((s) => s.name)).toEqual(["Chi tiết", "Tổng hợp"]);

    const detail = book.getWorksheet("Chi tiết")!;
    expect(String(detail.getCell("A1").value)).toBe("Báo cáo đọc – lớp 12A1");
    expect(String(detail.getCell("D4").value)).toContain("Tác phẩm tac-pham");
    const rows = [5, 6, 7].map((r) => [detail.getCell(r, 2).value, String(detail.getCell(r, 4).value)]);
    expect(rows).toEqual([
      ["Trần Minh An", expect.stringMatching(/^Hoàn thành \d{2}\/\d{2}\/\d{4}$/)],
      ["Lê Thị Bình", "Đang đọc 50%"],
      ["Phạm Chi", "Chưa đọc"],
    ]);

    const summary = book.getWorksheet("Tổng hợp")!;
    expect(summary.getRow(5).values).toEqual(
      expect.arrayContaining(["Tác phẩm tac-pham", 3, 1, 1 / 3]),
    );
  });
});
