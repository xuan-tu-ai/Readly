import { Parser } from "htmlparser2";
import type { Genre } from "@/generated/prisma/enums";
import { BLOCK_TAGS } from "@/lib/reading/text";

/**
 * Import helpers (spec §3.3): a sanitised .docx → HTML document is cut into
 * top-level blocks, and segment boundaries are *suggested* from headings,
 * blank lines, scene markers and length. The admin then merges or splits
 * before saving. Pure functions, unit-tested.
 */

export type Block = { html: string; text: string; kind: "heading" | "para" | "empty" | "separator" };

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Top-level blocks of an HTML fragment, each with its raw HTML and plain text. */
export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let start = -1;
  let tag = "";
  let text = "";
  const parser = new Parser(
    {
      onopentag(name) {
        if (depth === 0) {
          start = parser.startIndex;
          tag = name;
          text = "";
        }
        if (name === "br") text += "\n";
        // <br> is void: it never "closes", so it does not change the depth.
        if (name !== "br") depth++;
        else if (depth === 0) {
          // A bare top-level <br>: treat as an empty line.
          blocks.push({ html: "", text: "", kind: "empty" });
        }
      },
      ontext(chunk) {
        if (depth === 0) {
          if (chunk.trim()) blocks.push(classify(`<p>${chunk.trim()}</p>`, "p", chunk.trim()));
          return;
        }
        text += chunk;
      },
      onclosetag(name, implied) {
        if (name === "br") return;
        depth--;
        if (depth === 0 && start >= 0) {
          const end = implied ? parser.endIndex : parser.endIndex + 1;
          blocks.push(classify(html.slice(start, end), tag, text));
          start = -1;
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  return blocks;
}

const SEPARATOR = /^[\s*·•—–\-~#o0O]{3,}$/u;

function classify(html: string, tag: string, rawText: string): Block {
  const text = rawText.replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").trim();
  if (HEADINGS.has(tag)) return { html, text, kind: text ? "heading" : "empty" };
  if (!text) return { html, text, kind: "empty" };
  if (SEPARATOR.test(text)) return { html, text, kind: "separator" };
  return { html, text, kind: BLOCK_TAGS.has(tag) || tag === "table" ? "para" : "para" };
}

/** "HỒI II", "Cảnh 3", "LỚP 1", "Màn một"… on its own line marks a new scene in a play. */
export const SCENE_MARKER = /^(?:hồi|cảnh|lớp|màn|phần|chương)\s+(?:[0-9]+|[ivxlc]+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\b[^\n]{0,40}$/iu;

/** Long prose is cut near this many characters (at paragraph ends) when nothing else marks a break. */
export const TARGET_CHARS = 1800;
export const MAX_CHARS = 3000;

export type ImportDraft = {
  /** Content blocks in order (headings, blank lines and separators removed). */
  blocks: { html: string; text: string }[];
  /** starts[i]: block i begins a new segment (starts[0] is always true). */
  starts: boolean[];
  /** Title for the segment beginning at block i (null = default title). */
  titles: (string | null)[];
};

/**
 * Suggests where segments begin:
 * - a heading (or a scene marker line in a play) starts a segment and becomes its title;
 * - a separator line ("* * *") always breaks;
 * - blank lines break between stanzas of a poem (one blank line), or in prose
 *   and plays when two or more follow each other;
 * - prose segments longer than MAX_CHARS are cut at paragraph ends near TARGET_CHARS.
 */
export function suggestSegments(input: Block[], genre: Genre): ImportDraft {
  const blocks: ImportDraft["blocks"] = [];
  const starts: boolean[] = [];
  const titles: (string | null)[] = [];
  let pendingBreak = true;
  let pendingTitle: string | null = null;
  let blanks = 0;
  const blankBreak = genre === "THO" ? 1 : 2;

  for (const block of input) {
    const marker = block.kind === "para" && genre === "KICH" && SCENE_MARKER.test(block.text);
    if (block.kind === "heading" || marker) {
      pendingBreak = true;
      pendingTitle = block.text.replace(/\s+/g, " ").slice(0, 80);
      blanks = 0;
      continue;
    }
    if (block.kind === "separator") {
      pendingBreak = true;
      blanks = 0;
      continue;
    }
    if (block.kind === "empty") {
      blanks++;
      if (blanks >= blankBreak) pendingBreak = true;
      continue;
    }
    blanks = 0;
    blocks.push({ html: block.html, text: block.text });
    starts.push(pendingBreak || blocks.length === 1);
    titles.push(pendingBreak || blocks.length === 1 ? pendingTitle : null);
    pendingBreak = false;
    pendingTitle = null;
  }

  // A segment longer than MAX_CHARS is cut at paragraph ends, every ~TARGET_CHARS.
  for (let from = 0; from < blocks.length; ) {
    let to = from + 1;
    while (to < blocks.length && !starts[to]) to++;
    const total = blocks.slice(from, to).reduce((sum, b) => sum + b.text.length, 0);
    if (total > MAX_CHARS) {
      let size = 0;
      for (let i = from; i < to; i++) {
        if (i > from && size >= TARGET_CHARS) {
          starts[i] = true;
          size = 0;
        }
        size += blocks[i].text.length;
      }
    }
    from = to;
  }
  return { blocks, starts, titles };
}

export function defaultSegmentTitle(genre: Genre, n: number): string {
  return genre === "THO" ? `Khổ ${n}` : genre === "KICH" ? `Cảnh ${n}` : `Phần ${n}`;
}

export type SegmentDraft = { title: string; html: string };

const SIMPLE_LINE = /^<p>((?:(?!<\/?p[\s>])[\s\S])*)<\/p>$/u;

/**
 * Turns the (possibly edited) draft into segments. In poems, one-line
 * paragraphs of a stanza are joined into one paragraph with line breaks, so
 * the stanza reads as a block like in print.
 */
export function buildSegments(draft: ImportDraft, genre: Genre): SegmentDraft[] {
  const out: { title: string; parts: string[] }[] = [];
  draft.blocks.forEach((block, i) => {
    if (i === 0 || draft.starts[i]) {
      out.push({ title: draft.titles[i]?.trim() || defaultSegmentTitle(genre, out.length + 1), parts: [] });
    }
    out.at(-1)!.parts.push(block.html);
  });
  return out.map(({ title, parts }) => {
    if (genre === "THO" && parts.length > 1 && parts.every((p) => SIMPLE_LINE.test(p))) {
      const lines = parts.map((p) => SIMPLE_LINE.exec(p)![1]);
      return { title, html: `<p>${lines.join("<br />")}</p>` };
    }
    return { title, html: parts.join("") };
  });
}
