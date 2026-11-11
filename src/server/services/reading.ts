import { z } from "zod";
import type { HighlightColor, ReadingTheme } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/roles";
import { vnDay } from "@/lib/reading/active-time";
import { htmlToText } from "@/lib/reading/html-text";
import { sanitizeSegmentHtml } from "@/lib/reading/sanitize";
import { anchorFor, snapToWords } from "@/lib/reading/text";
import { db } from "@/server/db";
import { assertRole } from "@/server/authz";
import { DomainError, notFound } from "@/server/errors";
import { emit } from "@/server/events";
import { getCompletionStatus, getQuestionsForReader, refreshCompletion } from "./questions";

// ───────────────────────── Reader data ─────────────────────────

/** Everything the reading page needs for one student and one published work. */
export async function getReader(actor: Actor, slug: string) {
  assertRole(actor, "STUDENT");
  const work = await db.work.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      genre: true,
      background: true,
      segments: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, content: true },
      },
    },
  });
  if (!work) return null;

  const segmentIds = work.segments.map((s) => s.id);
  const [progress, reads, highlights, settings, questions, completion] = await Promise.all([
    db.readingProgress.findUnique({
      where: { userId_workId: { userId: actor.id, workId: work.id } },
      select: { segmentId: true, segmentFraction: true },
    }),
    db.segmentRead.findMany({
      where: { userId: actor.id, segmentId: { in: segmentIds } },
      select: { segmentId: true },
    }),
    listOwnHighlights(actor.id, work.id),
    getReadingSettings(actor.id),
    getQuestionsForReader(actor.id, work.id),
    getCompletionStatus(actor.id, work.id),
  ]);

  return {
    work: {
      id: work.id,
      slug: work.slug,
      title: work.title,
      author: work.author,
      genre: work.genre,
      background: work.background ? sanitizeSegmentHtml(work.background) : null,
    },
    segments: work.segments.map((s) => ({ ...s, content: sanitizeSegmentHtml(s.content) })),
    progress,
    readSegmentIds: reads.map((r) => r.segmentId),
    highlights,
    settings,
    questions,
    completion,
  };
}

export type ReaderData = NonNullable<Awaited<ReturnType<typeof getReader>>>;

/** A segment of a published work, or a NOT_FOUND error. */
async function readableSegment(segmentId: string) {
  const segment = await db.segment.findFirst({
    where: { id: segmentId, archivedAt: null, work: { status: "PUBLISHED" } },
    select: { id: true, workId: true, content: true },
  });
  if (!segment) notFound("Không tìm thấy phân đoạn.");
  return segment;
}

// ───────────────────────── Progress & tracking ─────────────────────────

export async function saveProgress(actor: Actor, segmentId: string, fraction: number) {
  assertRole(actor, "STUDENT");
  const segment = await readableSegment(segmentId);
  const segmentFraction = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  await db.readingProgress.upsert({
    where: { userId_workId: { userId: actor.id, workId: segment.workId } },
    update: { segmentId, segmentFraction },
    create: { userId: actor.id, workId: segment.workId, segmentId, segmentFraction },
  });
}

/** Idempotent: reading a segment twice keeps the first time. */
export async function markSegmentsRead(actor: Actor, segmentIds: string[]) {
  assertRole(actor, "STUDENT");
  if (segmentIds.length === 0) return;
  const segments = await db.segment.findMany({
    where: { id: { in: segmentIds }, archivedAt: null, work: { status: "PUBLISHED" } },
    select: { id: true, workId: true },
  });
  const { count } = await db.segmentRead.createMany({
    data: segments.map((s) => ({ userId: actor.id, segmentId: s.id })),
    skipDuplicates: true,
  });
  if (count === 0) return;
  // Reading the last segment can complete the work.
  for (const workId of new Set(segments.map((s) => s.workId))) {
    const ids = segments.filter((s) => s.workId === workId).map((s) => s.id);
    await emit({ type: "SegmentsRead", userId: actor.id, workId, segmentIds: ids });
    await refreshCompletion(actor.id, workId);
  }
}

/** Limits per request: the client flushes every ~30 s, so more than this is not real reading. */
export const MAX_SECONDS_PER_SEGMENT = 60;
export const MAX_SECONDS_PER_REQUEST = 120;

export async function addReadingTime(actor: Actor, seconds: Record<string, number>, now = new Date()) {
  assertRole(actor, "STUDENT");
  let budget = MAX_SECONDS_PER_REQUEST;
  const entries: [string, number][] = [];
  for (const [segmentId, raw] of Object.entries(seconds)) {
    const value = Math.min(Math.floor(Number(raw) || 0), MAX_SECONDS_PER_SEGMENT, budget);
    if (value <= 0) continue;
    entries.push([segmentId, value]);
    budget -= value;
  }
  if (entries.length === 0) return;

  const valid = new Set(
    (
      await db.segment.findMany({
        where: { id: { in: entries.map(([id]) => id) }, archivedAt: null, work: { status: "PUBLISHED" } },
        select: { id: true },
      })
    ).map((s) => s.id),
  );
  const day = vnDay(now);
  for (const [segmentId, value] of entries) {
    if (!valid.has(segmentId)) continue;
    await db.readingTime.upsert({
      where: { userId_segmentId_day: { userId: actor.id, segmentId, day } },
      update: { seconds: { increment: value } },
      create: { userId: actor.id, segmentId, day, seconds: value },
    });
  }
}

export const trackPayloadSchema = z.object({
  progress: z.object({ segmentId: z.string().min(1), fraction: z.number() }).optional(),
  read: z.array(z.string().min(1)).max(50).optional(),
  time: z.record(z.string(), z.number()).optional(),
});

export type TrackPayload = z.infer<typeof trackPayloadSchema>;

/** One call from the reader's tracker (progress + read segments + active time). */
export async function track(actor: Actor, payload: TrackPayload) {
  if (payload.read?.length) await markSegmentsRead(actor, payload.read);
  if (payload.time) await addReadingTime(actor, payload.time);
  if (payload.progress) await saveProgress(actor, payload.progress.segmentId, payload.progress.fraction);
}

/** The work the student touched most recently, for "Tiếp tục đọc". */
export async function getContinueReading(userId: string) {
  const progress = await db.readingProgress.findFirst({
    where: { userId, work: { status: "PUBLISHED" } },
    orderBy: { updatedAt: "desc" },
    select: {
      updatedAt: true,
      work: {
        select: {
          slug: true,
          title: true,
          author: true,
          genre: true,
          coverUrl: true,
          segments: { where: { archivedAt: null }, select: { id: true } },
        },
      },
    },
  });
  if (!progress) return null;
  const { segments, ...work } = progress.work;
  const read = await db.segmentRead.count({
    where: { userId, segmentId: { in: segments.map((s) => s.id) } },
  });
  return { ...work, totalSegments: segments.length, readSegments: read, updatedAt: progress.updatedAt };
}

export async function getWorkProgress(userId: string, workId: string) {
  const [total, read, progress] = await Promise.all([
    db.segment.count({ where: { workId, archivedAt: null } }),
    db.segmentRead.count({ where: { userId, segment: { workId, archivedAt: null } } }),
    db.readingProgress.findUnique({ where: { userId_workId: { userId, workId } }, select: { workId: true } }),
  ]);
  return { started: progress !== null, total, read };
}

// ───────────────────────── Settings ─────────────────────────

export const FONT_SIZES = [16, 18, 20, 22, 24] as const;
export const LINE_HEIGHTS = [1.5, 1.7, 1.9] as const;

export const readingSettingsSchema = z.object({
  fontSize: z.coerce.number().refine((v) => (FONT_SIZES as readonly number[]).includes(v)),
  lineHeight: z.coerce.number().refine((v) => (LINE_HEIGHTS as readonly number[]).includes(v)),
  theme: z.enum(["LIGHT", "SEPIA", "DARK"]),
});

export type ReadingSettings = { fontSize: number; lineHeight: number; theme: ReadingTheme };

export async function getReadingSettings(userId: string): Promise<ReadingSettings> {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { fontSize: true, lineHeight: true, theme: true },
  });
  return settings ?? { fontSize: 18, lineHeight: 1.7, theme: "LIGHT" };
}

export async function updateReadingSettings(actor: Actor, settings: ReadingSettings) {
  await db.userSettings.upsert({
    where: { userId: actor.id },
    update: settings,
    create: { userId: actor.id, ...settings },
  });
}

// ───────────────────────── Highlights ─────────────────────────

export const HIGHLIGHT_COLORS = ["YELLOW", "BLUE", "PINK", "PURPLE"] as const satisfies readonly HighlightColor[];
export const MAX_HIGHLIGHT_LENGTH = 1000;
export const MAX_NOTE_LENGTH = 500;

const highlightSelect = {
  id: true,
  segmentId: true,
  start: true,
  end: true,
  quote: true,
  color: true,
  note: true,
  isPrivate: true,
  createdAt: true,
} as const;

export type OwnHighlight = Awaited<ReturnType<typeof listOwnHighlights>>[number];

export function listOwnHighlights(userId: string, workId: string) {
  return db.highlight.findMany({
    where: { userId, workId },
    orderBy: [{ segment: { order: "asc" } }, { start: "asc" }],
    select: highlightSelect,
  });
}

export const createHighlightSchema = z.object({
  segmentId: z.string().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  color: z.enum(HIGHLIGHT_COLORS),
});

/**
 * The client sends offsets; the server re-derives the quote and context from
 * the stored text so a highlight can never claim text the work doesn't have.
 */
export async function createHighlight(actor: Actor, input: z.infer<typeof createHighlightSchema>) {
  assertRole(actor, "STUDENT");
  const segment = await readableSegment(input.segmentId);
  const text = htmlToText(sanitizeSegmentHtml(segment.content));
  const span = snapToWords(text, input.start, input.end);
  if (!span || span.end > text.length) {
    throw new DomainError("NOT_FOUND", "Đoạn được chọn không hợp lệ.");
  }
  if (span.end - span.start > MAX_HIGHLIGHT_LENGTH) {
    throw new DomainError("FORBIDDEN", "Đoạn tô sáng quá dài (tối đa 1000 ký tự).");
  }
  return db.highlight.create({
    data: {
      userId: actor.id,
      workId: segment.workId,
      segmentId: segment.id,
      start: span.start,
      end: span.end,
      color: input.color,
      ...anchorFor(text, span),
    },
    select: highlightSelect,
  });
}

export const updateHighlightSchema = z.object({
  id: z.string().min(1),
  color: z.enum(HIGHLIGHT_COLORS).optional(),
  note: z
    .string()
    .trim()
    .max(MAX_NOTE_LENGTH, { error: `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.` })
    .transform((v) => v || null)
    .nullable()
    .optional(),
  isPrivate: z.boolean().optional(),
});

async function ownHighlight(actor: Actor, id: string) {
  const highlight = await db.highlight.findUnique({ where: { id }, select: { userId: true } });
  if (!highlight || highlight.userId !== actor.id) notFound("Không tìm thấy đoạn tô sáng.");
}

export async function updateHighlight(actor: Actor, input: z.infer<typeof updateHighlightSchema>) {
  await ownHighlight(actor, input.id);
  const { id, ...data } = input;
  return db.highlight.update({ where: { id }, data, select: highlightSelect });
}

export async function deleteHighlight(actor: Actor, id: string) {
  await ownHighlight(actor, id);
  await db.highlight.delete({ where: { id } });
}
