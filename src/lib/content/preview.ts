/**
 * Browser-side preview of segment HTML with the same whitelist the server
 * applies on save (src/lib/reading/sanitize.ts): allowed tags only, no
 * attributes. Parsing happens in an inert DOMParser document, so nothing in
 * the input runs or loads.
 */
const ALLOWED = new Set(["p", "br", "em", "i", "strong", "b", "u", "blockquote", "h3", "h4", "ul", "ol", "li"]);
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function previewHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = (node as Element).localName;
    if (tag === "script" || tag === "style") return "";
    const inner = [...node.childNodes].map(walk).join("");
    if (!ALLOWED.has(tag)) return inner;
    return tag === "br" ? "<br />" : `<${tag}>${inner}</${tag}>`;
  };
  return [...doc.body.childNodes].map(walk).join("");
}
