import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  lengthBucket,
  normalizeSearch,
  parseLibraryFilters,
  workSearchText,
} from "@/lib/catalog";

describe("normalizeSearch", () => {
  it("strips Vietnamese diacritics and đ, lower-cases, collapses spaces", () => {
    expect(normalizeSearch("  Tác   PHẨM Đồng  Đội ")).toBe("tac pham dong doi");
    expect(normalizeSearch("Ngữ văn ỷ ỹ")).toBe("ngu van y y");
  });

  it("builds search text from title and author", () => {
    expect(workSearchText({ title: "Bài thơ mẫu 01", author: "Tác giả ABC" })).toBe("bai tho mau 01 tac gia abc");
  });
});

describe("lengthBucket", () => {
  it.each([
    [1, "short"],
    [20, "short"],
    [21, "medium"],
    [60, "medium"],
    [61, "long"],
    [180, "long"],
  ])("%i minutes → %s", (minutes, bucket) => {
    expect(lengthBucket(minutes)).toBe(bucket);
  });
});

describe("formatMinutes", () => {
  it("formats minutes and hours in Vietnamese", () => {
    expect(formatMinutes(45)).toBe("45 phút");
    expect(formatMinutes(60)).toBe("1 giờ");
    expect(formatMinutes(95)).toBe("1 giờ 35 phút");
  });
});

describe("parseLibraryFilters", () => {
  it("accepts valid filters", () => {
    expect(parseLibraryFilters({ q: " thơ ", genre: "THO", length: "short", difficulty: "2" })).toEqual({
      q: "thơ",
      genre: "THO",
      length: "short",
      difficulty: 2,
    });
  });

  it("ignores invalid or empty values instead of failing", () => {
    expect(parseLibraryFilters({ q: "", genre: "ROMAN", length: "all", difficulty: "9" })).toEqual({
      q: undefined,
      genre: undefined,
      length: undefined,
      difficulty: undefined,
    });
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseLibraryFilters({ genre: ["KICH", "THO"] }).genre).toBe("KICH");
  });
});
