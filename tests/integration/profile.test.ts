import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createHighlight, getContinueReading, markSegmentsRead, saveProgress } from "@/server/services/reading";
import {
  getAvatar,
  getHighlightFacets,
  getReadingHistory,
  listProfileHighlights,
  setAvatar,
} from "@/server/services/profile";
import { makeUser, resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const SEGMENT_HTML = "<p>Mặt trời xuống biển như hòn lửa. Sóng đã cài then, đêm sập cửa.</p>";

async function makeWork(slug: string, segments = 4) {
  return db.work.create({
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
        create: Array.from({ length: segments }, (_, i) => ({ order: i + 1, title: `Khổ ${i + 1}`, content: SEGMENT_HTML })),
      },
    },
    include: { segments: { orderBy: { order: "asc" } } },
  });
}

describe("reading history", () => {
  it("splits works in progress (with %) from completed ones", async () => {
    const student = await makeUser("STUDENT");
    const open = await makeWork("open");
    const done = await makeWork("done", 2);

    await saveProgress(student.actor, open.segments[0].id, 0.5);
    await markSegmentsRead(student.actor, [open.segments[0].id]);
    await saveProgress(student.actor, done.segments[1].id, 1);
    await markSegmentsRead(student.actor, done.segments.map((s) => s.id));
    // Reading every segment of a work without questions completes it; mark it on time.
    await db.workCompletion.update({ where: { userId_workId: { userId: student.id, workId: done.id } }, data: { onTime: true } });

    const history = await getReadingHistory(student.id);
    expect(history.reading).toEqual([expect.objectContaining({ slug: "open", read: 1, total: 4, percent: 25 })]);
    expect(history.completed).toEqual([expect.objectContaining({ slug: "done", onTime: true })]);
    // "Continue reading" skips the finished work even though it was opened last.
    expect(await getContinueReading(student.id)).toMatchObject({ slug: "open" });
  });
});

describe("profile highlights", () => {
  it("lists own highlights newest first, filters by colour and work, keeps orphaned ones", async () => {
    const student = await makeUser("STUDENT");
    const other = await makeUser("STUDENT");
    const a = await makeWork("a");
    const b = await makeWork("b");

    const first = await createHighlight(student.actor, { segmentId: a.segments[0].id, start: 0, end: 9, color: "YELLOW" });
    await createHighlight(student.actor, { segmentId: a.segments[1].id, start: 10, end: 20, color: "BLUE" });
    await createHighlight(student.actor, { segmentId: b.segments[0].id, start: 0, end: 9, color: "YELLOW" });
    await createHighlight(other.actor, { segmentId: b.segments[0].id, start: 0, end: 9, color: "PINK" });
    await db.highlight.update({ where: { id: first.id }, data: { orphanedAt: new Date() } });

    const all = await listProfileHighlights(student.id);
    expect(all).toHaveLength(3);
    expect(all.at(-1)).toMatchObject({ id: first.id, gone: true, quote: "Mặt trời" });
    expect(all.filter((h) => !h.gone)).toHaveLength(2);

    expect(await listProfileHighlights(student.id, { color: "YELLOW" })).toHaveLength(2);
    expect(await listProfileHighlights(student.id, { color: "YELLOW", work: "b" })).toHaveLength(1);

    const facets = await getHighlightFacets(student.id);
    expect(facets).toMatchObject({ total: 3, colors: { YELLOW: 2, BLUE: 1 } });
    expect(facets.works.map((w) => [w.slug, w.count])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });
});

describe("avatar", () => {
  it("defaults to a stable avatar and saves a valid choice", async () => {
    const student = await makeUser("STUDENT");
    const before = await getAvatar(student.id);
    expect(await getAvatar(student.id)).toBe(before);

    await setAvatar(student.actor, "bong");
    expect(await getAvatar(student.id)).toBe("bong");
    await expect(setAvatar(student.actor, "dragon")).rejects.toMatchObject({ code: "INVALID_INPUT" });

    const teacher = await makeUser("TEACHER");
    await expect(setAvatar(teacher.actor, "bong")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
