/**
 * Vietnam-time date text with a fixed shape. Intl's vi-VN output for
 * day + month differs between ICU builds ("10-11" vs "10/11"), so the
 * teacher and assignment screens format by hand.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const shifted = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);

/** "16/11" */
export function formatDayMonth(d: Date): string {
  const s = shifted(d);
  return `${pad(s.getUTCDate())}/${pad(s.getUTCMonth() + 1)}`;
}

/** "16/11/2026" */
export function formatDate(d: Date): string {
  return `${formatDayMonth(d)}/${shifted(d).getUTCFullYear()}`;
}

/** "08:30 16/11" */
export function formatTimeDayMonth(d: Date): string {
  const s = shifted(d);
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())} ${formatDayMonth(d)}`;
}

/** "08:30 16/11/2026" */
export function formatDateTime(d: Date): string {
  return `${formatTimeDayMonth(d)}/${shifted(d).getUTCFullYear()}`;
}
