/**
 * Re-anchoring highlights after an admin edits the text (spec §5.2, §3.4).
 * Tried in order:
 *   1. the stored offsets still cover the quote;
 *   2. the quote appears elsewhere in the same segment (best context wins);
 *   3. a slightly changed quote between the old prefix/suffix (typo fixes);
 *   4. the quote appears in another segment of the work;
 * otherwise the highlight is orphaned ("không còn trong văn bản").
 * Pure functions, unit-tested.
 */

export type Anchor = { segmentId: string; start: number; end: number; quote: string; prefix: string; suffix: string };
export type SegmentText = { id: string; text: string };
export type Located = {
  segmentId: string;
  start: number;
  end: number;
  how: "unchanged" | "moved" | "fuzzy" | "other-segment";
};

/** Minimum similarity (0–1) for a changed quote to still count as the same passage. */
export const FUZZY_MIN = 0.75;
const CONTEXT_PROBE = 20;

function commonSuffix(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefix(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function contextScore(text: string, start: number, end: number, a: Anchor) {
  return (
    commonSuffix(text.slice(Math.max(0, start - a.prefix.length), start), a.prefix) +
    commonPrefix(text.slice(end, end + a.suffix.length), a.suffix)
  );
}

function occurrences(text: string, needle: string): number[] {
  if (!needle) return [];
  const found: number[] = [];
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) found.push(i);
  return found;
}

/** Best exact occurrence of the quote in `text`, ranked by how well the surrounding text matches. */
function bestExact(text: string, a: Anchor): { start: number; end: number } | null {
  let best: { start: number; end: number; score: number } | null = null;
  for (const start of occurrences(text, a.quote)) {
    const end = start + a.quote.length;
    const score = contextScore(text, start, end, a) - Math.abs(start - a.start) / 1e6; // tie → nearest
    if (!best || score > best.score) best = { start, end, score };
  }
  return best && { start: best.start, end: best.end };
}

/** Levenshtein distance, two rows. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/**
 * The quote was edited (a typo fixed): look for the old prefix and suffix and
 * take what lies between, if it is still close enough to the quote.
 */
function fuzzyLocate(text: string, a: Anchor): { start: number; end: number; score: number } | null {
  const prefix = a.prefix.slice(-CONTEXT_PROBE);
  const suffix = a.suffix.slice(0, CONTEXT_PROBE);
  const starts = prefix.trim().length >= 6 ? occurrences(text, prefix).map((i) => i + prefix.length) : [];
  const ends = suffix.trim().length >= 6 ? occurrences(text, suffix) : [];
  const len = a.quote.length;
  const candidates: { start: number; end: number }[] = [];
  for (const s of starts) {
    const e = ends.find((x) => x >= s && x - s <= len * 1.5 + 10);
    candidates.push({ start: s, end: e ?? Math.min(text.length, s + len) });
  }
  for (const e of ends) {
    if (!candidates.some((c) => c.end === e)) candidates.push({ start: Math.max(0, e - len), end: e });
  }
  let best: { start: number; end: number; score: number } | null = null;
  for (const c of candidates) {
    // Trim whitespace the edit may have left at the edges.
    let { start, end } = c;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end <= start) continue;
    const score = similarity(text.slice(start, end), a.quote);
    if (score >= FUZZY_MIN && (!best || score > best.score)) best = { start, end, score };
  }
  return best;
}

export function reanchor(a: Anchor, segments: SegmentText[]): Located | null {
  const own = segments.find((s) => s.id === a.segmentId);
  if (own) {
    if (own.text.slice(a.start, a.end) === a.quote) return { segmentId: own.id, start: a.start, end: a.end, how: "unchanged" };
    const exact = bestExact(own.text, a);
    if (exact) return { segmentId: own.id, ...exact, how: "moved" };
    const fuzzy = fuzzyLocate(own.text, a);
    if (fuzzy) return { segmentId: own.id, start: fuzzy.start, end: fuzzy.end, how: "fuzzy" };
  }
  let best: (Located & { score: number }) | null = null;
  for (const s of segments) {
    if (s.id === a.segmentId) continue;
    const exact = bestExact(s.text, a);
    if (!exact) continue;
    const score = contextScore(s.text, exact.start, exact.end, a);
    if (!best || score > best.score) best = { segmentId: s.id, ...exact, how: "other-segment", score };
  }
  return best && { segmentId: best.segmentId, start: best.start, end: best.end, how: best.how };
}
