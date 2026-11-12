import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/roles";
import { db } from "@/server/db";
import { QUEUES, setJobSender } from "@/server/queue";
import { isPushConfigured, pushToUser, removePushSubscription, savePushSubscription } from "@/server/push";
import { createAssignment } from "@/server/services/assignments";
import { joinClassByCode, removeStudentFromClass } from "@/server/services/classes";
import {
  createPost,
  createReply,
  dismissReports,
  getStudentDiscussion,
  getTeacherDiscussion,
  listReportQueue,
  moderatePost,
  moderateReply,
  reportContent,
  toggleLike,
} from "@/server/services/discussions";
import {
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  sendDeadlineReminders,
} from "@/server/services/notifications";
import { gradeAnswerJob, submitAnswer } from "@/server/services/questions";
import { markSegmentsRead } from "@/server/services/reading";
import { reviewAnswer } from "@/server/services/teacher";
import { enroll, makeClass, makeUser, resetDatabase } from "../helpers/db";

let jobs: { queue: string; data: object }[] = [];

beforeEach(async () => {
  await resetDatabase();
  jobs = [];
  setJobSender(async (queue, data) => {
    jobs.push({ queue, data });
  });
});

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
  return { work, s1: work.segments[0], s2: work.segments[1] };
}

async function setup() {
  const teacherA = await makeUser("TEACHER", { name: "Cô Lan" });
  const teacherB = await makeUser("TEACHER", { name: "Thầy Minh" });
  const classA = await makeClass(teacherA.id, "LOPAAA", "12A1");
  const classB = await makeClass(teacherB.id, "LOPBBB", "12B2");
  const an = await makeUser("STUDENT", { name: "Trần Minh An" });
  const binh = await makeUser("STUDENT", { name: "Lê Thị Bình" });
  const chi = await makeUser("STUDENT", { name: "Phạm Chi" });
  await enroll(an.id, classA.id);
  await enroll(binh.id, classA.id);
  await enroll(chi.id, classB.id);
  const w = await makeWork();
  return { teacherA, teacherB, classA, classB, an, binh, chi, ...w };
}

const post = (actor: Actor, slug: string, body = "Vì sao tác giả nhắc nhiều đến hàng tre?", type: "QUESTION" | "REFLECTION" = "QUESTION") =>
  createPost(actor, { slug, type, body });

describe("discussion areas are per work × class", () => {
  it("students of another class neither see nor touch a post", async () => {
    const { an, chi, work } = await setup();
    const { id } = await post(an.actor, work.slug);

    const mine = await getStudentDiscussion(an.actor, work.slug);
    expect(mine.state === "ok" && mine.posts.map((p) => p.id)).toEqual([id]);
    const other = await getStudentDiscussion(chi.actor, work.slug);
    expect(other.state === "ok" && other.posts).toEqual([]);

    await expect(createReply(chi.actor, { postId: id, body: "Mình trả lời nè" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(toggleLike(chi.actor, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reportContent(chi.actor, { postId: id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a student without a class can read nothing and post nothing; old posts stay in the old class", async () => {
    const { teacherA, classA, classB, an, binh, work } = await setup();
    const { id } = await post(an.actor, work.slug);
    await removeStudentFromClass(teacherA.actor, classA.id, an.id);
    expect((await getStudentDiscussion(an.actor, work.slug)).state).toBe("no-class");
    await expect(post(an.actor, work.slug)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await joinClassByCode(an.actor, classB.code);
    const now = await getStudentDiscussion(an.actor, work.slug);
    expect(now.state === "ok" && now.posts).toEqual([]);
    const stillThere = await getStudentDiscussion(binh.actor, work.slug);
    expect(stillThere.state === "ok" && stillThere.posts[0].id).toBe(id);
  });
});

describe("writing", () => {
  it("blocks banned words and empty posts", async () => {
    const { an, work } = await setup();
    await expect(post(an.actor, work.slug, "Bài này khó vcl")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(post(an.actor, work.slug, "   ")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("re-derives the quoted passage from the text, snapped to words", async () => {
    const { an, work, s2 } = await setup();
    // 2..17 cuts "Đêm" and "sông" in half; the quote widens to whole words.
    await createPost(an.actor, { slug: work.slug, type: "REFLECTION", body: "Câu này buồn.", quote: { segmentId: s2.id, start: 2, end: 17 } });
    const view = await getStudentDiscussion(an.actor, work.slug);
    expect(view.state === "ok" && view.posts[0].quote).toMatchObject({ start: 0, end: 19, text: "Đêm xuống trên sông" });
  });

  it("a reply notifies the post's author (and queues a push), never the replier", async () => {
    const { an, binh, teacherA, work } = await setup();
    const { id } = await post(an.actor, work.slug);
    await createReply(an.actor, { postId: id, body: "Mình tự bổ sung thêm." });
    expect(await countUnread(an.id)).toBe(0);

    await createReply(binh.actor, { postId: id, body: "Vì hàng tre gắn với làng quê." });
    await createReply(teacherA.actor, { postId: id, body: "Câu hỏi hay, các em xem lại khổ 1 nhé." });
    const notices = await listNotifications(an.id);
    expect(notices.map((n) => n.title)).toEqual(["Giáo viên đã trả lời bài của bạn", "Lê Thị Bình đã trả lời bài của bạn"]);
    expect(notices[0].href).toBe(`/student/works/${work.slug}/discussion#post-${id}`);
    expect(jobs.filter((j) => j.queue === QUEUES.pushNotifications)).toHaveLength(2);
  });

  it("likes toggle and drive the 'Nổi bật' order", async () => {
    const { an, binh, work } = await setup();
    const first = await post(an.actor, work.slug, "Bài một");
    const second = await post(an.actor, work.slug, "Bài hai");
    expect(await toggleLike(binh.actor, first.id)).toEqual({ liked: true, likes: 1 });
    const top = await getStudentDiscussion(binh.actor, work.slug, { sort: "top" });
    expect(top.state === "ok" && top.posts.map((p) => [p.id, p.likedByMe])).toEqual([
      [first.id, true],
      [second.id, false],
    ]);
    expect(await toggleLike(binh.actor, first.id)).toEqual({ liked: false, likes: 0 });
  });
});

describe("reports and moderation", () => {
  it("queues reports for the class teacher; hiding settles them and hides the post from others", async () => {
    const { an, binh, teacherA, teacherB, classA, work } = await setup();
    const { id } = await post(an.actor, work.slug);
    await expect(reportContent(an.actor, { postId: id })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await reportContent(binh.actor, { postId: id, reason: "Lạc đề" });
    await expect(reportContent(binh.actor, { postId: id })).rejects.toMatchObject({ code: "ALREADY_EXISTS" });

    const queue = await listReportQueue(teacherA.actor, classA.id);
    expect(queue).toMatchObject([{ postId: id, replyId: null, author: "Trần Minh An", reports: [{ by: "Lê Thị Bình", reason: "Lạc đề" }] }]);
    await expect(listReportQueue(teacherB.actor, classA.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(moderatePost(teacherB.actor, id, { hidden: true })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await moderatePost(teacherA.actor, id, { hidden: true });
    expect(await listReportQueue(teacherA.actor, classA.id)).toEqual([]);
    const others = await getStudentDiscussion(binh.actor, work.slug);
    expect(others.state === "ok" && others.posts).toEqual([]);
    const author = await getStudentDiscussion(an.actor, work.slug);
    expect(author.state === "ok" && author.posts[0]).toMatchObject({ id, hidden: true });
    await expect(createReply(binh.actor, { postId: id, body: "?" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const teacherView = await getTeacherDiscussion(teacherA.actor, classA.id, work.id);
    expect(teacherView.posts[0].hidden).toBe(true);
  });

  it("handles replies: report, dismiss, hide", async () => {
    const { an, binh, teacherA, classA, work } = await setup();
    const { id } = await post(an.actor, work.slug);
    const reply = await createReply(binh.actor, { postId: id, body: "Trả lời hơi lạc đề" });
    await reportContent(an.actor, { postId: id, replyId: reply.id });
    expect((await listReportQueue(teacherA.actor, classA.id))[0]).toMatchObject({ replyId: reply.id, author: "Lê Thị Bình" });

    await dismissReports(teacherA.actor, { postId: id, replyId: reply.id });
    expect(await listReportQueue(teacherA.actor, classA.id)).toEqual([]);

    await moderateReply(teacherA.actor, reply.id, true);
    const view = await getStudentDiscussion(an.actor, work.slug);
    expect(view.state === "ok" && view.posts[0].replies).toEqual([]);
  });

  it("pins posts on top and marks only questions as answered", async () => {
    const { an, teacherA, work } = await setup();
    const old = await post(an.actor, work.slug, "Câu hỏi cũ");
    const reflection = await post(an.actor, work.slug, "Cảm nhận mới", "REFLECTION");
    await moderatePost(teacherA.actor, old.id, { pinned: true, resolved: true });
    await expect(moderatePost(teacherA.actor, reflection.id, { resolved: true })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const view = await getStudentDiscussion(an.actor, work.slug);
    expect(view.state === "ok" && view.posts.map((p) => [p.id, p.pinned, p.resolved])).toEqual([
      [old.id, true, true],
      [reflection.id, false, false],
    ]);
  });
});

describe("notifications from grading and badges", () => {
  async function shortQuestion(workId: string, segmentId: string) {
    return db.question.create({
      data: {
        workId,
        segmentId,
        stage: "DURING",
        type: "SHORT",
        prompt: "Vì sao?",
        rubric: { chuaDat: "a", dat: "b", sauSac: "c" },
        keyPoints: ["gió qua hàng tre", "nắng vàng trên đê"],
      },
    });
  }

  it("tells the student when the AI graded and when the teacher changed the level", async () => {
    const { an, teacherA, work, s1, s2 } = await setup();
    const q = await shortQuestion(work.id, s1.id);
    await markSegmentsRead(an.actor, [s1.id, s2.id]);
    const view = await submitAnswer(an.actor, q.id, "Hình ảnh gió qua hàng tre và nắng vàng trên đê gợi làng quê yên bình.");
    const answerId = view.answers[0].id;
    await gradeAnswerJob(answerId);
    await reviewAnswer(teacherA.actor, answerId, { level: "DAT", note: null, hideAi: false });

    const titles = (await listNotifications(an.id)).map((n) => [n.kind, n.title]);
    expect(titles).toContainEqual(["GRADED", "Mướp đã nhận xét câu trả lời của bạn"]);
    expect(titles).toContainEqual(["TEACHER_REVIEW", "Giáo viên đã chấm lại câu trả lời của bạn"]);
    expect((await listNotifications(an.id)).find((n) => n.kind === "GRADED")?.href).toBe(`/student/read/${work.slug}?seg=${s1.id}`);
  });

  it("announces a new badge once", async () => {
    const { an, s1, s2 } = await setup();
    await db.badgeDefinition.create({
      data: { name: "Mọt sách nhí", description: "Hoàn thành 1 tác phẩm", rule: "WORKS_COMPLETED", threshold: 1, emblem: "books", tier: "bronze" },
    });
    await markSegmentsRead(an.actor, [s1.id, s2.id]); // no questions → completes the work
    await markSegmentsRead(an.actor, [s1.id]);
    const badges = (await listNotifications(an.id)).filter((n) => n.kind === "BADGE");
    expect(badges.map((b) => b.title)).toEqual(["Huy hiệu mới: Mọt sách nhí"]);
    expect(await countUnread(an.id)).toBe(1);
    await markAllNotificationsRead(an.actor);
    expect(await countUnread(an.id)).toBe(0);
  });
});

describe("automatic deadline reminders (cron)", () => {
  it("reminds unfinished current students 2 days and 1 day before, once each", async () => {
    const { teacherA, classA, an, binh, chi, work, s1, s2 } = await setup();
    const created = new Date("2026-11-15T03:00:00Z");
    await createAssignment(teacherA.actor, { classId: classA.id, workId: work.id, dueDate: "2026-11-20" }, created);
    await markSegmentsRead(binh.actor, [s1.id, s2.id]); // Bình already finished

    const at = (iso: string) => sendDeadlineReminders(new Date(iso));
    expect(await at("2026-11-17T03:00:00Z")).toEqual({ sent: 0 }); // 3 days before
    expect(await at("2026-11-18T03:00:00Z")).toEqual({ sent: 1 }); // 2 days before, 10:00
    expect(await at("2026-11-18T09:00:00Z")).toEqual({ sent: 0 }); // same stage again: deduped
    expect(await at("2026-11-19T02:00:00Z")).toEqual({ sent: 1 }); // 1 day before
    expect(await at("2026-11-21T02:00:00Z")).toEqual({ sent: 0 }); // after the deadline

    const reminders = (await listNotifications(an.id)).filter((n) => n.kind === "REMINDER").map((n) => n.title);
    expect(reminders).toEqual([`Còn 1 ngày: ${work.title}`, `Còn 2 ngày: ${work.title}`]);
    expect((await listNotifications(binh.id)).filter((n) => n.kind === "REMINDER")).toEqual([]);
    // Chi is in class B: class A's deadline never reaches her.
    expect(await listNotifications(chi.id)).toEqual([]);
  });
});

describe("web push subscriptions", () => {
  it("stores one row per browser endpoint and skips sending without VAPID keys", async () => {
    const { an, binh } = await setup();
    const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "key", auth: "auth" } };
    await savePushSubscription(an.actor, sub);
    await savePushSubscription(binh.actor, sub); // same browser, another account signs in
    expect(await db.pushSubscription.findMany({ select: { userId: true } })).toEqual([{ userId: binh.id }]);
    expect(isPushConfigured()).toBe(false);
    expect(await pushToUser(binh.id, { title: "Thử" })).toMatchObject({ skipped: true });
    await removePushSubscription(binh.actor, sub.endpoint);
    expect(await db.pushSubscription.count()).toBe(0);
  });
});
