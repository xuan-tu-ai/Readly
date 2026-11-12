import type { AssignmentSummary } from "@/lib/teacher";
import { cn } from "@/lib/utils";

/**
 * How a class splits on one assigned work: a thin segmented bar (one block
 * per state, 2px surface gaps, hover tooltips) plus a legend that carries
 * the figures. Colours were checked with the dataviz palette validator
 * (CVD-separated; the amber block is always backed by its printed count).
 */
export const PROGRESS_PARTS = [
  { key: "onTime", label: "Xong đúng hạn", color: "#178a45" },
  { key: "late", label: "Xong trễ hạn", color: "#eda100" },
  { key: "reading", label: "Đang đọc", color: "#2a78d6" },
  { key: "notStarted", label: "Chưa đọc", color: "color-mix(in oklch, var(--muted-foreground) 30%, var(--muted))" },
] as const satisfies readonly { key: keyof AssignmentSummary; label: string; color: string }[];

const pct = (n: number, total: number) => (total > 0 ? Math.round((n * 100) / total) : 0);

export function ProgressSplit({ summary, className }: { summary: AssignmentSummary; className?: string }) {
  const parts = PROGRESS_PARTS.map((p) => ({ ...p, value: summary[p.key] })).filter((p) => p.value > 0);
  const name = PROGRESS_PARTS.map((p) => `${p.label} ${summary[p.key]}`).join(", ");
  return (
    <div
      role="img"
      aria-label={`${summary.total} học sinh: ${name}`}
      className={cn("flex h-6 items-center gap-0.5", className)}
    >
      {parts.length === 0 ? <span className="h-2 w-full rounded-full bg-muted" /> : null}
      {parts.map((p) => (
        <span key={p.key} className="group relative flex h-full items-center" style={{ flexGrow: p.value, flexBasis: 0 }}>
          <span
            className="h-2 w-full rounded-full ring-inset group-hover:ring-2 group-hover:ring-foreground/25"
            style={{ background: p.color }}
          />
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background group-hover:block">
            {p.label}: {p.value} HS ({pct(p.value, summary.total)}%)
          </span>
        </span>
      ))}
    </div>
  );
}

export function ProgressLegend({ summary, className }: { summary: AssignmentSummary; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm", className)}>
      {PROGRESS_PARTS.map((p) => (
        <li key={p.key} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.label}</span>
          <span className="font-bold tabular-nums">{summary[p.key]}</span>
        </li>
      ))}
    </ul>
  );
}
