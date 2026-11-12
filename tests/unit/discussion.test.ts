import { describe, expect, it } from "vitest";
import { comparePosts, deadlineStage, findBannedWord } from "@/lib/discussion";
import { dueAtFromDate } from "@/lib/teacher";

describe("banned word filter", () => {
  it("blocks listed words and abbreviations as whole words, any case", () => {
    expect(findBannedWord("Đm bài này khó quá")).toBe("đm");
    expect(findBannedWord("hay VCL luôn")).toBe("vcl");
    expect(findBannedWord("đồ   chó")).toBe("đồ   chó");
  });

  it("keeps diacritics so ordinary words are not caught", () => {
    for (const ok of ["Nhân vật lớn lên ở làng quê", "đi học về", "Bài thơ dở dang", "con dơi", "admin", "lớp 12A1"]) {
      expect(findBannedWord(ok)).toBeNull();
    }
  });

  it("matches inside punctuation but not inside longer words", () => {
    expect(findBannedWord("(đéo!)")).toBe("đéo");
    expect(findBannedWord("shitake")).toBeNull();
  });
});

describe("post order", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 12, h));
  const posts = [
    { id: "old-popular", pinned: false, likes: 9, replies: 1, createdAt: at(1) },
    { id: "new", pinned: false, likes: 0, replies: 0, createdAt: at(5) },
    { id: "pinned", pinned: true, likes: 0, replies: 0, createdAt: at(0) },
    { id: "talked", pinned: false, likes: 9, replies: 4, createdAt: at(2) },
  ];

  it("Mới nhất: pinned, then newest", () => {
    expect([...posts].sort(comparePosts("new")).map((p) => p.id)).toEqual(["pinned", "new", "talked", "old-popular"]);
  });

  it("Nổi bật: pinned, then likes, replies, newest", () => {
    expect([...posts].sort(comparePosts("top")).map((p) => p.id)).toEqual(["pinned", "talked", "old-popular", "new"]);
  });
});

describe("deadline reminder stages (Vietnam time)", () => {
  const dueAt = dueAtFromDate("2026-11-20")!; // end of 20/11 in Vietnam

  it("fires 2 days and 1 day before, from 07:00", () => {
    expect(deadlineStage(dueAt, new Date("2026-11-18T01:00:00Z"))).toBe(2); // 08:00 on the 18th
    expect(deadlineStage(dueAt, new Date("2026-11-19T15:00:00Z"))).toBe(1); // 22:00 on the 19th
    expect(deadlineStage(dueAt, new Date("2026-11-17T23:30:00Z"))).toBeNull(); // 06:30 on the 18th
  });

  it("is silent on other days and after the deadline", () => {
    expect(deadlineStage(dueAt, new Date("2026-11-17T03:00:00Z"))).toBeNull(); // 3 days before
    expect(deadlineStage(dueAt, new Date("2026-11-20T03:00:00Z"))).toBeNull(); // due today
    expect(deadlineStage(dueAt, new Date("2026-11-21T03:00:00Z"))).toBeNull();
  });
});
