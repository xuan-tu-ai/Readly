import { describe, expect, it } from "vitest";
import { anchorFor, sentenceAt, snapToWords } from "@/lib/reading/text";
import { htmlToText } from "@/lib/reading/html-text";
import { sanitizeSegmentHtml } from "@/lib/reading/sanitize";
import { ActiveTimeTracker, IDLE_LIMIT_MS, MAX_TICK_MS, vnDay } from "@/lib/reading/active-time";

const slice = (text: string, span: { start: number; end: number } | null) =>
  span ? text.slice(span.start, span.end) : null;

describe("snapToWords", () => {
  const text = "Mặt trời xuống biển như hòn lửa.";

  it("expands a selection that cuts words in half", () => {
    // "rời xuố" → "trời xuống"
    expect(slice(text, snapToWords(text, 6, 13))).toBe("trời xuống");
  });

  it("keeps Vietnamese diacritics inside words (combining marks too)", () => {
    const decomposed = "Thú vị lấm";
    expect(slice(decomposed, snapToWords(decomposed, 1, 2))).toBe("Thú");
  });

  it("trims surrounding spaces and handles reversed input", () => {
    expect(slice(text, snapToWords(text, 15, 8))).toBe("xuống");
  });

  it("returns null for whitespace-only selections", () => {
    expect(snapToWords("a   b", 1, 4)).toBeNull();
  });
});

describe("sentenceAt", () => {
  const prose = "Câu thứ nhất. Câu “thứ hai!” Còn câu ba…";

  it("finds the sentence around an offset", () => {
    expect(slice(prose, sentenceAt(prose, 2))).toBe("Câu thứ nhất.");
    expect(slice(prose, sentenceAt(prose, 18))).toBe("Câu “thứ hai!”");
    expect(slice(prose, sentenceAt(prose, prose.length - 1))).toBe("Còn câu ba…");
  });

  it("does not split on a dot inside a number or abbreviation without a space", () => {
    const t = "Năm 1945.9 vẫn là một câu. Hết.";
    expect(slice(t, sentenceAt(t, 3))).toBe("Năm 1945.9 vẫn là một câu.");
  });

  it("treats each poem line as a unit", () => {
    const poem = "Dòng một không dấu chấm\nDòng hai cũng vậy\n";
    expect(slice(poem, sentenceAt(poem, 25))).toBe("Dòng hai cũng vậy");
  });

  it("returns null on an empty line", () => {
    expect(sentenceAt("a\n\nb", 2)).toBeNull();
  });
});

describe("htmlToText", () => {
  it("adds line breaks for <br> and after blocks, decodes entities", () => {
    expect(htmlToText("<p>Dòng 1<br />Dòng 2</p><p>A &amp; <em>B</em></p>")).toBe("Dòng 1\nDòng 2\nA & B\n");
  });
});

describe("anchorFor", () => {
  it("captures quote with up to 30 chars of context", () => {
    const text = "x".repeat(40) + "QUOTE" + "y".repeat(40);
    const anchor = anchorFor(text, { start: 40, end: 45 });
    expect(anchor.quote).toBe("QUOTE");
    expect(anchor.prefix).toBe("x".repeat(30));
    expect(anchor.suffix).toBe("y".repeat(30));
  });
});

describe("sanitizeSegmentHtml", () => {
  it("keeps reading markup and strips scripts, attributes and links", () => {
    const dirty = '<p class="x" onclick="evil()">Hi <a href="http://x">link</a><script>alert(1)</script><br><em>ok</em></p>';
    expect(sanitizeSegmentHtml(dirty)).toBe("<p>Hi link<br /><em>ok</em></p>");
  });
});

describe("ActiveTimeTracker", () => {
  it("credits time while visible and recently active", () => {
    const t = new ActiveTimeTracker(0);
    t.tick(5_000, true, "s1");
    t.tick(10_000, true, "s1");
    t.tick(12_500, true, "s2");
    expect(t.drain()).toEqual({ s1: 10, s2: 2 });
    // the 0.5 s remainder of s2 is kept
    t.tick(13_000, true, "s2");
    expect(t.drain()).toEqual({ s2: 1 });
  });

  it("stops counting after a minute without interaction, resumes on interaction", () => {
    const t = new ActiveTimeTracker(0);
    t.tick(IDLE_LIMIT_MS, true, "s1"); // exactly at the limit: still active
    t.tick(IDLE_LIMIT_MS + 10_000, true, "s1"); // idle now
    t.interact(IDLE_LIMIT_MS + 20_000);
    t.tick(IDLE_LIMIT_MS + 25_000, true, "s1");
    expect(t.drain()).toEqual({ s1: MAX_TICK_MS / 1000 + 5 }); // 15 s before idling + 5 s after returning
  });

  it("ignores hidden tabs, including the hidden period itself", () => {
    const t = new ActiveTimeTracker(0);
    t.tick(5_000, false, "s1");
    t.interact(3_600_000);
    t.tick(3_605_000, true, "s1"); // back after an hour: only the last 5 s count
    expect(t.drain()).toEqual({ s1: 5 });
  });

  it("caps a single tick (throttled timers)", () => {
    const t = new ActiveTimeTracker(0);
    t.interact(50_000);
    t.tick(50_000, true, "s1");
    expect(t.drain()).toEqual({ s1: MAX_TICK_MS / 1000 });
  });
});

describe("vnDay", () => {
  it("uses the Vietnam calendar day (UTC+7)", () => {
    expect(vnDay(new Date("2026-11-10T16:59:59Z")).toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(vnDay(new Date("2026-11-10T17:00:00Z")).toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });
});
