"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ActiveTimeTracker } from "@/lib/reading/active-time";
import {
  goToPage,
  pageOf,
  pagedPosition,
  scrollPosition,
  scrollToPosition,
  type Position,
} from "./position";

const TRACK_URL = "/api/reading/track";
const TICK_MS = 5_000;
const FLUSH_MS = 20_000;
const SCROLL_IDLE_MS = 3_000;

type Options = {
  segmentIds: string[];
  initialRead: string[];
  initialPosition: Position | null;
  /** Element whose bottom edge is the "reading line" (the sticky reader header). */
  headerRef: RefObject<HTMLElement | null>;
  /** Horizontal page box, used when `paged` is on. */
  pagesRef: RefObject<HTMLElement | null>;
  paged: boolean;
};

function readingLine(headerRef: RefObject<HTMLElement | null>) {
  return (headerRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
}

/**
 * Tracks reading on the client and reports it to the server:
 * - a segment is "read" once its end sentinel has been on screen;
 * - the position (segment + fraction) is saved after scrolling stops;
 * - active time is credited to the current segment (see ActiveTimeTracker).
 * The last batch is sent with sendBeacon when the page is hidden or left.
 */
export function useReadingTracker({ segmentIds, initialRead, initialPosition, headerRef, pagesRef, paged }: Options) {
  const [readIds, setReadIds] = useState(() => new Set(initialRead));
  const [currentId, setCurrentId] = useState<string | null>(initialPosition?.segmentId ?? segmentIds[0] ?? null);

  const queuedReads = useRef(new Set<string>());
  const position = useRef<Position | null>(initialPosition);
  const positionDirty = useRef(false);
  const tracker = useRef<ActiveTimeTracker | null>(null);

  const flush = useCallback((beacon: boolean) => {
    const read = [...queuedReads.current];
    const time = tracker.current?.drain() ?? {};
    const progress = positionDirty.current ? position.current : null;
    if (read.length === 0 && Object.keys(time).length === 0 && !progress) return;

    queuedReads.current.clear();
    positionDirty.current = false;
    const body = JSON.stringify({
      ...(read.length ? { read } : {}),
      ...(Object.keys(time).length ? { time } : {}),
      ...(progress ? { progress } : {}),
    });

    if (beacon && navigator.sendBeacon?.(TRACK_URL, body)) return;
    fetch(TRACK_URL, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
      () => {
        // Keep reads for the next attempt; a lost few seconds of time is acceptable.
        read.forEach((id) => queuedReads.current.add(id));
        if (progress) positionDirty.current = true;
      },
    );
  }, []);

  /** Where the reader is now, in whichever layout is active. */
  const measure = useCallback((): Position | null => {
    const box = pagesRef.current;
    if (paged && box) return pagedPosition(segmentIds, box);
    return scrollPosition(segmentIds, readingLine(headerRef));
  }, [paged, segmentIds, headerRef, pagesRef]);

  const jumpTo = useCallback(
    (target: Position) => {
      const box = pagesRef.current;
      if (paged && box) {
        const page = pageOf(target, box);
        if (page !== null) goToPage(box, page);
      } else {
        scrollToPosition(target, readingLine(headerRef));
      }
      position.current = target;
      positionDirty.current = true;
      setCurrentId(target.segmentId);
    },
    [paged, headerRef, pagesRef],
  );

  // Restore the saved position once the text has laid out – on first load,
  // and again (to the same place) whenever the layout switches mode.
  useEffect(() => {
    const target = position.current;
    if (!target) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => jumpTo(target));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [jumpTo]);

  // Segment end sentinels → read.
  useEffect(() => {
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver((entries) => {
      const newlyRead: string[] = [];
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.endOf;
        if (entry.isIntersecting && id) {
          newlyRead.push(id);
          observer.unobserve(entry.target);
        }
      }
      if (newlyRead.length === 0) return;
      setReadIds((prev) => {
        const next = new Set(prev);
        for (const id of newlyRead) {
          if (!prev.has(id)) queuedReads.current.add(id);
          next.add(id);
        }
        return next;
      });
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => flush(false), 1_000);
    });
    document.querySelectorAll<HTMLElement>("[data-end-of]").forEach((el) => {
      if (!initialRead.includes(el.dataset.endOf!)) observer.observe(el);
    });
    return () => {
      observer.disconnect();
      clearTimeout(flushTimer);
    };
  }, [flush, initialRead]);

  // Position: window scroll in scroll mode, the page box in paged mode.
  useEffect(() => {
    const target: HTMLElement | Window | null = paged ? pagesRef.current : window;
    if (!target) return;
    let frame = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      tracker.current?.interact(Date.now());
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pos = measure();
        if (!pos) return;
        position.current = pos;
        positionDirty.current = true;
        setCurrentId(pos.segmentId);
      });
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => flush(false), SCROLL_IDLE_MS);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      target.removeEventListener("scroll", onScroll);
    };
  }, [paged, pagesRef, measure, flush]);

  // Activity and periodic flushes.
  useEffect(() => {
    tracker.current = new ActiveTimeTracker(Date.now());

    const interact = () => tracker.current?.interact(Date.now());
    const visible = () => document.visibilityState === "visible";
    const onVisibility = () => {
      if (!visible()) flush(true);
      else interact();
    };
    const onPageHide = () => flush(true);

    const tick = setInterval(() => tracker.current?.tick(Date.now(), visible(), position.current?.segmentId ?? null), TICK_MS);
    const flusher = setInterval(() => flush(false), FLUSH_MS);

    for (const type of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
      window.addEventListener(type, interact, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      tracker.current?.tick(Date.now(), visible(), position.current?.segmentId ?? null);
      flush(true);
      clearInterval(tick);
      clearInterval(flusher);
      for (const type of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
        window.removeEventListener(type, interact);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flush]);

  const getPosition = useCallback(() => position.current, []);

  return { readIds, currentId, jumpTo, getPosition };
}
