import type { Genre } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/roles";
import {
  compareStudentNames,
  dueAtFromDate,
  dueLabel,
  workProgress,
  type WorkProgress,
} from "@/lib/teacher";
import { assertTeacherOfClass } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { formatDate } from "@/lib/vn-date";

/**
 * Assignments (a work + a deadline for a class), per-student progress on them
 * and teacher reminders (spec §10). Assignment and reminder notices are
 * written as Notification rows; phase 7 delivers them (bell, web push).
 */

export type Member = { id: string; name: string; email: string; joinedAt: Date };

/** Current students of a class, in class-list order. Former members never appear. */
export async function activeMembers(classId: string): Promise<Member[]> {
  const rows = await db.classMembership.findMany({
    where: { classId, leftAt: null },
    select: { joinedAt: true, student: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => ({ ...r.student, joinedAt: r.joinedAt })).sort((a, b) => compareStudentNames(a.name, b.name));
}

// ───────────────────────── Progress matrix ─────────────────────────

export type ProgressCell = WorkProgress & {
  /** Active reading time on the work, whole minutes. */
  minutes: number;
  /** Last teacher reminder about this work, if any. */
  lastReminderAt: Date | null;
};

/**
 * Progress of many students on many works in five queries. `dueAt` per work
 * decides lateness; pass null for works read freely.
 */
export async function progressMatrix(
  studentIds: string[],
  works: { workId: string; dueAt: Date | null }[],
  now: Date,
): Promise<(studentId: string, workId: string) => ProgressCell> {
  const workIds = [...new Set(works.map((w) => w.workId))];
  const empty = studentIds.length === 0 || workIds.length === 0;
  const segments = empty
    ? []
    : await db.segment.findMany({ where: { workId: { in: workIds } }, select: { id: true, workId: true, archivedAt: true } });
  const live = segments.filter((s) => s.archivedAt === null);
  const workOf = new Map(segments.map((s) => [s.id, s.workId]));

  const [reads, completions, times, reminders] = empty
    ? [[], [], [], []]
    : await Promise.all([
        db.segmentRead.findMany({
          where: { userId: { in: studentIds }, segmentId: { in: live.map((s) => s.id) } },
          select: { userId: true, segmentId: true },
        }),
        db.workCompletion.findMany({
          where: { userId: { in: studentIds }, workId: { in: workIds } },
          select: { userId: true, workId: true, completedAt: true },
        }),
        db.readingTime.groupBy({
          by: ["userId", "segmentId"],
          where: { userId: { in: studentIds }, segmentId: { in: segments.map((s) => s.id) } },
          _sum: { seconds: true },
        }),
        db.notification.groupBy({
          by: ["userId", "workId"],
          where: { kind: "REMINDER", userId: { in: studentIds }, workId: { in: workIds } },
          _max: { createdAt: true },
        }),
      ]);

  const key = (studentId: string, workId: string) => `${studentId}|${workId}`;
  const totalSegments = new Map<string, number>();
  for (const s of live) totalSegments.set(s.workId, (totalSegments.get(s.workId) ?? 0) + 1);
  const readCount = new Map<string, number>();
  for (const r of reads) {
    const k = key(r.userId, workOf.get(r.segmentId)!);
    readCount.set(k, (readCount.get(k) ?? 0) + 1);
  }
  const seconds = new Map<string, number>();
  for (const t of times) {
    const k = key(t.userId, workOf.get(t.segmentId)!);
    seconds.set(k, (seconds.get(k) ?? 0) + (t._sum.seconds ?? 0));
  }
  const completedAt = new Map(completions.map((c) => [key(c.userId, c.workId), c.completedAt]));
  const reminded = new Map(reminders.map((r) => [key(r.userId, r.workId!), r._max.createdAt]));
  const dueAt = new Map(works.map((w) => [w.workId, w.dueAt]));

  return (studentId, workId) => {
    const k = key(studentId, workId);
    return {
      ...workProgress({
        totalSegments: totalSegments.get(workId) ?? 0,
        readSegments: readCount.get(k) ?? 0,
        completedAt: completedAt.get(k) ?? null,
        dueAt: dueAt.get(workId) ?? null,
        now,
      }),
      minutes: Math.round((seconds.get(k) ?? 0) / 60),
      lastReminderAt: reminded.get(k) ?? null,
    };
  };
}

// ───────────────────────── Teacher: assigning ─────────────────────────

/** Works a teacher can assign: published and readable. */
export function listAssignableWorks() {
  return db.work.findMany({
    where: { status: "PUBLISHED", segments: { some: { archivedAt: null } } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, author: true },
  });
}

function parseDueDate(date: string, now: Date): Date {
  const dueAt = dueAtFromDate(date);
  if (!dueAt) throw new DomainError("INVALID_INPUT", "Hạn đọc không hợp lệ.");
  if (dueAt.getTime() < now.getTime()) throw new DomainError("INVALID_INPUT", "Hạn đọc không được ở trong quá khứ.");
  return dueAt;
}

/** Assigns a work to a class and notifies its current students. */
export async function createAssignment(
  actor: Actor,
  input: { classId: string; workId: string; dueDate: string },
  now = new Date(),
) {
  await assertTeacherOfClass(actor, input.classId);
  const dueAt = parseDueDate(input.dueDate, now);
  const work = await db.work.findFirst({
    where: { id: input.workId, status: "PUBLISHED" },
    select: { id: true, slug: true, title: true },
  });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  const existing = await db.assignment.findUnique({
    where: { classId_workId: { classId: input.classId, workId: work.id } },
    select: { id: true },
  });
  if (existing) {
    throw new DomainError("ALREADY_EXISTS", `Lớp đã được giao “${work.title}”. Bạn có thể đổi hạn trong danh sách bài giao.`);
  }

  const members = await activeMembers(input.classId);
  const assignment = await db.$transaction(async (tx) => {
    const created = await tx.assignment.create({ data: { classId: input.classId, workId: work.id, dueAt } });
    if (members.length > 0) {
      await tx.notification.createMany({
        data: members.map((m) => ({
          userId: m.id,
          kind: "ASSIGNMENT" as const,
          title: `Bài mới: ${work.title}`,
          body: `Hạn đọc: ${formatDate(dueAt)}.`,
          href: `/student/works/${work.slug}`,
          senderId: actor.id,
          workId: work.id,
        })),
      });
    }
    return created;
  });
  return { assignment, work, notified: members.length };
}

async function teacherAssignment(actor: Actor, assignmentId: string) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, classId: true, dueAt: true, work: { select: { id: true, slug: true, title: true } } },
  });
  if (!assignment) notFound("Không tìm thấy bài giao.");
  await assertTeacherOfClass(actor, assignment.classId);
  return assignment;
}

export async function updateAssignmentDue(actor: Actor, assignmentId: string, dueDate: string, now = new Date()) {
  const assignment = await teacherAssignment(actor, assignmentId);
  const dueAt = parseDueDate(dueDate, now);
  return db.assignment.update({ where: { id: assignment.id }, data: { dueAt } });
}

/** Removes the assignment. Students keep their progress and any bonus already earned. */
export async function deleteAssignment(actor: Actor, assignmentId: string) {
  const assignment = await teacherAssignment(actor, assignmentId);
  await db.assignment.delete({ where: { id: assignment.id } });
  return assignment;
}

/** Don't send the same student a second reminder about a work within this window. */
export const REMINDER_COOLDOWN_MS = 10 * 60_000;

/**
 * Teacher reminds students who have not finished an assigned work. Ids that
 * are not current members, already finished, or were reminded moments ago
 * are skipped.
 */
export async function remindStudents(
  actor: Actor,
  assignmentId: string,
  studentIds: string[],
  message: string | null,
  now = new Date(),
) {
  const assignment = await teacherAssignment(actor, assignmentId);
  const memberIds = new Set((await activeMembers(assignment.classId)).map((m) => m.id));
  const targets = [...new Set(studentIds)].filter((id) => memberIds.has(id));
  const [finished, recent] = await Promise.all([
    db.workCompletion.findMany({ where: { workId: assignment.work.id, userId: { in: targets } }, select: { userId: true } }),
    db.notification.findMany({
      where: {
        kind: "REMINDER",
        workId: assignment.work.id,
        userId: { in: targets },
        createdAt: { gte: new Date(now.getTime() - REMINDER_COOLDOWN_MS) },
      },
      select: { userId: true },
    }),
  ]);
  const skip = new Set([...finished, ...recent].map((r) => r.userId));
  const recipients = targets.filter((id) => !skip.has(id));
  const text = message?.trim() || `Hạn đọc ${formatDate(assignment.dueAt)} (${dueLabel(assignment.dueAt, now)}). Đọc tiếp nhé!`;
  if (recipients.length > 0) {
    await db.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        kind: "REMINDER" as const,
        title: `Nhắc đọc: ${assignment.work.title}`,
        body: text,
        href: `/student/works/${assignment.work.slug}`,
        senderId: actor.id,
        workId: assignment.work.id,
        createdAt: now,
      })),
    });
  }
  return { sent: recipients.length, skipped: studentIds.length - recipients.length };
}

// ───────────────────────── Student side ─────────────────────────

export type StudentAssignment = {
  id: string;
  dueAt: Date;
  dueLabel: string;
  work: { id: string; slug: string; title: string; author: string; genre: Genre; coverUrl: string | null };
  progress: ProgressCell;
  /** Latest reminder from the teacher, shown until the work is finished. */
  reminder: { body: string | null; from: string | null; at: Date } | null;
};

/** Works the student's current class assigned: unfinished first (soonest deadline first), then finished. */
export async function listStudentAssignments(userId: string, now = new Date()): Promise<StudentAssignment[]> {
  const membership = await db.classMembership.findFirst({ where: { studentId: userId, leftAt: null }, select: { classId: true } });
  if (!membership) return [];
  const assignments = await db.assignment.findMany({
    where: { classId: membership.classId, work: { status: "PUBLISHED" } },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      dueAt: true,
      work: { select: { id: true, slug: true, title: true, author: true, genre: true, coverUrl: true } },
    },
  });
  if (assignments.length === 0) return [];
  const [cell, reminders] = await Promise.all([
    progressMatrix(
      [userId],
      assignments.map((a) => ({ workId: a.work.id, dueAt: a.dueAt })),
      now,
    ),
    db.notification.findMany({
      where: { userId, kind: "REMINDER", workId: { in: assignments.map((a) => a.work.id) } },
      orderBy: { createdAt: "desc" },
      select: { workId: true, body: true, createdAt: true, sender: { select: { name: true } } },
    }),
  ]);
  const latest = new Map<string, (typeof reminders)[number]>();
  for (const r of reminders) if (r.workId && !latest.has(r.workId)) latest.set(r.workId, r);

  const rows = assignments.map((a) => {
    const progress = cell(userId, a.work.id);
    const r = latest.get(a.work.id);
    return {
      id: a.id,
      dueAt: a.dueAt,
      dueLabel: dueLabel(a.dueAt, now),
      work: a.work,
      progress,
      reminder: r && progress.status !== "done" ? { body: r.body, from: r.sender?.name ?? null, at: r.createdAt } : null,
    };
  });
  return [...rows.filter((r) => r.progress.status !== "done"), ...rows.filter((r) => r.progress.status === "done")];
}

/** The deadline for this work in the student's current class, if it is assigned. */
export async function getStudentDeadline(userId: string, workId: string, now = new Date()) {
  const assignment = await db.assignment.findFirst({
    where: { workId, class: { memberships: { some: { studentId: userId, leftAt: null } } } },
    select: { dueAt: true },
  });
  return assignment ? { dueAt: assignment.dueAt, passed: now.getTime() > assignment.dueAt.getTime() } : null;
}
