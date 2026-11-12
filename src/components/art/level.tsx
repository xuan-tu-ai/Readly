import type { ReactNode } from "react";
import { LEVELS, type LevelNumber } from "@/lib/art";
import { cn } from "@/lib/utils";
import { C, INK, PAPER, WHITE } from "./palette";

/**
 * Level medallions for Tân thủ → Văn nhân. Higher levels get more ornament:
 * dotted ring, studs, laurel branches, then a star crown and light rays.
 */

const TONES: Record<LevelNumber, { face: string; light: string; edge: string; inner: string }> = {
  1: { face: C.green, light: "#6fd690", edge: C.greenDark, inner: "#e4f8ea" },
  2: { face: C.blue, light: "#86c2fb", edge: C.blueDark, inner: "#e3f1ff" },
  3: { face: C.purple, light: "#bb9cf7", edge: C.purpleDark, inner: "#efe6ff" },
  4: { face: "#f58a3a", light: "#ffb071", edge: "#c9611a", inner: "#ffeedd" },
  5: { face: "#f7b72a", light: "#ffd45e", edge: "#c48508", inner: "#fff4cf" },
};

function Sprout() {
  return (
    <g>
      <path d="M12 46 Q22 41 32 47 Q42 41 52 46 V55 Q42 50 32 56 Q22 50 12 55 Z" fill={C.orangeDark} />
      <path d="M12 44 Q22 39 32 45 Q42 39 52 44 V52 Q42 47 32 53 Q22 47 12 52 Z" fill={C.orange} />
      <path d="M32 45 V53" stroke={C.orangeDark} strokeWidth={1.6} />
      <path d="M32 46 V26" stroke={C.greenDark} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M32 34 C22 34 15 27 14 17 C25 17 32 23 32 34 Z" fill={C.green} />
      <path d="M32 29 C33 18 41 11 51 10 C51 21 43 29 32 29 Z" fill="#6fd690" />
      <path d="M20 20 Q24 22 27 27" stroke={WHITE} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.7} />
    </g>
  );
}

function OpenBook() {
  return (
    <g>
      <path d="M6 18 Q19 11 32 18 Q45 11 58 18 V54 Q45 47 32 54 Q19 47 6 54 Z" fill={C.blueDark} />
      <path d="M9 15 Q20 9 32 15 V50 Q20 44 9 50 Z" fill={WHITE} />
      <path d="M55 15 Q44 9 32 15 V50 Q44 44 55 50 Z" fill={PAPER} />
      <path d="M14 22 Q20 19 27 22 M14 28 Q20 25 27 28 M14 34 Q20 31 27 34 M37 22 Q43 19 50 22 M37 28 Q43 25 50 28" stroke={C.blue} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.55} />
      <path d="M48 2 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill={C.yellow} />
      <path d="M14 4 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1z" fill={C.yellow} />
    </g>
  );
}

function Bookworm() {
  return (
    <g>
      <rect x={8} y={44} width={48} height={14} rx={3} fill={C.purpleDark} />
      <rect x={8} y={44} width={48} height={11} rx={3} fill={C.purple} />
      <rect x={45} y={46.5} width={8} height={6} rx={1.5} fill={PAPER} />
      <circle cx={16} cy={42} r={6.5} fill={C.greenDark} />
      <circle cx={25} cy={38} r={7.5} fill={C.green} />
      <circle cx={35} cy={33} r={8.5} fill={C.green} />
      <circle cx={44} cy={23} r={12} fill="#6fd690" />
      <circle cx={39} cy={23} r={4.6} fill={WHITE} stroke={INK} strokeWidth={2} />
      <circle cx={49.5} cy={23} r={4.6} fill={WHITE} stroke={INK} strokeWidth={2} />
      <path d="M43.6 23 H44.9" stroke={INK} strokeWidth={2} />
      <circle cx={39.5} cy={23.5} r={1.8} fill={INK} />
      <circle cx={50} cy={23.5} r={1.8} fill={INK} />
      <path d="M41 30 Q44.5 32.5 48 30" stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <path d="M41 12 Q39 6 35 6 M47 12 Q49 6 53 6" stroke={C.greenDark} strokeWidth={2} strokeLinecap="round" fill="none" />
    </g>
  );
}

function GradCap() {
  return (
    <g>
      <g transform="rotate(-12 32 50)">
        <rect x={10} y={42} width={44} height={12} rx={6} fill="#e6c48e" />
        <rect x={10} y={42} width={44} height={9} rx={4.5} fill="#fbe7c0" />
        <circle cx={14} cy={47} r={4} fill={C.brown} />
        <circle cx={50} cy={47} r={4} fill={C.brown} />
        <rect x={28} y={41} width={8} height={13} fill={C.red} />
      </g>
      <path d="M18 24 V34 Q32 42 46 34 V24 Z" fill="#2c3150" />
      <path d="M32 8 L59 20 L32 32 L5 20 Z" fill="#2c3150" transform="translate(0 2)" />
      <path d="M32 8 L59 20 L32 32 L5 20 Z" fill="#454c78" />
      <path d="M32 20 L52 23 V36" stroke={C.yellow} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M49 35 h6 l-1 8 h-4 z" fill={C.yellow} />
      <circle cx={32} cy={20} r={2.6} fill={C.yellow} />
    </g>
  );
}

function Brush() {
  return (
    <g>
      <path d="M6 58 Q22 50 34 54 Q46 58 58 52" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.75} />
      <path d="M47 5 L54 12 L31 38 L25 32 Z" fill={C.redDark} transform="translate(0 1.5)" />
      <path d="M47 5 L54 12 L31 38 L25 32 Z" fill={C.red} />
      <path d="M48 7 L52 11 L44 20" stroke={WHITE} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} fill="none" />
      <path d="M24 31 L32 39 L29 42 L21 34 Z" fill={C.yellow} />
      <path d="M21 34 L29 42 Q22 52 9 56 Q13 43 21 34 Z" fill={INK} />
      <path d="M19 39 Q16 45 14 50" stroke={WHITE} strokeWidth={1.4} strokeLinecap="round" opacity={0.35} fill="none" />
    </g>
  );
}

const ART: Record<LevelNumber, () => ReactNode> = { 1: Sprout, 2: OpenBook, 3: Bookworm, 4: GradCap, 5: Brush };

/** Points along the left branch, just outside the medallion (centre 60,66, radius 44). */
const LAUREL_POINTS: [number, number][] = [
  [38, 120],
  [23, 111],
  [12, 99],
  [5, 85],
  [3, 71],
  [5, 57],
  [10, 44],
];

function Laurel({ color, dark }: { color: string; dark: string }) {
  const branch = (
    <g>
      <path
        d={`M${LAUREL_POINTS.map(([x, y]) => `${x} ${y}`).join(" L")}`}
        stroke={dark}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {LAUREL_POINTS.slice(1).map(([x, y], i) => {
        const [px, py] = LAUREL_POINTS[i];
        const angle = (Math.atan2(y - py, x - px) * 180) / Math.PI + 90;
        return (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${Math.round(angle)})`}>
            <ellipse cx={-6} cy={0} rx={3.6} ry={8} fill={color} transform="rotate(-35 -6 0)" />
            <ellipse cx={6} cy={0} rx={3.6} ry={8} fill={dark} transform="rotate(35 6 0)" />
          </g>
        );
      })}
    </g>
  );
  return (
    <g>
      {branch}
      <g transform="translate(120 0) scale(-1 1)">{branch}</g>
    </g>
  );
}

export function LevelEmblem({
  level,
  size = 96,
  className,
  label,
}: {
  level: LevelNumber;
  size?: number;
  className?: string;
  /** Accessible name; defaults to the level name, "" when shown next to it. */
  label?: string;
}) {
  const tone = TONES[level];
  const Art = ART[level];
  const name = label ?? `Cấp ${level}: ${LEVELS[level - 1].name}`;
  return (
    <svg
      viewBox="0 0 120 128"
      width={size}
      height={(size * 128) / 120}
      className={cn("shrink-0 overflow-visible", className)}
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
    >
      {level === 5 ? (
        <g opacity={0.45}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M60 66 L54 4 H66 Z" fill={C.yellow} transform={`rotate(${i * 30} 60 66)`} />
          ))}
        </g>
      ) : null}
      {level >= 4 ? <Laurel color={level === 5 ? "#ffcf4a" : "#6fd690"} dark={level === 5 ? C.yellowDark : C.greenDark} /> : null}
      <circle cx={60} cy={71} r={44} fill={tone.edge} />
      <circle cx={60} cy={66} r={44} fill={tone.face} />
      <path d="M60 22 A44 44 0 0 0 60 110 Z" fill={tone.light} />
      <circle cx={60} cy={66} r={33} fill={tone.inner} />
      {level >= 2
        ? Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={Math.round((60 + 38.5 * Math.cos(a)) * 100) / 100}
                cy={Math.round((66 + 38.5 * Math.sin(a)) * 100) / 100}
                r={level >= 3 ? 2.6 : 1.8}
                fill={WHITE}
                opacity={0.8}
              />
            );
          })
        : null}
      <path d="M26 52 Q32 34 50 27" stroke={WHITE} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.55} />
      <g transform="translate(35 41) scale(0.78)">
        <Art />
      </g>
      {level === 5 ? (
        <g transform="translate(60 18)">
          <path d="M0 -14 l4.1 8.4 9.2 1.3 -6.7 6.5 1.6 9.2 -8.2 -4.4 -8.2 4.4 1.6 -9.2 -6.7 -6.5 9.2 -1.3z" fill={C.yellowDark} transform="translate(0 2)" />
          <path d="M0 -14 l4.1 8.4 9.2 1.3 -6.7 6.5 1.6 9.2 -8.2 -4.4 -8.2 4.4 1.6 -9.2 -6.7 -6.5 9.2 -1.3z" fill={C.yellow} />
        </g>
      ) : null}
    </svg>
  );
}
