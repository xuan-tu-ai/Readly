import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ai from "@/lib/ai";
import { defaultMockResponders, MockProvider } from "@/lib/ai";
import type { Actor } from "@/lib/roles";
import { buildSegments } from "@/lib/content/segmenter";
import { questionInputSchema } from "@/lib/content/schemas";
import { db } from "@/server/db";
import { setJobSender } from "@/server/queue";
import { draftFromDocx } from "@/server/content/docx";
import {
  createBadge,
  listAiReports,
  resolveAiReport,
  updateBadge,
  updatePointTable,
} from "@/server/services/admin/gamification";
import { createGame, deleteGame, draftGame } from "@/server/services/admin/games";
import { addDraftQuestions, createQuestion, deleteQuestion, draftQuestions, draftToInput } from "@/server/services/admin/questions";
import {
  createWork,
  deleteWork,
  removeSegment,
  replaceSegments,
  updateSegment,
  updateWork,
} from "@/server/services/admin/works";
import { DEFAULT_POINTS } from "@/lib/gamification";
import { totalPoints } from "@/server/services/gamification";
import { playGame } from "@/server/services/minigames";
import { gradeAnswerJob, submitAnswer } from "@/server/services/questions";
import { createHighlight, listOwnHighlights, markSegmentsRead } from "@/server/services/reading";
import { reportAiFeedback } from "@/server/services/teacher";
import { makeDocx } from "../helpers/docx";
import { enroll, makeClass, makeUser, resetDatabase } from "../helpers/db";

beforeEach(async () => {
  await resetDatabase();
  setJobSender(async () => {});
});

const baseWork = { authorBio: "", summary: "", difficulty: 2, estMinutes: 10, coverUrl: null, background: null, tags: [] as string[] };

async function admin() {
  return makeUser("ADMIN");
}

/** A published poem with two stanzas, imported from a real .docx. */
async function importedPoem(actor: Actor) {
  const { id } = await createWork(actor, { title: "Sóng biển", author: "Tác giả", genre: "THO" });
  const buffer = await makeDocx([
    { lines: ["Gió qua hàng tre", "Nắng vàng trên đê"] },
    "",
    { lines: ["Đêm xuống trên sông", "Trăng lên đầu núi"] },
  ]);
  await replaceSegments(actor, id, buildSegments(await draftFromDocx(buffer, "THO"), "THO"));
  await updateWork(actor, id, { ...baseWork, title: "Sóng biển", author: "Tác giả", genre: "THO", status: "PUBLISHED" });
  const segments = await db.segment.findMany({ where: { workId: id, archivedAt: null }, orderBy: { order: "asc" } });
  return { id, slug: (await db.work.findUniqueOrThrow({ where: { id } })).slug, segments };
}

afterEach(() => vi.restoreAllMocks());

describe("works", () => {
  it("creates a draft with a slug from the title and refuses to publish without text", async () => {
    const a = await admin();
    const first = await createWork(a.actor, { title: "Chí Phèo", author: "Nam Cao", genre: "TRUYEN_NGAN" });
    const second = await createWork(a.actor, { title: "Chí Phèo", author: "Nam Cao", genre: "TRUYEN_NGAN" });
    const slugs = await db.work.findMany({ where: { id: { in: [first.id, second.id] } }, select: { slug: true, status: true } });
    expect(slugs.map((s) => s.slug).sort()).toEqual(["chi-pheo", "chi-pheo-2"]);
    expect(slugs.every((s) => s.status === "DRAFT")).toBe(true);
    await expect(
      updateWork(a.actor, first.id, { ...baseWork, title: "Chí Phèo", author: "Nam Cao", genre: "TRUYEN_NGAN", status: "PUBLISHED" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("only admins manage content", async () => {
    const teacher = await makeUser("TEACHER");
    await expect(createWork(teacher.actor, { title: "X", author: "Y", genre: "THO" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deletes unused drafts only", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    await expect(deleteWork(a.actor, poem.id)).rejects.toMatchObject({ code: "INVALID_INPUT" }); // published
    const draft = await createWork(a.actor, { title: "Nháp", author: "Y", genre: "KI" });
    await deleteWork(a.actor, draft.id);
    expect(await db.work.findUnique({ where: { id: draft.id } })).toBeNull();
  });
});

describe("importing and editing text", () => {
  it("imports a .docx into readable segments", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    expect(poem.segments.map((s) => [s.order, s.title, s.content])).toEqual([
      [1, "Khổ 1", "<p>Gió qua hàng tre<br />Nắng vàng trên đê</p>"],
      [2, "Khổ 2", "<p>Đêm xuống trên sông<br />Trăng lên đầu núi</p>"],
    ]);
  });

  it("re-import keeps segment ids by position, re-anchors and orphans highlights", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const student = await makeUser("STUDENT");
    // "Nắng vàng trên đê" = 17..34 of stanza 1; "Trăng lên đầu núi" = 19..36 of stanza 2.
    const h1 = await createHighlight(student.actor, { segmentId: poem.segments[0].id, start: 17, end: 34, color: "YELLOW" });
    const h2 = await createHighlight(student.actor, { segmentId: poem.segments[1].id, start: 19, end: 36, color: "PINK" });

    const counts = await replaceSegments(a.actor, poem.id, [
      { title: "Khổ 1", html: "<p>Một dòng mới chèn vào<br />Gió qua hàng tre<br />Nắng vàng trên đê</p>" },
      { title: "Khổ 2", html: "<p>Đêm xuống trên sông</p>" },
    ]);
    expect(counts).toEqual({ unchanged: 0, moved: 1, orphaned: 1 });
    const after = await db.segment.findMany({ where: { workId: poem.id, archivedAt: null }, orderBy: { order: "asc" } });
    expect(after.map((s) => s.id)).toEqual(poem.segments.map((s) => s.id));

    const moved = await db.highlight.findUniqueOrThrow({ where: { id: h1.id } });
    expect(moved).toMatchObject({ segmentId: poem.segments[0].id, start: 39, end: 56, quote: "Nắng vàng trên đê", orphanedAt: null });
    const lost = await db.highlight.findUniqueOrThrow({ where: { id: h2.id } });
    expect(lost.orphanedAt).not.toBeNull();
    expect((await listOwnHighlights(student.id, poem.id)).map((h) => h.id)).toEqual([h1.id]);
  });

  it("a typo fix in one segment keeps the highlight on the corrected words", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const student = await makeUser("STUDENT");
    const h = await createHighlight(student.actor, { segmentId: poem.segments[0].id, start: 0, end: 16, color: "BLUE" });
    await updateSegment(a.actor, poem.segments[0].id, { title: "Khổ 1", html: "<p>Gió qua hàng trẻ<br />Nắng vàng trên đê</p>" });
    expect(await db.highlight.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ start: 0, end: 16, quote: "Gió qua hàng trẻ", orphanedAt: null });
  });

  it("removing a segment students used archives it and moves highlights whose text lives on", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const student = await makeUser("STUDENT");
    await markSegmentsRead(student.actor, [poem.segments[1].id]);
    // Copy stanza 2's first line into stanza 1, then remove stanza 2.
    await updateSegment(a.actor, poem.segments[0].id, { title: "Khổ 1", html: "<p>Gió qua hàng tre<br />Đêm xuống trên sông</p>" });
    const h = await createHighlight(student.actor, { segmentId: poem.segments[1].id, start: 0, end: 18, color: "YELLOW" });
    await removeSegment(a.actor, poem.segments[1].id);

    expect((await db.segment.findUniqueOrThrow({ where: { id: poem.segments[1].id } })).archivedAt).not.toBeNull();
    expect(await db.highlight.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ segmentId: poem.segments[0].id, start: 17, end: 36 });
    await expect(removeSegment(a.actor, poem.segments[0].id)).rejects.toMatchObject({ code: "INVALID_INPUT" }); // last one of a published work
  });
});

describe("questions", () => {
  it("validates by type and stage", () => {
    const base = { stage: "DURING", type: "MCQ", segmentId: "s", prompt: "Câu hỏi thử?", options: ["A", ""], correctIndex: 0 };
    expect(questionInputSchema.safeParse(base).success).toBe(false); // one option only
    expect(questionInputSchema.safeParse({ ...base, options: ["A", "B"] }).success).toBe(true);
    expect(questionInputSchema.safeParse({ ...base, stage: "PRE" }).success).toBe(false); // MCQ before reading
    expect(questionInputSchema.safeParse({ ...base, type: "SHORT", options: [] }).success).toBe(false); // no rubric
  });

  it("creates, and refuses to delete questions students answered", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const input = questionInputSchema.parse({
      stage: "DURING",
      type: "MCQ",
      segmentId: poem.segments[0].id,
      prompt: "Khổ 1 tả gì?",
      options: ["Làng quê", "Thành phố", "Biển"],
      correctIndex: 0,
    });
    const { id } = await createQuestion(a.actor, poem.id, input);
    const q = await db.question.findUniqueOrThrow({ where: { id } });
    expect(q).toMatchObject({ correctOptionId: "a", options: [{ id: "a", text: "Làng quê" }, { id: "b", text: "Thành phố" }, { id: "c", text: "Biển" }] });

    const student = await makeUser("STUDENT");
    await submitAnswer(student.actor, id, "a");
    await expect(deleteQuestion(a.actor, id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("AI drafts (mock) map onto the right segments and can be saved", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const drafts = await draftQuestions(a.actor, poem.id);
    expect(drafts.some((d) => d.stage === "PRE" && d.type === "PREDICTION")).toBe(true);
    expect(drafts.filter((d) => d.stage === "DURING").every((d) => d.segment === 1 || d.segment === 2)).toBe(true);
    const bySegment = new Map(poem.segments.map((s) => [s.order, s.id]));
    const inputs = drafts.map((d) => questionInputSchema.parse(draftToInput(d, bySegment)));
    expect(await addDraftQuestions(a.actor, poem.id, inputs)).toBe(drafts.length);
    expect(await db.question.count({ where: { workId: poem.id, stage: "DURING", segmentId: poem.segments[1].id } })).toBeGreaterThan(0);
  });

  it("fills in the rubric when the model drafts an open question without one", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const essay = {
      stage: "POST", segment: null, type: "ESSAY", prompt: "Cảm nhận của em về bài thơ?",
      options: null, correctIndex: null, explanation: null, rubric: null, keyPoints: null, outline: "Mở – thân – kết",
    };
    // A level left empty (seen with real models) must not throw the whole set away.
    const short = { ...essay, type: "SHORT", outline: null, rubric: { chuaDat: "Chung chung.", dat: "", sauSac: "Sâu, có dẫn chứng." }, keyPoints: ["Ý 1"] };
    vi.spyOn(ai, "getAiProvider").mockReturnValue(
      new MockProvider({ ...defaultMockResponders, "draft-questions": () => ({ questions: [essay, short] }) }),
    );
    const drafts = await draftQuestions(a.actor, poem.id);
    for (const draft of drafts) {
      expect(draft.rubric?.dat.length).toBeGreaterThan(3);
      expect(draft.keyPoints?.length).toBeGreaterThan(0);
    }
    expect(drafts[1].keyPoints).toEqual(["Ý 1"]);
    const inputs = drafts.map((d) => questionInputSchema.parse(draftToInput(d, new Map())));
    expect(await addDraftQuestions(a.actor, poem.id, inputs)).toBe(2);
  });
});

describe("mini games", () => {
  it("creates a detail game, refuses to delete it once played", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const draft = await draftGame(a.actor, { workId: poem.id, segmentId: poem.segments[0].id, type: "DETAIL" });
    expect(draft.type).toBe("DETAIL");
    const { id } = await createGame(a.actor, poem.id, {
      type: "DETAIL",
      title: "Đoán chi tiết khổ 1",
      unlockSegmentId: poem.segments[0].id,
      published: true,
      pairs: [],
      items: [
        { text: "Gió qua hàng ___", options: ["tre", "cau", "dừa"], answer: 0, explanation: null },
        { text: "Nắng ___ trên đê", options: ["vàng", "đỏ"], answer: 0, explanation: null },
      ],
    });
    await expect(
      createGame(a.actor, poem.id, { type: "DETAIL", title: "Sai", unlockSegmentId: poem.segments[0].id, published: true, pairs: [], items: [{ text: "Không có chỗ trống", options: ["a", "b"], answer: 0 }] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    const student = await makeUser("STUDENT");
    await markSegmentsRead(student.actor, [poem.segments[0].id]);
    await playGame(student.actor, id, { d1: 0, d2: 0 });
    await expect(deleteGame(a.actor, id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("point table and badges", () => {
  it("recalculates every ledger when the point table changes", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const student = await makeUser("STUDENT");
    await markSegmentsRead(student.actor, poem.segments.map((s) => s.id)); // no questions → completed
    expect(await totalPoints(student.id)).toBe(100);
    await updatePointTable(a.actor, { ...DEFAULT_POINTS, workCompleted: 150 });
    expect(await totalPoints(student.id)).toBe(150);
  });

  it("a new badge goes to students who already qualify; its rule is locked after that", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const student = await makeUser("STUDENT");
    await markSegmentsRead(student.actor, poem.segments.map((s) => s.id));
    const input = { name: "Sóng đầu tiên", description: "Đọc xong Sóng biển", rule: "WORK_COMPLETED", workId: poem.id, threshold: null, emblem: "books", tier: "silver", active: true } as const;
    const { id, awarded } = await createBadge(a.actor, input);
    expect(awarded).toBe(1);
    expect(await db.notification.count({ where: { userId: student.id, kind: "BADGE" } })).toBe(1);
    await expect(updateBadge(a.actor, id, { ...input, rule: "WORKS_COMPLETED", workId: null, threshold: 3 })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await updateBadge(a.actor, id, { ...input, name: "Sóng vỗ", tier: "gold" });
    expect((await db.badgeDefinition.findUniqueOrThrow({ where: { id } })).name).toBe("Sóng vỗ");
  });
});

describe("AI reports queue", () => {
  it("lists teachers' reports with the question and resolves them", async () => {
    const a = await admin();
    const poem = await importedPoem(a.actor);
    const teacher = await makeUser("TEACHER");
    const cls = await makeClass(teacher.id, "LOPAAA");
    const student = await makeUser("STUDENT");
    await enroll(student.id, cls.id);
    const { id: questionId } = await createQuestion(
      a.actor,
      poem.id,
      questionInputSchema.parse({
        stage: "DURING",
        type: "SHORT",
        segmentId: poem.segments[0].id,
        prompt: "Vì sao có hàng tre?",
        rubricChuaDat: "chung chung",
        rubricDat: "có ý",
        rubricSauSac: "đủ ý",
        keyPoints: ["gió qua hàng tre"],
      }),
    );
    const view = await submitAnswer(student.actor, questionId, "Hình ảnh gió qua hàng tre gợi làng quê yên bình và rất gần gũi.");
    await gradeAnswerJob(view.answers[0].id);
    await reportAiFeedback(teacher.actor, view.answers[0].id, "Rubric quá dễ, chấm Sâu sắc cho câu ngắn.");

    const [report] = await listAiReports(a.actor);
    expect(report).toMatchObject({ teacher: teacher.name, question: { id: questionId, rubric: { dat: "có ý" } } });
    await resolveAiReport(a.actor, report.id);
    expect(await listAiReports(a.actor)).toEqual([]);
    expect(await listAiReports(a.actor, "resolved")).toHaveLength(1);
  });
});
