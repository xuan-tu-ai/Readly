import { BLOCK_TAGS } from "./text";

type Piece = { node: Text; start: number };

export type DomTextModel = {
  text: string;
  /** Text-model offset of a DOM boundary point (node, offset) inside the root. */
  offsetOf(node: Node, offset: number): number | null;
  /** DOM Range covering [start, end) of the text model. */
  toRange(start: number, end: number): Range | null;
};

/**
 * Client-side text model of a rendered segment. Must match `htmlToText`
 * (html-text.ts): text nodes verbatim, "\n" for <br> and after block elements.
 */
export function buildDomTextModel(root: Element): DomTextModel {
  const pieces: Piece[] = [];
  /** Offset reached after each element closes, for boundary points on elements. */
  const elementEnd = new Map<Node, number>();
  const elementStart = new Map<Node, number>();
  let text = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pieces.push({ node: node as Text, start: text.length });
      text += (node as Text).data;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const name = (node as Element).localName;
    elementStart.set(node, text.length);
    if (name === "br") {
      text += "\n";
    } else {
      node.childNodes.forEach(walk);
      if (BLOCK_TAGS.has(name)) text += "\n";
    }
    elementEnd.set(node, text.length);
  };
  root.childNodes.forEach(walk);
  elementStart.set(root, 0);
  elementEnd.set(root, text.length);

  function offsetOf(node: Node, offset: number): number | null {
    if (!root.contains(node)) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const piece = pieces.find((p) => p.node === node);
      return piece ? piece.start + Math.min(offset, (node as Text).data.length) : null;
    }
    // Element boundary: before child `offset`.
    const child = node.childNodes[offset];
    if (child) return elementStart.get(child) ?? null;
    return elementEnd.get(node) ?? null;
  }

  function locate(pos: number, preferNext: boolean): { node: Text; offset: number } | null {
    for (let i = 0; i < pieces.length; i++) {
      const { node, start } = pieces[i];
      const end = start + node.data.length;
      if (pos < start) return { node, offset: 0 }; // inside a virtual "\n": snap forward
      if (pos < end || (pos === end && !preferNext)) return { node, offset: pos - start };
    }
    const last = pieces.at(-1);
    return last ? { node: last.node, offset: last.node.data.length } : null;
  }

  function toRange(start: number, end: number): Range | null {
    if (end <= start) return null;
    const a = locate(start, true);
    const b = locate(end, false);
    if (!a || !b) return null;
    const range = root.ownerDocument.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return range;
  }

  return { text, offsetOf, toRange };
}
