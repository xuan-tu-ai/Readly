"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { goToPage, pageMetrics } from "./position";

const SWIPE_PX = 50;
const WHEEL_PX = 40;
const WHEEL_COOLDOWN_MS = 450;

function typingInto(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
  );
}

function hasSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}

/**
 * Page turning for paged mode: buttons call `turn`, plus arrow keys / Page
 * Up-Down / Space, horizontal swipes on touch screens and the mouse wheel.
 * `onRelayout` runs after the page box changes size (font, window…), so the
 * caller can return to the same reading position.
 */
export function usePager(boxRef: RefObject<HTMLElement | null>, enabled: boolean, onRelayout: () => void) {
  const [page, setPage] = useState({ current: 0, count: 1 });

  const sync = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const { current, count } = pageMetrics(box);
    setPage((prev) => (prev.current === current && prev.count === count ? prev : { current, count }));
  }, [boxRef]);

  const turn = useCallback(
    (delta: number) => {
      const box = boxRef.current;
      if (!box) return;
      const smooth =
        document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      goToPage(box, pageMetrics(box).current + delta, smooth);
    },
    [boxRef],
  );

  useEffect(() => {
    const box = boxRef.current;
    if (!enabled || !box) return;

    let lastWheel = 0;
    let start: { x: number; y: number } | null = null;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typingInto(e.target)) return;
      if (document.querySelector("[data-slot=popover-content], [role=dialog]")) return;
      const forward = e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
      const back = e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
      if (!forward && !back) return;
      e.preventDefault();
      turn(forward ? 1 : -1);
    };
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < WHEEL_PX) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < WHEEL_COOLDOWN_MS) return;
      lastWheel = now;
      turn(delta > 0 ? 1 : -1);
    };
    const onPointerDown = (e: PointerEvent) => {
      start = e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) || hasSelection()) return;
      turn(dx < 0 ? 1 : -1);
    };

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        onRelayout();
        sync();
      });
    });
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);

    window.addEventListener("keydown", onKey);
    box.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("pointerdown", onPointerDown);
    box.addEventListener("pointerup", onPointerUp);
    box.addEventListener("scroll", sync, { passive: true });
    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointerdown", onPointerDown);
      box.removeEventListener("pointerup", onPointerUp);
      box.removeEventListener("scroll", sync);
    };
  }, [boxRef, enabled, onRelayout, sync, turn]);

  return { page: page.current, pageCount: page.count, turn };
}
