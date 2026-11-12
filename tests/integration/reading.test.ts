import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { htmlToText } from "@/lib/reading/html-text";
import {
  MAX_SECONDS_PER_REQUEST,
  MAX_SECONDS_PER_SEGMENT,
  addReadingTime,
  createHighlight,
  deleteHighlight,
  getContinueReading,
  getReader,
  getWeeklyStats,
  getWorkPath,
  getWorkProgress,
  markSegmentsRead,
  saveProgress,
  track,
  updateHighlight,
  readingSettingsSchema,
  updateReadingSettings,
} from "@/server/services/reading";
import { makeUser, resetDatabase } from "../helpers/db";
import type { WorkStatus } from "@/generated/prisma/enums";

beforeEach(resetDatabase);

const SEGMENT_HTML = "<p>Mặt trời xuống biển như hòn lửa. Sóng đã cài then, đêm sập cửa.</p>";

async function makeWork(slug: string, status: WorkStatus = "PUBLISHED", segments = 2) {
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
      status,
      searchText: slug,
      segments: {
        create: Array.from({ length: segments }, (_, i) => ({ order: i + 1, title: `Khổ ${i + 1}`, content: SEGMENT_HTML })),
      },
    },
    include: { segments: { orderBy: { order: "asc" } } },
  });
}

describe("getReader", () => {
  it("returns sanitised segments, own progress, reads, highlights and settings", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc");
    await db.segment.update({ where: { id: work.segments[0].id }, data: { content: "<p onclick=x>Hi<script>1</script></p>" } });

    const reader = await getReader(student.actor, "doc");
    expect(reader?.segments.map((s) => s.content)[0]).toBe("<p>Hi</p>");
    expect(reader).toMatchObject({ progress: null, readSegmentIds: [], highlights: [], settings: { fontSize: 18 } });
  });

  it("is only for students, and only for published works", async () => {
    const student = await makeUser("STUDENT");
    const teacher = await makeUser("TEACHER");
    await makeWork("soon", "COMING_SOON");
    await makeWork("doc");
    expect(await getReader(student.actor, "soon")).toBeNull();
    await expect(getReader(teacher.actor, "doc")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("progress and reads", () => {
  it("saves the position (clamped) and resumes the latest work", async () => {
    const student = await makeUser("STUDENT");
    const a = await makeWork("a");
    const b = await makeWork("b");

    await saveProgress(student.actor, a.segments[1].id, 1.7);
    expect(await db.readingProgress.findFirst()).toMatchObject({ segmentId: a.segments[1].id, segmentFraction: 1 });

    await saveProgress(student.actor, b.segments[0].id, 0.25);
    await markSegmentsRead(student.actor, [b.segments[0].id]);
    expect(await getContinueReading(student.id)).toMatchObject({ slug: "b", totalSegments: 2, readSegments: 1 });
  });

  it("marks segments read idempotently and ignores unknown or unpublished ones", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc");
    const soon = await makeWork("soon", "COMING_SOON");
    const ids = [work.segments[0].id, work.segments[0].id, soon.segments[0].id, "missing"];

    await markSegmentsRead(student.actor, ids);
    await markSegmentsRead(student.actor, ids);
    expect(await db.segmentRead.count()).toBe(1);
    expect(await getWorkProgress(student.id, work.id)).toEqual({ started: false, total: 2, read: 1 });
  });

  it("refuses progress on a segment of an unpublished work", async () => {
    const student = await makeUser("STUDENT");
    const soon = await makeWork("soon", "COMING_SOON");
    await expect(saveProgress(student.actor, soon.segments[0].id, 0)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("reading time", () => {
  it("accumulates per segment and Vietnam day", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc");
    const [s1, s2] = work.segments.map((s) => s.id);

    await addReadingTime(student.actor, { [s1]: 20 }, new Date("2026-11-10T16:00:00Z")); // 23:00 VN, 10/11
    await addReadingTime(student.actor, { [s1]: 15, [s2]: 5 }, new Date("2026-11-10T16:30:00Z"));
    await addReadingTime(student.actor, { [s1]: 10 }, new Date("2026-11-10T17:30:00Z")); // 00:30 VN, 11/11

    const rows = await db.readingTime.findMany({ orderBy: [{ day: "asc" }, { seconds: "desc" }] });
    expect(rows.map((r) => [r.segmentId === s1 ? "s1" : "s2", r.day.toISOString().slice(0, 10), r.seconds])).toEqual([
      ["s1", "2026-11-10", 35],
      ["s2", "2026-11-10", 5],
      ["s1", "2026-11-11", 10],
    ]);
  });

  it("caps implausible values and ignores bad input", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc", "PUBLISHED", 3);
    const [s1, s2, s3] = work.segments.map((s) => s.id);

    await addReadingTime(student.actor, { [s1]: 9999, [s2]: 9999, [s3]: 9999, missing: 30 });
    const total = (await db.readingTime.aggregate({ _sum: { seconds: true } }))._sum.seconds;
    expect(total).toBe(MAX_SECONDS_PER_REQUEST);
    expect((await db.readingTime.findFirst({ where: { segmentId: s1 } }))?.seconds).toBe(MAX_SECONDS_PER_SEGMENT);

    await addReadingTime(student.actor, { [s1]: -5, [s2]: Number.NaN });
    expect((await db.readingTime.aggregate({ _sum: { seconds: true } }))._sum.seconds).toBe(MAX_SECONDS_PER_REQUEST);
  });

  it("track() applies reads, time and progress together", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc");
    const s1 = work.segments[0].id;
    await track(student.actor, { read: [s1], time: { [s1]: 12 }, progress: { segmentId: s1, fraction: 0.5 } });
    expect(await db.segmentRead.count()).toBe(1);
    expect(await db.readingTime.count()).toBe(1);
    expect(await db.readingProgress.count()).toBe(1);
  });
});

describe("highlights", () => {
  async function setup() {
    const student = await makeUser("STUDENT");
    const other = await makeUser("STUDENT");
    const work = await makeWork("doc");
    const segment = work.segments[0];
    return { student, other, work, segment, text: htmlToText(SEGMENT_HTML) };
  }

  it("snaps to words and derives quote and context on the server", async () => {
    const { student, segment, text } = await setup();
    const start = text.indexOf("rời"); // inside "trời"
    const highlight = await createHighlight(student.actor, { segmentId: segment.id, start, end: start + 8, color: "BLUE" });

    expect(highlight.quote).toBe("trời xuống");
    const row = await db.highlight.findUniqueOrThrow({ where: { id: highlight.id } });
    expect(row.prefix).toBe("Mặt ");
    expect(row.suffix.startsWith(" biển")).toBe(true);
  });

  it("rejects empty or out-of-range selections", async () => {
    const { student, segment, text } = await setup();
    await expect(
      createHighlight(student.actor, { segmentId: segment.id, start: text.length + 5, end: text.length + 9, color: "YELLOW" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only the owner can update or delete", async () => {
    const { student, other, segment } = await setup();
    const h = await createHighlight(student.actor, { segmentId: segment.id, start: 0, end: 3, color: "YELLOW" });

    await expect(updateHighlight(other.actor, { id: h.id, note: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteHighlight(other.actor, h.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const updated = await updateHighlight(student.actor, { id: h.id, color: "PINK", note: "Hay quá", isPrivate: true });
    expect(updated).toMatchObject({ color: "PINK", note: "Hay quá", isPrivate: true });

    await deleteHighlight(student.actor, h.id);
    expect(await db.highlight.count()).toBe(0);
  });

  it("appears in the reader for its owner only", async () => {
    const { student, other, segment } = await setup();
    await createHighlight(student.actor, { segmentId: segment.id, start: 0, end: 3, color: "YELLOW" });
    expect((await getReader(student.actor, "doc"))?.highlights).toHaveLength(1);
    expect((await getReader(other.actor, "doc"))?.highlights).toHaveLength(0);
  });
});

describe("reading settings", () => {
  it("persists per user", async () => {
    const student = await makeUser("STUDENT");
    await makeWork("doc");
    await updateReadingSettings(student.actor, { fontSize: 22, lineHeight: 1.9, theme: "SEPIA" });
    expect((await getReader(student.actor, "doc"))?.settings).toEqual({
      fontSize: 22,
      lineHeight: 1.9,
      theme: "SEPIA",
      font: "NOTO_SERIF",
      backdrop: "none",
      pageMode: "SCROLL",
    });

    await updateReadingSettings(student.actor, {
      fontSize: 22,
      lineHeight: 1.9,
      theme: "SEPIA",
      font: "LORA",
      backdrop: "dem-sao",
      pageMode: "PAGED",
    });
    expect((await getReader(student.actor, "doc"))?.settings).toMatchObject({
      font: "LORA",
      backdrop: "dem-sao",
      pageMode: "PAGED",
    });
  });

  it("only accepts known backdrops", () => {
    const base = { fontSize: 18, lineHeight: 1.7, theme: "LIGHT" };
    expect(readingSettingsSchema.safeParse({ ...base, backdrop: "hoa-dao" }).success).toBe(true);
    expect(readingSettingsSchema.safeParse({ ...base, backdrop: "url(evil)" }).success).toBe(false);
    expect(readingSettingsSchema.safeParse({ ...base, pageMode: "SIDEWAYS" }).success).toBe(false);
  });
});

describe("getWorkPath", () => {
  it("marks read segments and the current one, never locking anything", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc", "PUBLISHED", 3);
    const [first, second, third] = work.segments;

    let path = await getWorkPath(student.actor.id, work.id);
    expect(path.map((n) => [n.id, n.read, n.current])).toEqual([
      [first.id, false, true],
      [second.id, false, false],
      [third.id, false, false],
    ]);

    await markSegmentsRead(student.actor, [first.id]);
    path = await getWorkPath(student.actor.id, work.id);
    expect(path.find((n) => n.current)?.id).toBe(second.id);

    await saveProgress(student.actor, third.id, 0.5);
    path = await getWorkPath(student.actor.id, work.id);
    expect(path.find((n) => n.current)?.id).toBe(third.id);
    expect(path.filter((n) => n.read).map((n) => n.id)).toEqual([first.id]);
  });
});

describe("getWeeklyStats", () => {
  it("sums the last 7 Vietnam days only", async () => {
    const student = await makeUser("STUDENT");
    const work = await makeWork("doc");
    const segmentId = work.segments[0].id;
    const now = new Date("2026-11-12T03:00:00Z"); // 10:00 in Vietnam
    const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
    await db.readingTime.createMany({
      data: [
        { userId: student.actor.id, segmentId, day: day("2026-11-12"), seconds: 600 },
        { userId: student.actor.id, segmentId, day: day("2026-11-06"), seconds: 300 },
        { userId: student.actor.id, segmentId, day: day("2026-11-05"), seconds: 900 }, // 8 days ago
      ],
    });

    const stats = await getWeeklyStats(student.actor.id, now);
    expect(stats.minutes).toBe(15);
    expect(stats.days).toHaveLength(7);
    expect(stats.days[0]).toMatchObject({ minutes: 5 });
    expect(stats.days[6]).toMatchObject({ minutes: 10 });
  });
});
