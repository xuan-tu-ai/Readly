import { Parser } from "htmlparser2";
import { BLOCK_TAGS } from "./text";

/**
 * Server-side text model of a segment's HTML. Must match `buildDomTextModel`
 * (dom-text.ts) character for character; a test checks the two agree.
 */
export function htmlToText(html: string): string {
  let text = "";
  const parser = new Parser(
    {
      ontext(chunk) {
        text += chunk;
      },
      onopentag(name) {
        if (name === "br") text += "\n";
      },
      onclosetag(name, isImplied) {
        // Void elements like <br> report an implied close; only real blocks add a break.
        if (BLOCK_TAGS.has(name) && !(isImplied && name === "br")) text += "\n";
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  return text;
}
