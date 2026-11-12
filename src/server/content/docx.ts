import mammoth from "mammoth";
import type { Genre } from "@/generated/prisma/enums";
import { htmlToBlocks, suggestSegments, type ImportDraft } from "@/lib/content/segmenter";
import { sanitizeSegmentHtml } from "@/lib/reading/sanitize";
import { DomainError } from "@/server/errors";

/**
 * .docx → sanitised HTML → suggested segments (spec §3.3). Italics, bold and
 * line breaks survive (they matter for poetry); everything else is dropped.
 */

export const MAX_DOCX_BYTES = 5 * 1024 * 1024;

/** Word's built-in heading styles become headings; blank paragraphs are kept as boundary hints. */
const STYLE_MAP = [
  "p[style-name='Title'] => h2:fresh",
  "p[style-name='Heading 1'] => h3:fresh",
  "p[style-name='Heading 2'] => h3:fresh",
  "p[style-name='Heading 3'] => h4:fresh",
  "p[style-name='Tiêu đề 1'] => h3:fresh",
  "p[style-name='Tiêu đề 2'] => h3:fresh",
];

export async function docxToHtml(buffer: Buffer) {
  if (buffer.length > MAX_DOCX_BYTES) throw new DomainError("INVALID_INPUT", "Tệp .docx tối đa 5 MB.");
  let result;
  try {
    result = await mammoth.convertToHtml(
      { buffer },
      { styleMap: STYLE_MAP, ignoreEmptyParagraphs: false, externalFileAccess: false },
    );
  } catch {
    throw new DomainError("INVALID_INPUT", "Không đọc được tệp. Hãy chắc chắn đây là tệp Word .docx.");
  }
  // Empty paragraphs must survive sanitising (they mark stanza breaks), so
  // they are swapped for a marker paragraph first.
  const marked = result.value.replace(/<p><\/p>/g, "<p>⁣</p>");
  const html = sanitizeSegmentHtml(marked).replace(/<p>⁣<\/p>/g, "<p></p>");
  return { html, warnings: result.messages.map((m) => m.message) };
}

export async function draftFromDocx(buffer: Buffer, genre: Genre): Promise<ImportDraft & { warnings: string[] }> {
  const { html, warnings } = await docxToHtml(buffer);
  const draft = suggestSegments(htmlToBlocks(html), genre);
  if (draft.blocks.length === 0) throw new DomainError("INVALID_INPUT", "Tệp không có nội dung văn bản.");
  return { ...draft, warnings };
}
