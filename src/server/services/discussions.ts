import type { Prisma } from "@/generated/prisma/client";
import type { PostType } from "@/generated/prisma/enums";
import { avatarFor } from "@/lib/art";
import {
  POST_MAX,
  REPLY_MAX,
  REPORT_REASON_MAX,
  comparePosts,
  findBannedWord,
  type PostSort,
} from "@/lib/discussion";
import { htmlToText } from "@/lib/reading/html-text";
import { sanitizeSegmentHtml } from "@/lib/reading/sanitize";
import { snapToWords } from "@/lib/reading/text";
import type { Actor } from "@/lib/roles";
import { assertRole, assertTeacherOfClass } from "@/server/authz";
import { db } from "@/server/db";
import { DomainError, forbidden, notFound } from "@/server/errors";
import { notify } from "@/server/services/notifications";

/**
 * Class discussions (spec §7): one area per work × class, posts with
 * one level of replies, likes, reports and teacher moderation. A student only
 * ever sees the area of their *current* class; old posts stay where they were
 * written. No points are given for posting or for likes.
 */

export const QUOTE_MAX = 500;

// ───────────────────────── Access ─────────────────────────

async function currentClassOf(studentId: string) {
  const membership = await db.classMembership.findFirst({
    where: { studentId, leftAt: null },
    select: { class: { select: { id: true, name: true, teacherId: true } } },
  });
  return membership?.class ?? null;
}

async function publishedWork(where: { slug: string } | { id: string }) {
  const work = await db.work.findFirst({ where: { ...where, status: "PUBLISHED" }, select: { id: true, slug: true, title: true } });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  return work;
}

/**
 * Who may act on a post: a student currently in the post's class, or that
 * class's teacher. Returns the post with its class and work.
 */
async function postFor(actor: Actor, postId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      type: true,
      hidden: true,
      classId: true,
      class: { select: { teacherId: true } },
      work: { select: { id: true, slug: true, title: true } },
    },
  });
  if (!post) notFound("Không tìm thấy bài thảo luận.");
  if (actor.role === "TEACHER") {
    if (post.class.teacherId !== actor.id) forbidden("Đây không phải lớp của bạn.");
  } else {
    assertRole(actor, "STUDENT");
    const cls = await currentClassOf(actor.id);
    if (cls?.id !== post.classId) forbidden("Bài này thuộc lớp khác.");
    if (post.hidden && post.authorId !== actor.id) notFound("Không tìm thấy bài thảo luận.");
  }
  return post;
}

function cleanText(raw: string, max: number, what: string) {
  const text = raw.trim();
  if (!text) throw new DomainError("INVALID_INPUT", `Vui lòng nhập ${what}.`);
  if (text.length > max) throw new DomainError("INVALID_INPUT", `${what[0].toUpperCase()}${what.slice(1)} tối đa ${max} ký tự.`);
  const banned = findBannedWord(text);
  if (banned) throw new DomainError("INVALID_INPUT", "Bài viết có từ ngữ không phù hợp, bạn sửa lại nhé.");
  return text;
}

// ───────────────────────── Quotes ─────────────────────────

export type QuoteInput = { segmentId: string; start: number; end: number };

/**
 * The quoted passage, re-derived from the stored text (word-snapped), so a
 * post can never claim words the work doesn't have.
 */
export async function resolveQuote(workId: string, input: QuoteInput) {
  const segment = await db.segment.findFirst({
    where: { id: input.segmentId, workId, archivedAt: null },
    select: { id: true, order: true, title: true, content: true },
  });
  if (!segment) throw new DomainError("INVALID_INPUT", "Đoạn trích không còn trong tác phẩm.");
  const text = htmlToText(sanitizeSegmentHtml(segment.content));
  const span = snapToWords(text, input.start, input.end);
  if (!span) throw new DomainError("INVALID_INPUT", "Đoạn trích không hợp lệ.");
  const end = Math.min(span.end, span.start + QUOTE_MAX);
  return {
    segmentId: segment.id,
    segmentTitle: segment.title ?? `Phần ${segment.order}`,
    start: span.start,
    end,
    text: text.slice(span.start, end).trim(),
  };
}

/** Preview for the composer ("Thảo luận đoạn này" from the reader). Null if the quote is unusable. */
export async function previewQuote(slug: string, input: QuoteInput) {
  const work = await publishedWork({ slug });
  try {
    return await resolveQuote(work.id, input);
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
}

// ───────────────────────── Reading the discussion ─────────────────────────

const authorSelect = { id: true, name: true, role: true, player: { select: { avatar: true } } } satisfies Prisma.UserSelect;
type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;
const toAuthor = (a: AuthorRow) => ({
  id: a.id,
  name: a.name,
  isTeacher: a.role === "TEACHER",
  avatar: avatarFor(a.id, a.player?.avatar),
});

function postSelect(viewerId: string) {
  return {
    id: true,
    type: true,
    body: true,
    segmentId: true,
    quoteStart: true,
    quoteEnd: true,
    quote: true,
    pinned: true,
    hidden: true,
    resolved: true,
    createdAt: true,
    author: { select: authorSelect },
    segment: { select: { title: true, order: true } },
    replies: {
      orderBy: { createdAt: "asc" },
      select: { id: true, body: true, hidden: true, createdAt: true, author: { select: authorSelect } },
    },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    reports: { where: { resolvedAt: null }, select: { replyId: true, reporterId: true } },
    _count: { select: { likes: true } },
  } satisfies Prisma.PostSelect;
}

type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

function toPostView(p: PostRow, viewer: Actor) {
  const teacher = viewer.role === "TEACHER";
  const replies = p.replies
    .filter((r) => teacher || !r.hidden || r.author.id === viewer.id)
    .map((r) => ({
      id: r.id,
      body: r.body,
      hidden: r.hidden,
      createdAt: r.createdAt,
      author: toAuthor(r.author),
      mine: r.author.id === viewer.id,
      reportedByMe: p.reports.some((x) => x.replyId === r.id && x.reporterId === viewer.id),
      openReports: teacher ? p.reports.filter((x) => x.replyId === r.id).length : 0,
    }));
  return {
    id: p.id,
    type: p.type,
    body: p.body,
    quote:
      p.segmentId && p.quote !== null && p.quoteStart !== null && p.quoteEnd !== null
        ? {
            segmentId: p.segmentId,
            start: p.quoteStart,
            end: p.quoteEnd,
            text: p.quote,
            segmentTitle: p.segment ? (p.segment.title ?? `Phần ${p.segment.order}`) : null,
          }
        : null,
    pinned: p.pinned,
    hidden: p.hidden,
    resolved: p.resolved,
    createdAt: p.createdAt,
    author: toAuthor(p.author),
    mine: p.author.id === viewer.id,
    likes: p._count.likes,
    likedByMe: p.likes.length > 0,
    replies,
    reportedByMe: p.reports.some((x) => x.replyId === null && x.reporterId === viewer.id),
    openReports: teacher ? p.reports.filter((x) => x.replyId === null).length : 0,
  };
}

export type PostView = ReturnType<typeof toPostView>;
export type ReplyView = PostView["replies"][number];

export type DiscussionFilter = { sort?: PostSort; type?: PostType | null };

async function loadPosts(viewer: Actor, workId: string, classId: string, filter: DiscussionFilter) {
  const rows = await db.post.findMany({
    where: {
      workId,
      classId,
      ...(filter.type ? { type: filter.type } : {}),
      // Students see visible posts plus their own hidden ones (marked as hidden).
      ...(viewer.role === "TEACHER" ? {} : { OR: [{ hidden: false }, { authorId: viewer.id }] }),
    },
    select: postSelect(viewer.id),
  });
  return rows
    .map((row) => toPostView(row, viewer))
    .sort((a, b) => comparePosts(filter.sort ?? "new")({ ...a, replies: a.replies.length }, { ...b, replies: b.replies.length }));
}

/** The student's view of a work's discussion in their current class. */
export async function getStudentDiscussion(actor: Actor, slug: string, filter: DiscussionFilter = {}) {
  assertRole(actor, "STUDENT");
  const work = await publishedWork({ slug });
  const cls = await currentClassOf(actor.id);
  if (!cls) return { state: "no-class" as const, work };
  const posts = await loadPosts(actor, work.id, cls.id, filter);
  return { state: "ok" as const, work, class: { id: cls.id, name: cls.name }, posts };
}

/** Number of visible posts in the student's class for a work (work page teaser). */
export async function countClassPosts(studentId: string, workId: string) {
  const cls = await currentClassOf(studentId);
  if (!cls) return null;
  return db.post.count({ where: { workId, classId: cls.id, hidden: false } });
}

// ───────────────────────── Writing ─────────────────────────

export async function createPost(
  actor: Actor,
  input: { slug: string; type: PostType; body: string; quote?: QuoteInput | null },
) {
  assertRole(actor, "STUDENT");
  const work = await publishedWork({ slug: input.slug });
  const cls = await currentClassOf(actor.id);
  if (!cls) forbidden("Bạn cần vào một lớp (nhập mã lớp) để tham gia thảo luận.");
  const body = cleanText(input.body, POST_MAX, "nội dung");
  const quote = input.quote ? await resolveQuote(work.id, input.quote) : null;
  return db.post.create({
    data: {
      workId: work.id,
      classId: cls.id,
      authorId: actor.id,
      type: input.type,
      body,
      ...(quote ? { segmentId: quote.segmentId, quoteStart: quote.start, quoteEnd: quote.end, quote: quote.text } : {}),
    },
    select: { id: true },
  });
}

/** A student of the class or its teacher replies; the post's author is notified. */
export async function createReply(actor: Actor, input: { postId: string; body: string }) {
  const post = await postFor(actor, input.postId);
  if (post.hidden) throw new DomainError("FORBIDDEN", "Bài này đã bị ẩn, không trả lời được nữa.");
  const body = cleanText(input.body, REPLY_MAX, "câu trả lời");
  const reply = await db.reply.create({ data: { postId: post.id, authorId: actor.id, body }, select: { id: true } });
  if (post.authorId !== actor.id) {
    const author = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true, role: true } });
    await notify([
      {
        userId: post.authorId,
        kind: "REPLY",
        title: `${author.role === "TEACHER" ? "Giáo viên" : author.name} đã trả lời bài của bạn`,
        body: body.length > 120 ? `${body.slice(0, 120)}…` : body,
        href: `/student/works/${post.work.slug}/discussion#post-${post.id}`,
        senderId: actor.id,
        workId: post.work.id,
      },
    ]);
  }
  return reply;
}

/** Likes a post, or takes the like back. */
export async function toggleLike(actor: Actor, postId: string) {
  assertRole(actor, "STUDENT");
  const post = await postFor(actor, postId);
  const key = { postId_userId: { postId: post.id, userId: actor.id } };
  const existing = await db.postLike.findUnique({ where: key, select: { postId: true } });
  if (existing) await db.postLike.delete({ where: key });
  else await db.postLike.create({ data: { postId: post.id, userId: actor.id } });
  return { liked: !existing, likes: await db.postLike.count({ where: { postId: post.id } }) };
}

/** A student flags a post or reply for the teacher. One open report per student and target. */
export async function reportContent(actor: Actor, input: { postId: string; replyId?: string | null; reason?: string | null }) {
  assertRole(actor, "STUDENT");
  const post = await postFor(actor, input.postId);
  let authorId = post.authorId;
  if (input.replyId) {
    const reply = await db.reply.findFirst({ where: { id: input.replyId, postId: post.id }, select: { authorId: true } });
    if (!reply) notFound("Không tìm thấy câu trả lời.");
    authorId = reply.authorId;
  }
  if (authorId === actor.id) throw new DomainError("INVALID_INPUT", "Bạn không thể báo cáo bài của chính mình.");
  const reason = input.reason?.trim().slice(0, REPORT_REASON_MAX) || null;
  const open = await db.postReport.findFirst({
    where: { postId: post.id, replyId: input.replyId ?? null, reporterId: actor.id, resolvedAt: null },
    select: { id: true },
  });
  if (open) throw new DomainError("ALREADY_EXISTS", "Bạn đã báo cáo nội dung này, giáo viên sẽ xem xét.");
  return db.postReport.create({ data: { postId: post.id, replyId: input.replyId ?? null, reporterId: actor.id, reason } });
}

// ───────────────────────── Teacher ─────────────────────────

/** Works with posts in the class, with open report counts, plus the assigned works. */
export async function listClassDiscussionWorks(actor: Actor, classId: string) {
  await assertTeacherOfClass(actor, classId);
  const [posts, reports, assigned] = await Promise.all([
    db.post.groupBy({ by: ["workId"], where: { classId }, _count: { _all: true } }),
    db.postReport.findMany({ where: { resolvedAt: null, post: { classId } }, select: { post: { select: { workId: true } } } }),
    db.assignment.findMany({ where: { classId }, select: { workId: true } }),
  ]);
  const ids = [...new Set([...posts.map((p) => p.workId), ...assigned.map((a) => a.workId)])];
  const works = await db.work.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, title: true } });
  return works
    .map((w) => ({
      ...w,
      posts: posts.find((p) => p.workId === w.id)?._count._all ?? 0,
      openReports: reports.filter((r) => r.post.workId === w.id).length,
    }))
    .sort((a, b) => b.openReports - a.openReports || b.posts - a.posts || a.title.localeCompare(b.title, "vi"));
}

/** The teacher's view of one work's discussion in a class (hidden content included). */
export async function getTeacherDiscussion(actor: Actor, classId: string, workId: string, filter: DiscussionFilter = {}) {
  await assertTeacherOfClass(actor, classId);
  const work = await db.work.findUnique({ where: { id: workId }, select: { id: true, slug: true, title: true } });
  if (!work) notFound("Không tìm thấy tác phẩm.");
  return { work, posts: await loadPosts(actor, work.id, classId, filter) };
}

/** Open reports of the class, newest first, grouped by reported post/reply. */
export async function listReportQueue(actor: Actor, classId: string) {
  await assertTeacherOfClass(actor, classId);
  const reports = await db.postReport.findMany({
    where: { resolvedAt: null, post: { classId } },
    orderBy: { createdAt: "desc" },
    select: {
      reason: true,
      createdAt: true,
      reporter: { select: { name: true } },
      post: { select: { id: true, body: true, hidden: true, author: { select: { name: true } }, work: { select: { id: true, title: true } } } },
      reply: { select: { id: true, body: true, hidden: true, author: { select: { name: true } } } },
    },
  });
  const groups = new Map<
    string,
    {
      postId: string;
      replyId: string | null;
      work: { id: string; title: string };
      author: string;
      body: string;
      hidden: boolean;
      reports: { by: string; reason: string | null; at: Date }[];
    }
  >();
  for (const r of reports) {
    const key = r.reply ? `reply:${r.reply.id}` : `post:${r.post.id}`;
    const group = groups.get(key) ?? {
      postId: r.post.id,
      replyId: r.reply?.id ?? null,
      work: r.post.work,
      author: (r.reply ?? r.post).author.name,
      body: (r.reply ?? r.post).body,
      hidden: (r.reply ?? r.post).hidden,
      reports: [],
    };
    group.reports.push({ by: r.reporter.name, reason: r.reason, at: r.createdAt });
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function countOpenReports(classId: string) {
  return db.postReport.count({ where: { resolvedAt: null, post: { classId } } });
}

/** Pin, hide or mark a question answered. Hiding settles the post's open reports. */
export async function moderatePost(
  actor: Actor,
  postId: string,
  change: { pinned?: boolean; hidden?: boolean; resolved?: boolean },
) {
  assertRole(actor, "TEACHER");
  const post = await postFor(actor, postId);
  if (change.resolved !== undefined && post.type !== "QUESTION") {
    throw new DomainError("INVALID_INPUT", "Chỉ câu hỏi mới đánh dấu đã giải đáp được.");
  }
  await db.$transaction([
    db.post.update({ where: { id: post.id }, data: change }),
    ...(change.hidden
      ? [db.postReport.updateMany({ where: { postId: post.id, replyId: null, resolvedAt: null }, data: { resolvedAt: new Date() } })]
      : []),
  ]);
}

export async function moderateReply(actor: Actor, replyId: string, hidden: boolean) {
  assertRole(actor, "TEACHER");
  const reply = await db.reply.findUnique({ where: { id: replyId }, select: { id: true, postId: true } });
  if (!reply) notFound("Không tìm thấy câu trả lời.");
  await postFor(actor, reply.postId);
  await db.$transaction([
    db.reply.update({ where: { id: reply.id }, data: { hidden } }),
    ...(hidden
      ? [db.postReport.updateMany({ where: { replyId: reply.id, resolvedAt: null }, data: { resolvedAt: new Date() } })]
      : []),
  ]);
}

/** The teacher looked at the reports and keeps the content. */
export async function dismissReports(actor: Actor, input: { postId: string; replyId?: string | null }) {
  assertRole(actor, "TEACHER");
  const post = await postFor(actor, input.postId);
  await db.postReport.updateMany({
    where: { postId: post.id, replyId: input.replyId ?? null, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}
