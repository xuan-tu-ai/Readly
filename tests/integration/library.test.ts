import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { workSearchText } from "@/lib/catalog";
import { getVisibleWorkBySlug, listLibrary } from "@/server/services/works";
import { getLatestQuizAnswers, getRecommendations, saveQuizResult } from "@/server/services/quiz";
import { loadSampleContent, placeholderSegments, seedContent } from "../../prisma/seed-content";
import { loadRealWorks } from "../../prisma/seed-real-works";
import { makeUser, resetDatabase } from "../helpers/db";
import type { Genre, WorkStatus } from "@/generated/prisma/enums";

beforeEach(resetDatabase);

async function makeWork(
  slug: string,
  opts: { title?: string; author?: string; genre?: Genre; status?: WorkStatus; difficulty?: number; estMinutes?: number; tags?: string[] } = {},
) {
  const title = opts.title ?? slug;
  const author = opts.author ?? "Tác giả ABC";
  const work = await db.work.create({
    data: {
      slug,
      title,
      author,
      authorBio: "",
      summary: "",
      genre: opts.genre ?? "THO",
      status: opts.status ?? "PUBLISHED",
      difficulty: opts.difficulty ?? 1,
      estMinutes: opts.estMinutes ?? 10,
      searchText: workSearchText({ title, author }),
    },
  });
  for (const tagSlug of opts.tags ?? []) {
    const tag = await db.tag.upsert({
      where: { slug: tagSlug },
      update: {},
      create: { slug: tagSlug, label: tagSlug, kind: "THEME" },
    });
    await db.workTag.create({ data: { workId: work.id, tagId: tag.id } });
  }
  return work;
}

describe("listLibrary", () => {
  it("hides drafts and lists readable works before coming-soon ones", async () => {
    await makeWork("soon", { title: "A sắp có", status: "COMING_SOON" });
    await makeWork("draft", { title: "B nháp", status: "DRAFT" });
    await makeWork("ready", { title: "C đọc được" });

    expect((await listLibrary()).map((w) => w.slug)).toEqual(["ready", "soon"]);
  });

  it("filters by genre, difficulty and length bucket", async () => {
    await makeWork("short-poem", { genre: "THO", estMinutes: 15, difficulty: 1 });
    await makeWork("long-novel", { genre: "TIEU_THUYET", estMinutes: 90, difficulty: 3 });
    await makeWork("medium-play", { genre: "KICH", estMinutes: 40, difficulty: 2 });

    expect((await listLibrary({ genre: "KICH" })).map((w) => w.slug)).toEqual(["medium-play"]);
    expect((await listLibrary({ difficulty: 3 })).map((w) => w.slug)).toEqual(["long-novel"]);
    expect((await listLibrary({ length: "short" })).map((w) => w.slug)).toEqual(["short-poem"]);
    expect((await listLibrary({ length: "long" })).map((w) => w.slug)).toEqual(["long-novel"]);
    expect(await listLibrary({ genre: "THO", difficulty: 3 })).toEqual([]);
  });

  it("searches title and author without diacritics, all words must match", async () => {
    await makeWork("a", { title: "Bến quê", author: "Tác giả Đông" });
    await makeWork("b", { title: "Mùa thu", author: "Tác giả Tây" });

    expect((await listLibrary({ q: "ben que" })).map((w) => w.slug)).toEqual(["a"]);
    expect((await listLibrary({ q: "DONG" })).map((w) => w.slug)).toEqual(["a"]);
    expect((await listLibrary({ q: "mùa tây" })).map((w) => w.slug)).toEqual(["b"]);
    expect(await listLibrary({ q: "mùa đông" })).toEqual([]);
  });

  it("returns tags on each card", async () => {
    await makeWork("tagged", { tags: ["gia-dinh"] });
    const [card] = await listLibrary();
    expect(card.tags.map((t) => t.slug)).toEqual(["gia-dinh"]);
  });
});

describe("getVisibleWorkBySlug", () => {
  it("returns details with the active segment count, but never drafts", async () => {
    const work = await makeWork("ready");
    await db.segment.createMany({
      data: [
        { workId: work.id, order: 1, content: "<p>1</p>" },
        { workId: work.id, order: 2, content: "<p>2</p>", archivedAt: new Date() },
      ],
    });
    await makeWork("draft", { status: "DRAFT" });

    expect(await getVisibleWorkBySlug("ready")).toMatchObject({ slug: "ready", segmentCount: 1 });
    expect(await getVisibleWorkBySlug("draft")).toBeNull();
    expect(await getVisibleWorkBySlug("missing")).toBeNull();
  });
});

describe("interest quiz", () => {
  const answers = {
    genre: "kich",
    length: "medium",
    mood: "hai-huoc",
    theme: "tinh-yeu",
    challenge: "medium",
    focus: "story",
  };

  it("stores results per student and recommends from the latest one", async () => {
    const student = await makeUser("STUDENT");
    await makeWork("play", { genre: "KICH", estMinutes: 40, difficulty: 2, tags: ["hai-huoc"] });
    await makeWork("poem", { genre: "THO", estMinutes: 10, difficulty: 1, tags: ["tru-tinh"] });

    expect(await getRecommendations(student.id)).toBeNull();

    await saveQuizResult(student.actor, {
      genre: "tho",
      length: "short",
      mood: "tru-tinh",
      theme: "gia-dinh",
      challenge: "easy",
      focus: "language",
    });
    expect((await getRecommendations(student.id))?.[0].work.slug).toBe("poem");

    await saveQuizResult(student.actor, answers);
    expect(await getLatestQuizAnswers(student.id)).toEqual(answers);
    expect((await getRecommendations(student.id))?.[0].work.slug).toBe("play");
  });

  it("only students can save quiz results", async () => {
    const teacher = await makeUser("TEACHER");
    await expect(saveQuizResult(teacher.actor, answers)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("treats answers from an older quiz version as not taken", async () => {
    const student = await makeUser("STUDENT");
    await db.quizResult.create({ data: { userId: student.id, answers: { oldQuestion: "x" } } });
    expect(await getLatestQuizAnswers(student.id)).toBeNull();
  });
});

describe("sample content seed", () => {
  it("has 45 valid works covering every genre", () => {
    const { works } = loadSampleContent();
    expect(works).toHaveLength(45);
    expect(new Set(works.map((w) => w.slug)).size).toBe(45);
    expect(new Set(works.map((w) => w.genre)).size).toBe(6);
  });

  it("is idempotent and only adds placeholder segments to published works", async () => {
    const first = await seedContent(db);
    const second = await seedContent(db);
    const published = loadSampleContent().works.filter((w) => w.status === "PUBLISHED").length;

    expect(first.segmentsCreated).toBe(published * 5);
    expect(second.segmentsCreated).toBe(0);
    const real = loadRealWorks();
    expect(first.realWorksCreated).toBe(real.length);
    expect(second.realWorksCreated).toBe(0);
    expect(await db.work.count()).toBe(45 + real.length);
  });

  it("seeds the real works with full text, questions for every stage and mini games", async () => {
    await seedContent(db);
    for (const w of loadRealWorks()) {
      const work = await db.work.findUniqueOrThrow({
        where: { slug: w.slug },
        include: { segments: true, questions: true, miniGames: true },
      });
      expect(work.segments).toHaveLength(w.segments.length);
      expect(work.segments.every((s) => !s.content.includes("giữ chỗ"))).toBe(true);
      expect(new Set(work.questions.map((q) => q.stage))).toEqual(new Set(["PRE", "DURING", "POST"]));
      expect(work.questions.filter((q) => q.type === "MCQ").every((q) => q.correctOptionId)).toBe(true);
      expect(work.miniGames.length).toBeGreaterThan(0);
      expect(work.background).toContain("Tác giả");
    }
  });

  it("marks placeholder text clearly", () => {
    const [segment] = placeholderSegments({ title: "Bài thơ mẫu 01", genre: "THO" });
    expect(segment.content).toContain("Văn bản giữ chỗ");
    expect(segment.title).toBe("Khổ 1");
  });
});
