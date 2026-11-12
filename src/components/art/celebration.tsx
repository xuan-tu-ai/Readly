import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { C } from "./palette";

const CONFETTI_COLORS = [C.green, C.orange, C.blue, C.purple, C.pink, C.yellow, C.teal, C.red];

/** Deterministic pseudo-random in [0, 1) so server and client render the same pieces. */
function rand(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Confetti falling over its (relatively positioned) parent; plays once by
 * default. Hidden for `prefers-reduced-motion` (see globals.css).
 */
export function Confetti({ count = 48, loop = false, className }: { count?: number; loop?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("confetti pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {Array.from({ length: count }, (_, i) => {
        const style = {
          left: `${(rand(i, 1) * 100).toFixed(2)}%`,
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: `${6 + Math.round(rand(i, 2) * 6)}px`,
          height: `${8 + Math.round(rand(i, 3) * 8)}px`,
          borderRadius: i % 3 === 0 ? "999px" : "2px",
          animationDelay: `${(rand(i, 4) * 0.8).toFixed(2)}s`,
          animationDuration: `${(1.8 + rand(i, 5) * 1.6).toFixed(2)}s`,
          animationIterationCount: loop ? "infinite" : 1,
          "--drift": `${Math.round((rand(i, 6) - 0.5) * 160)}px`,
          "--spin": `${Math.round(360 + rand(i, 7) * 720)}deg`,
        } as CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}

/** Slowly turning light rays behind a reward (level up, new badge). */
export function Sunburst({
  size = 240,
  color = C.yellow,
  className,
  children,
}: {
  size?: number;
  color?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="sunburst absolute inset-0 size-full" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d="M100 100 L92 0 H108 Z" fill={color} opacity={i % 2 ? 0.25 : 0.45} transform={`rotate(${i * 22.5} 100 100)`} />
        ))}
        <circle cx={100} cy={100} r={52} fill={color} opacity={0.25} />
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}
