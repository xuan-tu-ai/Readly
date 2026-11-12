import { cn } from "@/lib/utils";

/** Thick rounded progress bar with a glossy highlight, Duolingo-style. */
export function ProgressBar({
  value,
  max = 100,
  label,
  className,
  tone = "bg-primary",
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
  tone?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-4 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("relative h-full rounded-full transition-[width] duration-500", tone)}
        style={{ width: `${percent}%` }}
      >
        {percent > 6 ? (
          <span className="absolute inset-x-2 top-[3px] h-[3px] rounded-full bg-white/35" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
