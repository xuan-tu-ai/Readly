import type { HighlightColor } from "@/generated/prisma/enums";
import { AVATARS, avatarFor } from "@/lib/art";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";

/**
 * "Hồ sơ đọc" (spec §12): the student's reading history, every highlight they
 * kept (filterable by colour and work) and their avatar.
 */

export type ReadingHistory = Awaited<ReturnType<typeof getReadingHistory>>;

/** Works in progress (with % of segments read) and completed works, newest first. */
export async function getReadingHistory(userId: string) {
  const [progress, completions] = await Promise.all([
    db.readingProgress.findMany({
      where: { userId, work: { status: "PUBLISHED" } },
      orderBy: { updatedAt: "desc" },
      select: {
        updatedAt: true,
        work: {
          select: {
            id: true,
            slug: true,
            title: true,
            author: true,
            genre: true,
            coverUrl: true,
            _count: { select: { segments: { where: { archivedAt: null } } } },
          },
        },
      },
    }),
    db.workCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        onTime: true,
        work: { select: { id: true, slug: true, title: true, author: true, genre: true, coverUrl: true } },
      },
    }),
  ]);

  const done = new Set(completions.map((c) => c.work.id));
  const open = progress.filter((p) => !done.has(p.work.id));
  const reads = open.length
    ? await db.segmentRead.findMany({
        where: { userId, segment: { workId: { in: open.map((p) => p.work.id) }, archivedAt: null } },
        select: { segment: { select: { workId: true } } },
      })
    : [];
  const readCount = new Map<string, number>();
  for (const r of reads) readCount.set(r.segment.workId, (readCount.get(r.segment.workId) ?? 0) + 1);

  return {
    reading: open.map(({ updatedAt, work: { _count, ...work } }) => {
      const total = _count.segments;
      const read = Math.min(readCount.get(work.id) ?? 0, total);
      return { ...work, total, read, percent: total ? Math.round((read / total) * 100) : 0, lastReadAt: updatedAt };
    }),
    completed: completions.map((c) => ({ ...c.work, completedAt: c.completedAt, onTime: c.onTime })),
  };
}

export type HighlightFilter = { color?: HighlightColor; work?: string };

/**
 * Every highlight the student kept, newest first. Highlights whose text was
 * edited away (or whose segment was removed) stay here, marked as such.
 */
export async function listProfileHighlights(userId: string, filter: HighlightFilter = {}, take = 200) {
  const rows = await db.highlight.findMany({
    where: {
      userId,
      ...(filter.color ? { color: filter.color } : {}),
      ...(filter.work ? { work: { slug: filter.work } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      quote: true,
      note: true,
      color: true,
      start: true,
      end: true,
      createdAt: true,
      orphanedAt: true,
      segment: { select: { id: true, order: true, title: true, archivedAt: true } },
      work: { select: { slug: true, title: true, status: true } },
    },
  });
  return rows.map(({ segment, work, orphanedAt, ...h }) => ({
    ...h,
    work: { slug: work.slug, title: work.title },
    segment: { id: segment.id, title: segment.title ?? `Phần ${segment.order}` },
    /** No longer in the text: shown, but there is nothing to open in the reader. */
    gone: orphanedAt !== null || segment.archivedAt !== null || work.status !== "PUBLISHED",
  }));
}

export type ProfileHighlight = Awaited<ReturnType<typeof listProfileHighlights>>[number];

/** Filter options: the works the student highlighted in, and how many per colour. */
export async function getHighlightFacets(userId: string) {
  const [byWork, byColor] = await Promise.all([
    db.highlight.groupBy({ by: ["workId"], where: { userId }, _count: { _all: true } }),
    db.highlight.groupBy({ by: ["color"], where: { userId }, _count: { _all: true } }),
  ]);
  const works = byWork.length
    ? await db.work.findMany({ where: { id: { in: byWork.map((w) => w.workId) } }, select: { id: true, slug: true, title: true } })
    : [];
  const count = new Map(byWork.map((w) => [w.workId, w._count._all]));
  return {
    total: byColor.reduce((sum, c) => sum + c._count._all, 0),
    colors: Object.fromEntries(byColor.map((c) => [c.color, c._count._all])) as Partial<Record<HighlightColor, number>>,
    works: works
      .map((w) => ({ slug: w.slug, title: w.title, count: count.get(w.id) ?? 0 }))
      .sort((a, b) => a.title.localeCompare(b.title, "vi")),
  };
}

export async function getAvatar(userId: string) {
  const state = await db.playerState.findUnique({ where: { userId }, select: { avatar: true } });
  return avatarFor(userId, state?.avatar);
}

export async function setAvatar(actor: Actor, avatar: string) {
  assertRole(actor, "STUDENT");
  if (!AVATARS.some((a) => a.key === avatar)) throw new DomainError("INVALID_INPUT", "Avatar không hợp lệ.");
  await db.playerState.upsert({
    where: { userId: actor.id },
    create: { userId: actor.id, avatar },
    update: { avatar },
  });
}
