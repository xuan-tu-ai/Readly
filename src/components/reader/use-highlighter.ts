"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { HighlightColor } from "@/generated/prisma/enums";
import { buildDomTextModel, type DomTextModel } from "@/lib/reading/dom-text";
import { sentenceAt, snapToWords } from "@/lib/reading/text";

export type PaintableHighlight = { id: string; segmentId: string; start: number; end: number; color: HighlightColor };
export type PendingSelection = { segmentId: string; start: number; end: number };

const COLOR_REGISTRY: Record<HighlightColor, string> = {
  YELLOW: "hl-yellow",
  BLUE: "hl-blue",
  PINK: "hl-pink",
  PURPLE: "hl-purple",
};

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as CaretDoc;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

export function highlightsSupported() {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/**
 * Selection → highlight logic for the reader.
 * - Drag-select: the selection snaps to whole words (within one segment).
 * - Tap on plain text: selects the sentence (or poem line).
 * - Tap on an existing highlight: makes it active (for editing).
 * Painting uses the CSS Custom Highlight API, so the text DOM is never touched.
 */
export function useHighlighter({
  rootRef,
  highlights,
}: {
  rootRef: RefObject<HTMLElement | null>;
  highlights: PaintableHighlight[];
}) {
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const models = useRef(new Map<string, DomTextModel>());
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  // Latest values for the event handlers below, without re-binding them.
  const highlightsRef = useRef(highlights);
  const openRef = useRef(false);
  useEffect(() => {
    highlightsRef.current = highlights;
    openRef.current = pending !== null || activeId !== null;
  });

  const modelFor = useCallback((segmentId: string) => {
    let model = models.current.get(segmentId);
    if (!model) {
      const el = rootRef.current?.querySelector(`[data-segment-text="${segmentId}"]`);
      if (!el) return null;
      model = buildDomTextModel(el);
      models.current.set(segmentId, model);
    }
    return model;
  }, [rootRef]);

  // Paint.
  useEffect(() => {
    if (!highlightsSupported()) return;
    const byColor = new Map<string, Range[]>();
    const active: Range[] = [];
    for (const h of highlights) {
      const range = modelFor(h.segmentId)?.toRange(h.start, h.end);
      if (!range) continue;
      const name = COLOR_REGISTRY[h.color];
      byColor.set(name, [...(byColor.get(name) ?? []), range]);
      if (h.id === activeId) active.push(range);
    }
    for (const name of Object.values(COLOR_REGISTRY)) {
      CSS.highlights.set(name, new Highlight(...(byColor.get(name) ?? [])));
    }
    CSS.highlights.set("hl-active", new Highlight(...active));
    const pendingRange = pending ? modelFor(pending.segmentId)?.toRange(pending.start, pending.end) : null;
    CSS.highlights.set("hl-pending", new Highlight(...(pendingRange ? [pendingRange] : [])));
  }, [highlights, pending, activeId, modelFor]);

  useEffect(() => {
    return () => {
      if (!highlightsSupported()) return;
      for (const name of [...Object.values(COLOR_REGISTRY), "hl-pending", "hl-active"]) CSS.highlights.delete(name);
    };
  }, []);

  const clear = useCallback(() => {
    setPending(null);
    setActiveId(null);
  }, []);

  // Selection handling.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const segmentOf = (node: Node | null) =>
      (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-segment-text]") ?? null;

    const onPointerDown = (e: PointerEvent) => {
      pointerStart.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      // Let the browser finish updating the selection first.
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const container = segmentOf(range.startContainer);
          if (!container) return;
          const segmentId = container.dataset.segmentText!;
          const model = modelFor(segmentId);
          if (!model) return;
          const from = model.offsetOf(range.startContainer, range.startOffset);
          // A selection running into the next segment is cut at the end of this one.
          const to = segmentOf(range.endContainer) === container ? model.offsetOf(range.endContainer, range.endOffset) : model.text.length;
          const span = from !== null && to !== null ? snapToWords(model.text, from, to) : null;
          selection.removeAllRanges();
          if (span) {
            setActiveId(null);
            setPending({ segmentId, ...span });
          }
          return;
        }

        // A tap (not a scroll or drag).
        const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10 : true;
        if (moved) return;
        const caret = caretAt(e.clientX, e.clientY);
        const container = caret ? segmentOf(caret.node) : null;
        if (!caret || !container) return;
        const segmentId = container.dataset.segmentText!;
        const model = modelFor(segmentId);
        const offset = model?.offsetOf(caret.node, caret.offset);
        if (!model || offset === null || offset === undefined) return;

        const hit = highlightsRef.current.find((h) => h.segmentId === segmentId && h.start <= offset && offset < h.end);
        if (hit) {
          setPending(null);
          setActiveId(hit.id);
          return;
        }
        // While a toolbar is open, a tap elsewhere just closes it.
        if (openRef.current) {
          clear();
          return;
        }
        const span = sentenceAt(model.text, offset);
        if (span) setPending({ segmentId, ...span });
      }, 0);
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", onPointerUp);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
    };
  }, [rootRef, modelFor, clear]);

  return { pending, activeId, setActiveId, setPending, clear };
}
