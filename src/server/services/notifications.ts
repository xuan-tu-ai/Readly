import type { NotificationKind } from "@/generated/prisma/enums";
import { DEADLINE_STAGES, deadlineStage } from "@/lib/discussion";
import type { Actor } from "@/lib/roles";
import { formatDate } from "@/lib/vn-date";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { QUEUES, enqueue } from "@/server/queue";

/**
 * In-app notifications (the bell) and their delivery by web push (spec §11).
 * Every source goes through `notify`, which stores the rows and queues one
 * push job; the worker sends the pushes (src/server/push.ts).
 */

export type NotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  senderId?: string | null;
  workId?: string | null;
  /** Notices with the same key for the same user are only ever stored once. */
  dedupeKey?: string | null;
  createdAt?: Date;
};

/** Stores notifications (skipping duplicates by dedupe key) and queues their push. */
export async function notify(inputs: NotificationInput[]) {
  if (inputs.length === 0) return [];
  const created = await db.notification.createManyAndReturn({
    data: inputs.map((n) => ({
      userId: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
      senderId: n.senderId ?? null,
      workId: n.workId ?? null,
      dedupeKey: n.dedupeKey ?? null,
      ...(n.createdAt ? { createdAt: n.createdAt } : {}),
    })),
    skipDuplicates: true,
    select: { id: true, userId: true },
  });
  if (created.length > 0) {
    // Push is best effort: the notification is already in the bell either way.
    await enqueue(QUEUES.pushNotifications, { ids: created.map((n) => n.id) }).catch((error) =>
      console.error("[notify] không xếp được job push", error),
    );
  }
  return created;
}

// ───────────────────────── The bell ─────────────────────────

const PAGE = 30;

export async function listNotifications(userId: string, limit = PAGE) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  });
}

export type NotificationView = Awaited<ReturnType<typeof listNotifications>>[number];

export function countUnread(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(actor: Actor, id: string) {
  const { count } = await db.notification.updateMany({
    where: { id, userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (count === 0 && !(await db.notification.findFirst({ where: { id, userId: actor.id }, select: { id: true } }))) {
    notFound("Không tìm thấy thông báo.");
  }
}

export async function markAllNotificationsRead(actor: Actor) {
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: new Date() } });
}

// ───────────────────────── Automatic deadline reminders ─────────────────────────

/**
 * Cron job (hourly): reminds students of assigned works they have not
 * finished, 2 days and 1 day before the deadline. Each stage goes out once
 * per student thanks to the dedupe key, however often the job runs.
 */
export async function sendDeadlineReminders(now = new Date()) {
  const soon = new Date(now.getTime() + (DEADLINE_STAGES[0] + 1) * 86_400_000);
  const assignments = await db.assignment.findMany({
    where: { dueAt: { gt: now, lte: soon }, work: { status: "PUBLISHED" } },
    select: {
      id: true,
      classId: true,
      dueAt: true,
      work: { select: { id: true, slug: true, title: true } },
      class: { select: { memberships: { where: { leftAt: null }, select: { studentId: true } } } },
    },
  });
  let sent = 0;
  for (const a of assignments) {
    const stage = deadlineStage(a.dueAt, now);
    if (!stage) continue;
    const students = a.class.memberships.map((m) => m.studentId);
    const finished = new Set(
      (
        await db.workCompletion.findMany({
          where: { workId: a.work.id, userId: { in: students } },
          select: { userId: true },
        })
      ).map((c) => c.userId),
    );
    const created = await notify(
      students
        .filter((id) => !finished.has(id))
        .map((userId) => ({
          userId,
          kind: "REMINDER" as const,
          title: `Còn ${stage} ngày: ${a.work.title}`,
          body: `Hạn đọc ${formatDate(a.dueAt)}. Bạn chưa hoàn thành tác phẩm này, đọc tiếp nhé!`,
          href: `/student/works/${a.work.slug}`,
          workId: a.work.id,
          dedupeKey: `deadline:${a.id}:${stage}`,
          createdAt: now,
        })),
    );
    sent += created.length;
  }
  return { sent };
}
