import type { Prisma } from "@/generated/prisma/client";
import type { AnswerLevel, HighlightColor, QuestionType } from "@/generated/prisma/enums";
import { avatarFor } from "@/lib/art";
import { levelFor, streakFrom } from "@/lib/gamification";
import { effectiveLevel, isResolved, mcqOptionsSchema, questionState, type QuestionState } from "@/lib/questions/rules";
import { htmlToText } from "@/lib/reading/html-text";
import type { Actor } from "@/lib/roles";
import { dueLabel, heatPassages, heatRuns, summarizeProgress, type AssignmentSummary, type HeatRun } from "@/lib/teacher";
import { assertRole, assertTeacherOfClass, assertTeacherOfStudent } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { activeMembers, progressMatrix, type ProgressCell } from "@/server/services/assignments";
import { getPlayer, getPointTable } from "@/server/services/gamification";
import { settleAnswer } from "@/server/services/questions";

/**
 * Read models for the teacher dashboard (spec §10) and the teacher's controls
 * over AI feedback (spec §6.5). Every function starts with an authorization
 * check and only ever looks at the class's *current* students, so a teacher
 * loses access to a student who switched class.
 */

// ───────────────────────── Dashboard ─────────────────────────

export type AssignmentRow = {
  id: string;
  dueAt: Date;
  dueLabel: string;
  overdue: boolean;
  work: { id: string; slug: string; title: string; author: string };
  summary: AssignmentSummary;
  /** Average active reading time of students who started, in minutes. */
  avgMinutes: number;
  students: (ProgressCell & { id: string; name: string })[];
};

export async function getClassDashboard(actor: Actor, classId: string, now = new Date()) {
  const cls = await assertTeacherOfClass(actor, classId);
  const [members, assignments] = await Promise.all([
    activeMembers(classId),
    db.assignment.findMany({
      where: { classId },
      orderBy: { dueAt: "asc" },
      select: { id: true, dueAt: true, work: { select: { id: true, slug: true, title: true, author: true } } },
    }),
  ]);
  const cell = await progressMatrix(
    members.map((m) => m.id),
    assignments.map((a) => ({ workId: a.work.id, dueAt: a.dueAt })),
    now,
  );
  const rows: AssignmentRow[] = assignments.map((a) => {
    const students = members.map((m) => ({ id: m.id, name: m.name, ...cell(m.id, a.work.id) }));
    const readers = students.filter((s) => s.minutes > 0);
    return {
      id: a.id,
      dueAt: a.dueAt,
      dueLabel: dueLabel(a.dueAt, now),
      overdue: now.getTime() > a.dueAt.getTime(),
      work: a.work,
      summary: summarizeProgress(students),
      avgMinutes: readers.length ? Math.round(readers.reduce((sum, s) => sum + s.minutes, 0) / readers.length) : 0,
      students,
    };
  });
  // Students with at least one assignment past its deadline and unfinished.
  const behind = members
    .map((m) => ({
      id: m.id,
      name: m.name,
      overdue: rows.filter((r) => r.students.find((s) => s.id === m.id)?.overdue).map((r) => r.work.title),
    }))
    .filter((m) => m.overdue.length > 0);
  return { class: cls, members, assignments: rows, behind };
}

export type ClassDashboard = Awaited<ReturnType<typeof getClassDashboard>>;

// ───────────────────────── Students ─────────────────────────

/** Class list with gamification and assignment stats per student. */
export async function getClassStudents(actor: Actor, classId: string, now = new Date()) {
  const dashboard = await getClassDashboard(actor, classId, now);
  const ids = dashboard.members.map((m) => m.id);
  const [table, points, streakDays, lastRead, players] = await Promise.all([
    getPointTable(),
    db.pointEntry.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _sum: { amount: true } }),
    db.streakDay.findMany({ where: { userId: { in: ids } }, select: { userId: true, day: true } }),
    db.readingProgress.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { updatedAt: true } }),
    db.playerState.findMany({ where: { userId: { in: ids } }, select: { userId: true, avatar: true } }),
  ]);
  const avatarOf = new Map(players.map((p) => [p.userId, p.avatar]));
  const pointsOf = new Map(points.map((p) => [p.userId, p._sum.amount ?? 0]));
  const lastReadOf = new Map(lastRead.map((r) => [r.userId, r._max.updatedAt]));
  return {
    class: dashboard.class,
    assignmentCount: dashboard.assignments.length,
    students: dashboard.members.map((m) => {
      const cells = dashboard.assignments.map((a) => a.students.find((s) => s.id === m.id)!);
      const total = pointsOf.get(m.id) ?? 0;
      return {
        ...m,
        avatar: avatarFor(m.id, avatarOf.get(m.id)),
        points: total,
        level: levelFor(total, table.levelThresholds),
        streak: streakFrom(
          streakDays.filter((d) => d.userId === m.id).map((d) => d.day),
          now,
        ).current,
        done: cells.filter((c) => c.status === "done").length,
        overdue: cells.filter((c) => c.overdue).length,
        minutes: cells.reduce((sum, c) => sum + c.minutes, 0),
        lastReadAt: lastReadOf.get(m.id) ?? null,
      };
    }),
  };
}

/** The class must be the teacher's and the student must be in it right now. */
async function studentOfClass(actor: Actor, classId: string, studentId: string) {
  const cls = await assertTeacherOfClass(actor, classId);
  const membership = await db.classMembership.findFirst({
    where: { classId, studentId, leftAt: null },
    select: { joinedAt: true, student: { select: { id: true, name: true, email: true } } },
  });
  if (!membership) notFound("Học sinh không còn trong lớp này.");
  return { cls, student: { ...membership.student, joinedAt: membership.joinedAt } };
}

// ───────────────────────── Answers ─────────────────────────

const teacherAnswerSelect = (reporterId: string) =>
  ({
    id: true,
    userId: true,
    attempt: true,
    content: true,
    status: true,
    level: true,
    isCorrect: true,
    teacherLevel: true,
    strengths: true,
    improvements: true,
    aiHidden: true,
    teacherNote: true,
    reviewedAt: true,
    submittedAt: true,
    gradedAt: true,
    user: { select: { id: true, name: true } },
    question: {
      select: {
        id: true,
        type: true,
        stage: true,
        prompt: true,
        required: true,
        options: true,
        work: { select: { id: true, slug: true, title: true } },
        segment: { select: { title: true, order: true } },
      },
    },
    reports: { where: { reporterId }, select: { id: true } },
  }) satisfies Prisma.AnswerSelect;

type TeacherAnswerRow = Prisma.AnswerGetPayload<{ select: ReturnType<typeof teacherAnswerSelect> }>;

export type TeacherAnswer = ReturnType<typeof toTeacherAnswer>;

function toTeacherAnswer(a: TeacherAnswerRow, state: QuestionState | undefined) {
  // MCQ answers store the option id; show the option's text.
  const options = a.question.type === "MCQ" ? mcqOptionsSchema.safeParse(a.question.options) : null;
  return {
    id: a.id,
    attempt: a.attempt,
    content: options?.success ? (options.data.find((o) => o.id === a.content)?.text ?? a.content) : a.content,
    status: a.status,
    aiLevel: a.level,
    teacherLevel: a.teacherLevel,
    level: effectiveLevel(a),
    isCorrect: a.isCorrect,
    strengths: a.strengths,
    improvements: a.improvements,
    aiHidden: a.aiHidden,
    teacherNote: a.teacherNote,
    reviewedAt: a.reviewedAt,
    submittedAt: a.submittedAt,
    gradedAt: a.gradedAt,
    reported: a.reports.length > 0,
    student: a.user,
    question: {
      id: a.question.id,
      type: a.question.type,
      prompt: a.question.prompt,
      work: a.question.work,
      segmentTitle: a.question.segment ? (a.question.segment.title ?? `Phân đoạn ${a.question.segment.order}`) : null,
    },
    /** 3 graded attempts without passing (spec §6.3): the teacher should look. */
    flagged: state?.flagged ?? false,
    attemptsUsed: state?.attemptsUsed ?? 0,
  };
}

/** Question state for each (student, question) pair, from all their answers. */
async function questionStates(pairs: { userId: string; questionId: string; type: QuestionType }[]) {
  const states = new Map<string, QuestionState>();
  if (pairs.length === 0) return states;
  const answers = await db.answer.findMany({
    where: {
      userId: { in: [...new Set(pairs.map((p) => p.userId))] },
      questionId: { in: [...new Set(pairs.map((p) => p.questionId))] },
    },
    select: { userId: true, questionId: true, attempt: true, status: true, level: true, teacherLevel: true },
  });
  for (const p of pairs) {
    const key = `${p.userId}|${p.questionId}`;
    if (states.has(key)) continue;
    states.set(
      key,
      questionState(
        p.type,
        answers.filter((a) => a.userId === p.userId && a.questionId === p.questionId),
      ),
    );
  }
  return states;
}

export const ANSWER_FILTERS = ["all", "flagged", "chua-dat", "reviewed"] as const;
export type AnswerFilter = (typeof ANSWER_FILTERS)[number];

/** Recent AI-graded answers of the class (short answers and essays), newest first. */
export async function listClassAnswers(actor: Actor, classId: string, filter: AnswerFilter = "all", limit = 30) {
  await assertTeacherOfClass(actor, classId);
  const ids = (await activeMembers(classId)).map((m) => m.id);
  const rows = await db.answer.findMany({
    where: {
      userId: { in: ids },
      status: "GRADED",
      question: { type: { in: ["SHORT", "ESSAY"] } },
      ...(filter === "reviewed" ? { reviewedAt: { not: null } } : {}),
      ...(filter === "chua-dat" ? { OR: [{ teacherLevel: "CHUA_DAT" }, { teacherLevel: null, level: "CHUA_DAT" }] } : {}),
    },
    orderBy: [{ gradedAt: "desc" }, { submittedAt: "desc" }],
    // Flagged questions are found among recent answers, then de-duplicated.
    take: filter === "flagged" ? 400 : limit,
    select: teacherAnswerSelect(actor.id),
  });
  const states = await questionStates(rows.map((r) => ({ userId: r.userId, questionId: r.question.id, type: r.question.type })));
  const views = rows.map((r) => toTeacherAnswer(r, states.get(`${r.userId}|${r.question.id}`)));
  if (filter !== "flagged") return views;
  const seen = new Set<string>();
  return views
    .filter((v) => {
      const key = `${v.student.id}|${v.question.id}`;
      if (!v.flagged || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Whether the teacher may act on this answer: an open answer, graded, of a current student. */
async function reviewableAnswer(actor: Actor, answerId: string) {
  assertRole(actor, "TEACHER");
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    select: { id: true, userId: true, status: true, teacherLevel: true, question: { select: { id: true, type: true, workId: true } } },
  });
  if (!answer) notFound("Không tìm thấy câu trả lời.");
  await assertTeacherOfStudent(actor, answer.userId);
  if (answer.status !== "GRADED" || (answer.question.type !== "SHORT" && answer.question.type !== "ESSAY")) {
    throw new DomainError("INVALID_INPUT", "Chỉ chỉnh được câu tự luận đã có nhận xét.");
  }
  return answer;
}

export const TEACHER_NOTE_MAX = 1000;

/**
 * Teacher sets the level (null = keep the AI's), writes a note, and may hide
 * the AI's feedback (spec §6.5). A level change flows through the ledger
 * (points up or down), streak, badges and completion like any grading.
 */
export async function reviewAnswer(
  actor: Actor,
  answerId: string,
  input: { level: AnswerLevel | null; note: string | null; hideAi: boolean },
) {
  const answer = await reviewableAnswer(actor, answerId);
  const note = input.note?.trim() || null;
  if (note && note.length > TEACHER_NOTE_MAX) {
    throw new DomainError("INVALID_INPUT", `Nhận xét tối đa ${TEACHER_NOTE_MAX} ký tự.`);
  }
  if (input.hideAi && !note) {
    throw new DomainError("INVALID_INPUT", "Khi ẩn nhận xét AI, hãy viết nhận xét của bạn để học sinh vẫn có phản hồi.");
  }
  await db.answer.update({
    where: { id: answer.id },
    data: { teacherLevel: input.level, teacherNote: note, aiHidden: input.hideAi, reviewedAt: new Date(), reviewerId: actor.id },
  });
  const levelChanged = input.level !== answer.teacherLevel;
  if (levelChanged) {
    await settleAnswer({
      userId: answer.userId,
      workId: answer.question.workId,
      questionId: answer.question.id,
      answerId: answer.id,
      source: "teacher",
    });
  }
  return { levelChanged };
}

/** Teacher flags AI feedback for the admin to check the question's rubric. */
export async function reportAiFeedback(actor: Actor, answerId: string, reason: string) {
  const answer = await reviewableAnswer(actor, answerId);
  const text = reason.trim();
  if (text.length < 5 || text.length > 500) {
    throw new DomainError("INVALID_INPUT", "Lý do báo cáo cần từ 5 đến 500 ký tự.");
  }
  const existing = await db.aiReport.findUnique({
    where: { answerId_reporterId: { answerId: answer.id, reporterId: actor.id } },
    select: { id: true },
  });
  if (existing) throw new DomainError("ALREADY_EXISTS", "Bạn đã báo cáo nhận xét này cho admin.");
  return db.aiReport.create({ data: { answerId: answer.id, reporterId: actor.id, reason: text } });
}

// ───────────────────────── One student ─────────────────────────

export async function getStudentReport(actor: Actor, classId: string, studentId: string, now = new Date()) {
  const { cls, student } = await studentOfClass(actor, classId, studentId);
  const [assignments, started, completed, answered, player, state] = await Promise.all([
    db.assignment.findMany({ where: { classId }, select: { workId: true, dueAt: true } }),
    db.readingProgress.findMany({ where: { userId: studentId }, select: { workId: true, updatedAt: true } }),
    db.workCompletion.findMany({ where: { userId: studentId }, select: { workId: true, onTime: true } }),
    db.answer.findMany({ where: { userId: studentId }, distinct: ["questionId"], select: { question: { select: { workId: true } } } }),
    getPlayer(studentId, now),
    db.playerState.findUnique({ where: { userId: studentId }, select: { avatar: true } }),
  ]);
  const dueOf = new Map(assignments.map((a) => [a.workId, a.dueAt]));
  const onTime = new Set(completed.filter((c) => c.onTime).map((c) => c.workId));
  // Assigned works, plus anything the student opened, answered or finished.
  const workIds = [
    ...new Set([
      ...assignments.map((a) => a.workId),
      ...started.map((s) => s.workId),
      ...completed.map((c) => c.workId),
      ...answered.map((a) => a.question.workId),
    ]),
  ];

  const [works, cell, answers] = await Promise.all([
    db.work.findMany({ where: { id: { in: workIds } }, select: { id: true, slug: true, title: true, author: true } }),
    progressMatrix(
      [studentId],
      workIds.map((workId) => ({ workId, dueAt: dueOf.get(workId) ?? null })),
      now,
    ),
    db.answer.findMany({
      where: { userId: studentId, question: { workId: { in: workIds }, type: { not: "PREDICTION" } } },
      orderBy: [{ attempt: "asc" }],
      select: { ...teacherAnswerSelect(actor.id), question: { select: { ...teacherAnswerSelect(actor.id).question.select, order: true } } },
    }),
  ]);

  const byQuestion = new Map<string, typeof answers>();
  for (const a of answers) byQuestion.set(a.question.id, [...(byQuestion.get(a.question.id) ?? []), a]);
  // Reading order: before → during (by segment) → after, then the authored order.
  const stageOrder = { PRE: 0, DURING: 1, POST: 2 } as const;
  const sortKey = (q: (typeof answers)[number]["question"]) => [stageOrder[q.stage], q.segment?.order ?? 0, q.order];
  const questions = [...byQuestion.values()]
    .sort((x, y) => {
      const [a, b] = [sortKey(x[0].question), sortKey(y[0].question)];
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    })
    .map((list) => {
      const q = list[0].question;
      const state = questionState(q.type, list);
      return {
        id: q.id,
        workId: q.work.id,
        prompt: q.prompt,
        segmentTitle: q.segment ? (q.segment.title ?? `Phân đoạn ${q.segment.order}`) : null,
        type: q.type,
        stage: q.stage,
        required: q.required,
        state,
        attempts: list.map((a) => toTeacherAnswer(a, state)),
      };
    });

  const recent = new Map(started.map((s) => [s.workId, s.updatedAt]));
  const workRows = works
    .map((w) => {
      const qs = questions.filter((q) => q.workId === w.id);
      return {
        ...w,
        dueAt: dueOf.get(w.id) ?? null,
        assigned: dueOf.has(w.id),
        onTime: onTime.has(w.id),
        progress: cell(studentId, w.id),
        lastReadAt: recent.get(w.id) ?? null,
        owed: qs.filter((q) => q.required && !isResolved(q.state)).length,
        flagged: qs.filter((q) => q.state.flagged).length,
        questions: qs,
      };
    })
    .sort((a, b) => Number(b.assigned) - Number(a.assigned) || (b.lastReadAt?.getTime() ?? 0) - (a.lastReadAt?.getTime() ?? 0));

  return { class: cls, student: { ...student, avatar: avatarFor(student.id, state?.avatar) }, player, works: workRows };
}

export type StudentReport = Awaited<ReturnType<typeof getStudentReport>>;

// ───────────────────────── Highlights ─────────────────────────

export type HeatSegment = { id: string; title: string; text: string; runs: HeatRun[] };

/**
 * Where the class highlights (spec §10): a heatmap of one work by how many
 * students marked each passage, plus recent highlights that carry a note.
 * Private highlights and former students are always left out.
 */
export async function getClassHighlights(actor: Actor, classId: string, workId?: string) {
  await assertTeacherOfClass(actor, classId);
  const ids = (await activeMembers(classId)).map((m) => m.id);
  const visible = { userId: { in: ids }, isPrivate: false } satisfies Prisma.HighlightWhereInput;

  const [perWork, feed] = await Promise.all([
    db.highlight.groupBy({ by: ["workId"], where: visible, _count: { _all: true } }),
    db.highlight.findMany({
      where: { ...visible, note: { not: null }, NOT: { note: "" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        quote: true,
        note: true,
        color: true,
        createdAt: true,
        user: { select: { name: true } },
        work: { select: { title: true } },
        segment: { select: { title: true, order: true } },
      },
    }),
  ]);
  const titles = await db.work.findMany({
    where: { id: { in: perWork.map((w) => w.workId) } },
    select: { id: true, title: true },
  });
  const works = perWork
    .map((w) => ({ id: w.workId, title: titles.find((t) => t.id === w.workId)?.title ?? "", count: w._count._all }))
    .sort((a, b) => b.count - a.count);
  const selected = works.find((w) => w.id === workId) ?? works[0] ?? null;

  let heat: { segments: HeatSegment[]; maxCount: number; students: number; passages: (ReturnType<typeof heatPassages>[number] & { segmentTitle: string })[] } | null = null;
  if (selected) {
    const [segments, highlights] = await Promise.all([
      db.segment.findMany({
        where: { workId: selected.id, archivedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, content: true },
      }),
      db.highlight.findMany({ where: { ...visible, workId: selected.id, orphanedAt: null }, select: { segmentId: true, start: true, end: true, userId: true } }),
    ]);
    const heatSegments = segments.map((s) => {
      const text = htmlToText(s.content).replace(/\n+$/, "");
      const ranges = highlights.filter((h) => h.segmentId === s.id);
      const segment: HeatSegment = { id: s.id, title: s.title ?? `Phân đoạn ${s.order}`, text, runs: heatRuns(text.length, ranges) };
      return { segment, passages: heatPassages(text, ranges) };
    });
    heat = {
      segments: heatSegments.map((s) => s.segment),
      maxCount: Math.max(0, ...heatSegments.flatMap((s) => s.segment.runs.map((r) => r.count))),
      students: new Set(highlights.map((h) => h.userId)).size,
      passages: heatSegments
        .flatMap((s) => s.passages.map((p) => ({ ...p, segmentTitle: s.segment.title })))
        .sort((a, b) => b.students - a.students || b.peak - a.peak)
        .slice(0, 5),
    };
  }

  return {
    works,
    selected,
    heat,
    feed: feed.map((h) => ({
      id: h.id,
      quote: h.quote,
      note: h.note!,
      color: h.color as HighlightColor,
      createdAt: h.createdAt,
      student: h.user.name,
      work: h.work.title,
      segment: h.segment.title ?? `Phân đoạn ${h.segment.order}`,
    })),
  };
}

export type ClassHighlights = Awaited<ReturnType<typeof getClassHighlights>>;
