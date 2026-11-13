import type { Prisma } from "@/generated/prisma/client";
import type { WorkStatus } from "@/generated/prisma/enums";
import { normalizeSearch, workSearchText } from "@/lib/catalog";
import type { SegmentDraft } from "@/lib/content/segmenter";
import type { WorkInput } from "@/lib/content/schemas";
import { htmlToText } from "@/lib/reading/html-text";
import { reanchor } from "@/lib/reading/reanchor";
import { sanitizeSegmentHtml } from "@/lib/reading/sanitize";
import { anchorFor } from "@/lib/reading/text";
import type { Actor } from "@/lib/roles";
import { assertRole } from "@/server/authz";
import { db, type Tx } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";

/**
 * Admin: works, tags, segments and highlight re-anchoring (spec §3.2–3.4, §13).
 * Segment ids stay stable when text is edited; a segment that students
 * already used is archived instead of deleted.
 */

// ───────────────────────── Works ─────────────────────────

export const STATUS_LABEL: Record<WorkStatus, string> = { DRAFT: "Nháp", PUBLISHED: "Đã xuất bản", COMING_SOON: "Sắp có" };

export async function listAdminWorks(actor: Actor, filter: { q?: string; status?: WorkStatus } = {}) {
  assertRole(actor, "ADMIN");
  const q = filter.q ? normalizeSearch(filter.q) : "";
  const works = await db.work.findMany({
    where: { ...(q ? { searchText: { contains: q } } : {}), ...(filter.status ? { status: filter.status } : {}) },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      genre: true,
      status: true,
      updatedAt: true,
      _count: { select: { segments: { where: { archivedAt: null } }, questions: true, miniGames: true } },
    },
  });
  return works.map(({ _count, ...w }) => ({ ...w, segments: _count.segments, questions: _count.questions, games: _count.miniGames }));
}

/** "Chí Phèo" → "chi-pheo", unique among works. */
async function uniqueSlug(title: string, client: Tx | typeof db = db, exceptId?: string) {
  const base =
    normalizeSearch(title)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "tac-pham";
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const taken = await client.work.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === exceptId) return slug;
  }
  throw new DomainError("ALREADY_EXISTS", "Không tạo được đường dẫn cho tác phẩm, hãy đổi tên.");
}

export async function createWork(actor: Actor, input: Pick<WorkInput, "title" | "author" | "genre">) {
  assertRole(actor, "ADMIN");
  return db.work.create({
    data: {
      ...input,
      slug: await uniqueSlug(input.title),
      authorBio: "",
      summary: "",
      difficulty: 2,
      estMinutes: 15,
      status: "DRAFT",
      searchText: workSearchText(input),
    },
    select: { id: true },
  });
}

export async function getAdminWork(actor: Actor, id: string) {
  assertRole(actor, "ADMIN");
  const work = await db.work.findUnique({
    where: { id },
    include: {
      tags: { select: { tag: { select: { id: true, slug: true, label: true, kind: true } } } },
      segments: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          content: true,
          _count: { select: { highlights: true, questions: true, reads: true, unlocksGames: true } },
        },
      },
      _count: { select: { progress: true, completions: true, highlights: true } },
    },
  });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  const orphaned = await db.highlight.count({ where: { workId: id, orphanedAt: { not: null } } });
  return { ...work, tags: work.tags.map((t) => t.tag), orphanedHighlights: orphaned };
}

export type AdminWork = Awaited<ReturnType<typeof getAdminWork>>;

export async function updateWork(actor: Actor, id: string, input: WorkInput) {
  assertRole(actor, "ADMIN");
  const work = await db.work.findUnique({ where: { id }, select: { id: true, _count: { select: { segments: { where: { archivedAt: null } } } } } });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  if (input.status === "PUBLISHED" && work._count.segments === 0) {
    throw new DomainError("INVALID_INPUT", "Cần ít nhất một phân đoạn văn bản trước khi xuất bản.");
  }
  const tags = await db.tag.findMany({ where: { slug: { in: input.tags } }, select: { id: true } });
  await db.$transaction([
    db.work.update({
      where: { id },
      data: {
        title: input.title,
        author: input.author,
        authorBio: input.authorBio,
        genre: input.genre,
        summary: input.summary,
        difficulty: input.difficulty,
        estMinutes: input.estMinutes,
        status: input.status,
        background: input.background ? sanitizeSegmentHtml(input.background) : null,
        searchText: workSearchText(input),
      },
    }),
    db.workTag.deleteMany({ where: { workId: id } }),
    db.workTag.createMany({ data: tags.map((t) => ({ workId: id, tagId: t.id })) }),
  ]);
}

/** Only drafts nobody has read can be deleted; anything else is unpublished instead. */
export async function deleteWork(actor: Actor, id: string) {
  assertRole(actor, "ADMIN");
  const work = await db.work.findUnique({
    where: { id },
    select: { status: true, _count: { select: { progress: true, highlights: true, completions: true, assignments: true, posts: true } } },
  });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  const used = Object.values(work._count).some((n) => n > 0);
  if (work.status !== "DRAFT" || used) {
    throw new DomainError("INVALID_INPUT", "Chỉ xóa được tác phẩm nháp chưa có học sinh dùng. Hãy chuyển về Nháp để ẩn tác phẩm.");
  }
  const answered = await db.answer.count({ where: { question: { workId: id } } });
  if (answered > 0) throw new DomainError("INVALID_INPUT", "Tác phẩm đã có câu trả lời của học sinh, không xóa được.");
  await db.work.delete({ where: { id } });
}

export function listTags() {
  return db.tag.findMany({ orderBy: [{ kind: "asc" }, { label: "asc" }], select: { id: true, slug: true, label: true, kind: true } });
}

export async function createTag(actor: Actor, input: { label: string; kind: "THEME" | "MOOD" }) {
  assertRole(actor, "ADMIN");
  const slug = normalizeSearch(input.label).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new DomainError("INVALID_INPUT", "Tên tag không hợp lệ.");
  if (await db.tag.findUnique({ where: { slug }, select: { id: true } })) {
    throw new DomainError("ALREADY_EXISTS", "Tag này đã có.");
  }
  return db.tag.create({ data: { slug, label: input.label, kind: input.kind } });
}

// ───────────────────────── Segments ─────────────────────────

async function liveSegments(workId: string, client: Tx | typeof db = db) {
  return client.segment.findMany({ where: { workId, archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, order: true, title: true, content: true } });
}

/** True if students or content already point at this segment (then it is archived, not deleted). */
async function segmentInUse(id: string, client: Tx | typeof db = db) {
  const s = await client.segment.findUnique({
    where: { id },
    select: { _count: { select: { reads: true, highlights: true, questions: true, unlocksGames: true, readingTimes: true, progress: true, quotedBy: true } } },
  });
  return s ? Object.values(s._count).some((n) => n > 0) : false;
}

async function retire(id: string, client: Tx | typeof db) {
  if (await segmentInUse(id, client)) await client.segment.update({ where: { id }, data: { archivedAt: new Date() } });
  else await client.segment.delete({ where: { id } });
}

async function renumber(workId: string, client: Tx | typeof db) {
  const segments = await liveSegments(workId, client);
  // Two passes so the temporary orders never collide with the final ones.
  for (const [i, s] of segments.entries()) await client.segment.update({ where: { id: s.id }, data: { order: 10_000 + i } });
  for (const [i, s] of segments.entries()) await client.segment.update({ where: { id: s.id }, data: { order: i + 1 } });
}

/**
 * Saves imported (or re-imported) text. Segments are matched by position: the
 * n-th existing segment keeps its id and gets the n-th new text, extra ones
 * are added, leftovers retired. Highlights are re-anchored afterwards.
 */
export async function replaceSegments(actor: Actor, workId: string, drafts: SegmentDraft[]) {
  assertRole(actor, "ADMIN");
  if (!(await db.work.findUnique({ where: { id: workId }, select: { id: true } }))) notFound("Không tìm thấy tác phẩm.");
  const clean = drafts.map((d) => ({ title: d.title.trim() || null, content: sanitizeSegmentHtml(d.html) })).filter((d) => htmlToText(d.content).trim());
  if (clean.length === 0) throw new DomainError("INVALID_INPUT", "Văn bản trống.");
  await db.$transaction(
    async (tx) => {
      const existing = await liveSegments(workId, tx);
      for (const [i, d] of clean.entries()) {
        const old = existing[i];
        if (old) await tx.segment.update({ where: { id: old.id }, data: { title: d.title, content: d.content, order: 10_000 + i } });
        else await tx.segment.create({ data: { workId, title: d.title, content: d.content, order: 10_000 + i } });
      }
      for (const old of existing.slice(clean.length)) await retire(old.id, tx);
      await renumber(workId, tx);
    },
    { timeout: 30_000 },
  );
  return reanchorWorkHighlights(workId);
}

export async function updateSegment(actor: Actor, segmentId: string, input: { title: string; html: string }) {
  assertRole(actor, "ADMIN");
  const segment = await db.segment.findFirst({ where: { id: segmentId, archivedAt: null }, select: { id: true, workId: true, content: true } });
  if (!segment) notFound("Không tìm thấy phân đoạn.");
  const content = sanitizeSegmentHtml(input.html);
  if (!htmlToText(content).trim()) throw new DomainError("INVALID_INPUT", "Phân đoạn không được trống.");
  await db.segment.update({ where: { id: segmentId }, data: { title: input.title.trim() || null, content } });
  return content === segment.content ? null : reanchorWorkHighlights(segment.workId);
}

export async function addSegment(actor: Actor, workId: string) {
  assertRole(actor, "ADMIN");
  const last = await db.segment.findFirst({ where: { workId, archivedAt: null }, orderBy: { order: "desc" }, select: { order: true } });
  return db.segment.create({
    data: { workId, order: (last?.order ?? 0) + 1, title: null, content: "<p>Văn bản mới.</p>" },
    select: { id: true },
  });
}

export async function moveSegment(actor: Actor, segmentId: string, direction: -1 | 1) {
  assertRole(actor, "ADMIN");
  const segment = await db.segment.findFirst({ where: { id: segmentId, archivedAt: null }, select: { workId: true } });
  if (!segment) notFound("Không tìm thấy phân đoạn.");
  await db.$transaction(async (tx) => {
    const list = await liveSegments(segment.workId, tx);
    const i = list.findIndex((s) => s.id === segmentId);
    const j = i + direction;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    for (const [k, s] of list.entries()) await tx.segment.update({ where: { id: s.id }, data: { order: 10_000 + k } });
    for (const [k, s] of list.entries()) await tx.segment.update({ where: { id: s.id }, data: { order: k + 1 } });
  });
}

/** Removes a segment: archived (kept for history) if anything refers to it, else deleted. */
export async function removeSegment(actor: Actor, segmentId: string) {
  assertRole(actor, "ADMIN");
  const segment = await db.segment.findFirst({ where: { id: segmentId, archivedAt: null }, select: { workId: true, work: { select: { status: true } } } });
  if (!segment) notFound("Không tìm thấy phân đoạn.");
  const left = await db.segment.count({ where: { workId: segment.workId, archivedAt: null } });
  if (left <= 1 && segment.work.status === "PUBLISHED") {
    throw new DomainError("INVALID_INPUT", "Tác phẩm đã xuất bản cần ít nhất một phân đoạn.");
  }
  await db.$transaction(async (tx) => {
    await retire(segmentId, tx);
    await renumber(segment.workId, tx);
  });
  return reanchorWorkHighlights(segment.workId);
}

// ───────────────────────── Re-anchoring highlights ─────────────────────────

/**
 * After the text of a work changed: finds every highlight again (same place,
 * moved, slightly edited, or in another segment); the ones that cannot be
 * found are orphaned but kept for the student's profile. Discussion quotes
 * are re-anchored the same way. Fast enough to run right after saving.
 */
export async function reanchorWorkHighlights(workId: string) {
  const segments = (await liveSegments(workId)).map((s) => ({ id: s.id, text: htmlToText(sanitizeSegmentHtml(s.content)) }));
  const textOf = new Map(segments.map((s) => [s.id, s.text]));
  const highlights = await db.highlight.findMany({
    where: { workId },
    select: { id: true, segmentId: true, start: true, end: true, quote: true, prefix: true, suffix: true, orphanedAt: true },
  });
  const counts = { unchanged: 0, moved: 0, orphaned: 0 };
  for (const h of highlights) {
    const found = reanchor(h, segments);
    if (!found) {
      counts.orphaned++;
      if (!h.orphanedAt) await db.highlight.update({ where: { id: h.id }, data: { orphanedAt: new Date() } });
      continue;
    }
    if (found.how === "unchanged" && h.segmentId === found.segmentId && !h.orphanedAt) {
      counts.unchanged++;
      continue;
    }
    counts.moved++;
    const text = textOf.get(found.segmentId)!;
    await db.highlight.update({
      where: { id: h.id },
      data: { segmentId: found.segmentId, start: found.start, end: found.end, ...anchorFor(text, found), orphanedAt: null },
    });
  }

  // Quotes in discussion posts follow the same rules (they keep their text if lost).
  const posts = await db.post.findMany({
    where: { workId, segmentId: { not: null }, quoteStart: { not: null }, quoteEnd: { not: null }, quote: { not: null } },
    select: { id: true, segmentId: true, quoteStart: true, quoteEnd: true, quote: true },
  });
  for (const p of posts) {
    // Posts store no context, so ties go to the occurrence nearest the old place.
    const found = reanchor(
      { segmentId: p.segmentId!, start: p.quoteStart!, end: p.quoteEnd!, quote: p.quote!, prefix: "", suffix: "" },
      segments,
    );
    if (found && (found.segmentId !== p.segmentId || found.start !== p.quoteStart || found.end !== p.quoteEnd)) {
      await db.post.update({ where: { id: p.id }, data: { segmentId: found.segmentId, quoteStart: found.start, quoteEnd: found.end } });
    } else if (!found) {
      // The passage is gone: keep the quoted words, drop the link into the reader.
      await db.post.update({ where: { id: p.id }, data: { segmentId: null, quoteStart: null, quoteEnd: null } });
    }
  }
  return counts;
}

export type ReanchorCounts = Awaited<ReturnType<typeof reanchorWorkHighlights>>;

/** Segment picker data for question and mini game forms. */
export function segmentOptions(workId: string) {
  return db.segment.findMany({
    where: { workId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, order: true, title: true },
  });
}

export type SegmentOption = Prisma.SegmentGetPayload<{ select: { id: true; order: true; title: true } }>;
