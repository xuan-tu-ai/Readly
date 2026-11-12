/**
 * Reading position (segment + fraction) in both layouts.
 *
 * - Scroll mode: the window scrolls; the "reading line" is just below the
 *   sticky header, and the position is where that line crosses a segment.
 * - Paged mode: the article is laid out in CSS columns inside a box that
 *   scrolls horizontally one page (container width + column gap) at a time.
 *   A segment split across columns returns one client rect per column, so the
 *   fraction is "which of its columns is the first one on this page".
 */

export type Position = { segmentId: string; fraction: number };

export function sectionEl(segmentId: string) {
  return document.getElementById(`seg-${segmentId}`);
}

// ── Scroll mode ──

export function scrollPosition(segmentIds: string[], line: number): Position | null {
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

export function scrollToPosition(position: Position, line: number) {
  const el = sectionEl(position.segmentId);
  if (!el) return;
  const top = window.scrollY + el.getBoundingClientRect().top + position.fraction * el.offsetHeight - line + 8;
  window.scrollTo({ top: Math.max(0, top) });
}

// ── Paged mode ──

export type PageMetrics = { width: number; gap: number; step: number; count: number; current: number };

export function pageMetrics(box: HTMLElement): PageMetrics {
  const width = box.clientWidth;
  const inner = box.firstElementChild as HTMLElement | null;
  const gap = inner ? parseFloat(getComputedStyle(inner).columnGap) || 0 : 0;
  const step = width + gap;
  const count = Math.max(1, Math.round((box.scrollWidth + gap) / step));
  return { width, gap, step, count, current: Math.min(count - 1, Math.round(box.scrollLeft / step)) };
}

function fragments(el: HTMLElement) {
  return Array.from(el.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
}

export function pagedPosition(segmentIds: string[], box: HTMLElement): Position | null {
  const left = box.getBoundingClientRect().left;
  const right = left + box.clientWidth;
  for (const segmentId of segmentIds) {
    const el = sectionEl(segmentId);
    if (!el) continue;
    const rects = fragments(el);
    const index = rects.findIndex((r) => r.right > left + 1 && r.left < right - 1);
    if (index !== -1) return { segmentId, fraction: rects.length > 1 ? index / rects.length : 0 };
  }
  return null;
}

/** Page index that shows the given position. */
export function pageOf(position: Position, box: HTMLElement): number | null {
  const el = sectionEl(position.segmentId);
  if (!el) return null;
  const rects = fragments(el);
  if (rects.length === 0) return null;
  const target = rects[Math.min(rects.length - 1, Math.floor(position.fraction * rects.length))];
  const { step } = pageMetrics(box);
  const offset = target.left - box.getBoundingClientRect().left + box.scrollLeft;
  return Math.max(0, Math.floor((offset + 1) / step));
}

export function goToPage(box: HTMLElement, page: number, smooth = false) {
  const { step, count } = pageMetrics(box);
  const clamped = Math.min(count - 1, Math.max(0, page));
  box.scrollTo({ left: clamped * step, behavior: smooth ? "smooth" : "instant" });
  return clamped;
}
