/**
 * Active reading time: time only counts while the tab is visible AND the
 * student interacted (scroll, touch, key, pointer) within the last minute.
 * The clock is passed in so the logic is testable.
 */
export const IDLE_LIMIT_MS = 60_000;
/** A single tick never credits more than this (sleeping laptops, throttled timers). */
export const MAX_TICK_MS = 15_000;

export class ActiveTimeTracker {
  private lastInteraction: number;
  private lastTick: number;
  private activeAtLastTick = true;
  private pending = new Map<string, number>(); // segmentId → ms

  constructor(now: number) {
    this.lastInteraction = now;
    this.lastTick = now;
  }

  interact(now: number) {
    this.lastInteraction = now;
  }

  isActive(now: number, visible: boolean) {
    return visible && now - this.lastInteraction <= IDLE_LIMIT_MS;
  }

  /** Credits time since the previous tick to `segmentId` if the student was active. */
  tick(now: number, visible: boolean, segmentId: string | null) {
    const active = this.isActive(now, visible);
    // Coming back from idle/hidden: only the time since the student returned counts.
    const from = this.activeAtLastTick ? this.lastTick : Math.max(this.lastTick, this.lastInteraction);
    const elapsed = Math.min(Math.max(0, now - from), MAX_TICK_MS);
    this.lastTick = now;
    this.activeAtLastTick = active;
    if (!segmentId || !active) return;
    this.pending.set(segmentId, (this.pending.get(segmentId) ?? 0) + elapsed);
  }

  /** Whole seconds per segment; sub-second remainders stay for the next drain. */
  drain(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [segmentId, ms] of this.pending) {
      const seconds = Math.floor(ms / 1000);
      if (seconds > 0) out[segmentId] = seconds;
      const rest = ms - seconds * 1000;
      if (rest > 0) this.pending.set(segmentId, rest);
      else this.pending.delete(segmentId);
    }
    return out;
  }
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh, no daylight saving

/** The Vietnam calendar day of `date`, as a UTC-midnight Date (for @db.Date columns). */
export function vnDay(date: Date): Date {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}
