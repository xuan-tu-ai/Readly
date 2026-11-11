"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ActiveTimeTracker } from "@/lib/reading/active-time";

const TRACK_URL = "/api/reading/track";
const TICK_MS = 5_000;
const FLUSH_MS = 20_000;
const SCROLL_IDLE_MS = 3_000;

type Position = { segmentId: string; fraction: number };

type Options = {
  segmentIds: string[];
  initialRead: string[];
  initialPosition: Position | null;
  /** Element whose bottom edge is the "reading line" (the sticky reader header). */
  headerRef: RefObject<HTMLElement | null>;
};

function readingLine(headerRef: RefObject<HTMLElement | null>) {
  return (headerRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
}

function sectionEl(segmentId: string) {
  return document.getElementById(`seg-${segmentId}`);
}

/** Which segment the reading line is in, and how far into it. */
function currentPosition(segmentIds: string[], line: number): Position | null {
  let found: Position | null = null;
  for (const segmentId of segmentIds) {
    const el = sectionEl(segmentId);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top <= line || found === null) {
      const fraction = rect.height > 0 ? (line - rect.top) / rect.height : 0;
      found = { segmentId, fraction: Math.min(1, Math.max(0, fraction)) };
    }
    if (rect.top > line) break;
  }
  return found;
}

export function scrollToSegment(segmentId: string, fraction: number, headerRef: RefObject<HTMLElement | null>) {
  const el = sectionEl(segmentId);
  if (!el) return;
  const top = window.scrollY + el.getBoundingClientRect().top + fraction * el.offsetHeight - readingLine(headerRef) + 8;
  window.scrollTo({ top: Math.max(0, top) });
}

/**
 * Tracks reading on the client and reports it to the server:
 * - a segment is "read" once its end sentinel has been on screen;
 * - the position (segment + fraction) is saved after scrolling stops;
 * - active time is credited to the current segment (see ActiveTimeTracker).
 * The last batch is sent with sendBeacon when the page is hidden or left.
 */
export function useReadingTracker({ segmentIds, initialRead, initialPosition, headerRef }: Options) {
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

  // Restore the saved position once the text has laid out.
  useEffect(() => {
    if (window.location.hash || !initialPosition) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => scrollToSegment(initialPosition.segmentId, initialPosition.fraction, headerRef)),
    );
    return () => cancelAnimationFrame(id);
  }, [initialPosition, headerRef]);

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

  // Scroll position, activity and periodic flushes.
  useEffect(() => {
    tracker.current = new ActiveTimeTracker(Date.now());
    let frame = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const interact = () => tracker.current?.interact(Date.now());
    const onScroll = () => {
      interact();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pos = currentPosition(segmentIds, readingLine(headerRef));
        if (!pos) return;
        position.current = pos;
        positionDirty.current = true;
        setCurrentId(pos.segmentId);
      });
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => flush(false), SCROLL_IDLE_MS);
    };
    const visible = () => document.visibilityState === "visible";
    const onVisibility = () => {
      if (!visible()) flush(true);
      else interact();
    };
    const onPageHide = () => flush(true);

    const tick = setInterval(() => tracker.current?.tick(Date.now(), visible(), position.current?.segmentId ?? null), TICK_MS);
    const flusher = setInterval(() => flush(false), FLUSH_MS);

    window.addEventListener("scroll", onScroll, { passive: true });
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
      clearTimeout(idleTimer);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      for (const type of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
        window.removeEventListener(type, interact);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [segmentIds, headerRef, flush]);

  return { readIds, currentId };
}
