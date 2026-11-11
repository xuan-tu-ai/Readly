/**
 * Plain-text helpers for the reader. Offsets always index into a segment's
 * text model: the concatenation of its text nodes, with "\n" for every <br>
 * and after every block element (see html-text.ts / dom-text.ts, which must
 * produce the same string for the same HTML).
 */

/** Elements that end with a virtual "\n" in the text model. */
export const BLOCK_TAGS = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol"]);

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const isWord = (ch: string | undefined) => ch !== undefined && WORD_CHAR.test(ch);
const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

export type Span = { start: number; end: number };

/**
 * Expands a raw selection so it never cuts a word in half, then trims
 * surrounding whitespace. Returns null for an empty or whitespace-only span.
 */
export function snapToWords(text: string, rawStart: number, rawEnd: number): Span | null {
  let start = Math.max(0, Math.min(rawStart, rawEnd));
  let end = Math.min(text.length, Math.max(rawStart, rawEnd));
  while (start > 0 && isWord(text[start]) && isWord(text[start - 1])) start--;
  while (end < text.length && isWord(text[end - 1]) && isWord(text[end])) end++;
  while (start < end && isSpace(text[start])) start++;
  while (end > start && isSpace(text[end - 1])) end--;
  return end > start ? { start, end } : null;
}

const TERMINATORS = new Set([".", "!", "?", "…"]);
const CLOSERS = new Set(['"', "”", "’", "'", ")", "»", "]"]);

/**
 * The sentence (or, for poetry, the line) containing `offset`. A sentence ends
 * after . ! ? … (plus any closing quotes) when followed by whitespace or the
 * end of text, or at a line break.
 */
export function sentenceAt(text: string, offset: number): Span | null {
  if (text.length === 0) return null;
  const at = Math.max(0, Math.min(offset, text.length - 1));
  if (text[at] === "\n") return null;

  const isBoundaryEnd = (i: number) => {
    // index i is the last char of a sentence?
    if (!TERMINATORS.has(text[i]) && !CLOSERS.has(text[i])) return false;
    let j = i;
    while (j >= 0 && CLOSERS.has(text[j])) j--;
    if (j < 0 || !TERMINATORS.has(text[j])) return false;
    const next = text[i + 1];
    return next === undefined || isSpace(next);
  };

  let start = at;
  while (start > 0 && text[start - 1] !== "\n" && !isBoundaryEnd(start - 1)) start--;
  let end = at;
  while (end < text.length && text[end] !== "\n" && !isBoundaryEnd(end)) end++;
  if (end < text.length && text[end] !== "\n") {
    end++; // include the terminator
    while (end < text.length && CLOSERS.has(text[end])) end++;
  }

  while (start < end && isSpace(text[start])) start++;
  while (end > start && isSpace(text[end - 1])) end--;
  return end > start ? { start, end } : null;
}

export const ANCHOR_CONTEXT = 30;

/** Quote plus surrounding context, used to re-anchor highlights after edits. */
export function anchorFor(text: string, { start, end }: Span) {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - ANCHOR_CONTEXT), start),
    suffix: text.slice(end, end + ANCHOR_CONTEXT),
  };
}
