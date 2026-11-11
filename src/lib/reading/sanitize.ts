import sanitizeHtml from "sanitize-html";

/**
 * The only markup allowed in segment text: paragraphs, line breaks, emphasis,
 * quotes, lists and small headings. No attributes, links, images or scripts.
 */
export function sanitizeSegmentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "em", "i", "strong", "b", "u", "blockquote", "h3", "h4", "ul", "ol", "li"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}
