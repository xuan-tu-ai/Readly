import type { ReactNode } from "react";
import type { BadgeEmblem } from "@/lib/art";
import { C, INK, PAPER, WHITE } from "./palette";

/**
 * Badge emblems. Each one draws inside a 64×64 box so frames can place them;
 * flat shapes, darker edge for depth, white gloss.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

function Book({ x, y, w, h, color, dark }: { x: number; y: number; w: number; h: number; color: string; dark: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={dark} />
      <rect x={x} y={y} width={w} height={h - 3} rx={3} fill={color} />
      <rect x={x + w - 10} y={y + 2.5} width={7} height={h - 7.5} rx={1.5} fill={PAPER} />
      <rect x={x + 5} y={y} width={3} height={h - 3} fill={WHITE} opacity={0.45} />
      <rect x={x + 10} y={y} width={2} height={h - 3} fill={WHITE} opacity={0.3} />
    </g>
  );
}

function Books() {
  return (
    <g>
      <Book x={8} y={44} w={48} h={14} color={C.blue} dark={C.blueDark} />
      <Book x={13} y={30} w={42} h={14} color={C.red} dark={C.redDark} />
      <g transform="rotate(-5 30 23)">
        <Book x={7} y={16} w={46} h={14} color={C.green} dark={C.greenDark} />
      </g>
      <path d="M44 6 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill={C.yellow} />
    </g>
  );
}

const GENRE_SLICES = ["#e2557a", "#f08a3c", "#2fa866", "#7b4fe0", "#3383e0", "#5a6b88"];

function Genres() {
  const cx = 32;
  const cy = 31;
  const r = 26;
  const slice = (i: number) => {
    const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
    return `M${cx} ${cy} L${r2(cx + r * Math.cos(a0))} ${r2(cy + r * Math.sin(a0))} A${r} ${r} 0 0 1 ${r2(cx + r * Math.cos(a1))} ${r2(cy + r * Math.sin(a1))} Z`;
  };
  return (
    <g>
      <circle cx={cx} cy={cy + 3} r={r} fill={INK} opacity={0.15} />
      {GENRE_SLICES.map((color, i) => (
        <path key={color} d={slice(i)} fill={color} stroke={WHITE} strokeWidth={2} strokeLinejoin="round" />
      ))}
      <circle cx={cx} cy={cy} r={12} fill={WHITE} />
      <path d="M24 27 Q28 25 32 28 Q36 25 40 27 V37 Q36 35 32 38 Q28 35 24 37 Z" fill={C.orange} />
      <path d="M32 28 V38" stroke={C.orangeDark} strokeWidth={1.6} />
    </g>
  );
}

const FLAME = "M32 3 C37 14 51 21 51 38 C51 51 42 61 32 61 C22 61 13 51 13 38 C13 28 19 21 23 15 C24 23 27 27 31 28 C29 19 29 11 32 3 Z";
const FLAME_CORE = "M32 30 C36 37 43 41 43 48 C43 55 38 60 32 60 C26 60 21 55 21 48 C21 42 27 38 32 30 Z";

export function FlameShape({ lit = true }: { lit?: boolean }) {
  return (
    <g>
      <path d={FLAME} fill={lit ? "#e0532a" : C.grayDark} transform="translate(0 2)" />
      <path d={FLAME} fill={lit ? "#ff7a3d" : C.gray} />
      <path d={FLAME_CORE} fill={lit ? C.yellow : C.grayLight} />
      <ellipse cx={24} cy={38} rx={2.5} ry={6} fill={WHITE} opacity={0.55} transform="rotate(18 24 38)" />
    </g>
  );
}

function Gem() {
  return (
    <g>
      <polygon points="12,26 22,12 42,12 52,26 32,58" fill="#5b35a8" transform="translate(0 2)" />
      <polygon points="22,12 42,12 36,26 28,26" fill="#cbb2ff" />
      <polygon points="12,26 22,12 28,26" fill="#b18cff" />
      <polygon points="42,12 52,26 36,26" fill="#8a5ce8" />
      <polygon points="12,26 28,26 32,58" fill={C.purple} />
      <polygon points="28,26 36,26 32,58" fill="#b99bff" />
      <polygon points="36,26 52,26 32,58" fill={C.purpleDark} />
      <path d="M50 4 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4z" fill={C.yellow} />
      <path d="M24 16 L20 22" stroke={WHITE} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}

function Trophy() {
  return (
    <g>
      <g fill="none" stroke={C.yellowDark} strokeWidth={5} strokeLinecap="round">
        <path d="M18 16 H11 C9 26 14 31 20 31" />
        <path d="M46 16 H53 C55 26 50 31 44 31" />
      </g>
      <path d="M17 9 H47 V24 C47 35 40 42 32 42 C24 42 17 35 17 24 Z" fill={C.yellowDark} transform="translate(0 2)" />
      <path d="M17 9 H47 V24 C47 35 40 42 32 42 C24 42 17 35 17 24 Z" fill={C.yellow} />
      <path d="M32 9 H47 V24 C47 35 40 42 32 42 Z" fill="#ffb31f" />
      <rect x={28.5} y={42} width={7} height={7} fill={C.yellowDark} />
      <rect x={19} y={48} width={26} height={11} rx={3} fill={C.brownDark} />
      <rect x={19} y={48} width={26} height={8} rx={3} fill={C.brown} />
      <rect x={22} y={13} width={4} height={16} rx={2} fill={WHITE} opacity={0.55} />
      <path d="M32 17 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z" fill={WHITE} opacity={0.9} />
    </g>
  );
}

function Quill() {
  return (
    <g>
      <path d="M54 5 C31 9 17 26 15 51 C30 47 47 32 54 5 Z" fill={C.blueDark} transform="translate(0 2)" />
      <path d="M54 5 C31 9 17 26 15 51 C30 47 47 32 54 5 Z" fill={C.blue} />
      <path d="M54 5 C38 13 24 30 15 51 C17 30 31 10 54 5 Z" fill="#9fd0ff" />
      <path d="M54 5 C39 17 26 34 13 57" stroke={C.blueDark} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M30 30 l-6 -2 M36 24 l-6 -3 M26 38 l7 1" stroke={WHITE} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
      <path d="M14 55 L10 62 L17 58 Z" fill={INK} />
      <circle cx={22} cy={60} r={2.5} fill={INK} opacity={0.6} />
    </g>
  );
}

function Magnifier() {
  return (
    <g>
      <path d="M38 41 L42 37 L58 53 Q60 57 56 59 Z" fill={C.brownDark} transform="translate(0 2)" />
      <path d="M38 41 L42 37 L58 53 Q60 57 56 59 Z" fill={C.brown} />
      <circle cx={26} cy={28} r={20} fill={C.blueDark} />
      <circle cx={26} cy={26} r={20} fill={C.blue} />
      <circle cx={26} cy={26} r={15} fill="#d6efff" />
      <path d="M17 22 A10 10 0 0 1 26 15" stroke={WHITE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <path d="M19 31 H33 M19 36 H29" stroke={C.blue} strokeWidth={2.4} strokeLinecap="round" opacity={0.5} />
    </g>
  );
}

function Moon() {
  const crescent = "M36 6 A26 26 0 1 0 58 44 A21 21 0 1 1 36 6 Z";
  return (
    <g>
      <path d={crescent} fill={C.yellowDark} transform="translate(0 2)" />
      <path d={crescent} fill={C.yellow} />
      <circle cx={22} cy={42} r={3} fill={C.yellowDark} opacity={0.45} />
      <circle cx={16} cy={30} r={2} fill={C.yellowDark} opacity={0.45} />
      <path d="M50 8 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8z" fill="#7a84ff" />
      <path d="M56 26 l1.2 2.5 2.5 1.2 -2.5 1.2 -1.2 2.5 -1.2 -2.5 -2.5 -1.2 2.5 -1.2z" fill="#7a84ff" />
    </g>
  );
}

function Lotus() {
  return (
    <g>
      <path d="M8 52 Q32 62 56 52 Q32 57 8 52 Z" fill={C.greenDark} />
      <ellipse cx={32} cy={52} rx={22} ry={5} fill={C.green} />
      <path d="M32 47 C18 49 6 43 2 35 C14 33 26 39 32 47 Z" fill={C.pinkDark} />
      <path d="M32 47 C46 49 58 43 62 35 C50 33 38 39 32 47 Z" fill={C.pinkDark} />
      <path d="M32 47 C22 45 12 35 10 22 C20 24 28 33 32 47 Z" fill={C.pink} />
      <path d="M32 47 C42 45 52 35 54 22 C44 24 36 33 32 47 Z" fill={C.pink} />
      <path d="M32 10 C41 21 41 38 32 47 C23 38 23 21 32 10 Z" fill="#ffb3cc" />
      <path d="M32 16 C35 24 35 34 32 42" stroke={WHITE} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
    </g>
  );
}

function Scroll() {
  return (
    <g>
      <rect x={13} y={12} width={38} height={40} fill="#f2d39b" />
      <rect x={13} y={12} width={38} height={38} fill="#fbe7c0" />
      <path d="M20 22 H44 M20 28 H44 M20 34 H38" stroke="#c9a26a" strokeWidth={2.4} strokeLinecap="round" />
      <rect x={8} y={6} width={48} height={10} rx={5} fill={C.brownDark} />
      <rect x={8} y={6} width={48} height={8} rx={4} fill={C.brown} />
      <rect x={8} y={48} width={48} height={10} rx={5} fill={C.brownDark} />
      <rect x={8} y={48} width={48} height={8} rx={4} fill={C.brown} />
      <circle cx={42} cy={41} r={5.5} fill={C.red} />
      <circle cx={42} cy={41} r={2.5} fill={C.redDark} />
    </g>
  );
}

function Highlighter() {
  return (
    <g>
      <path d="M6 56 H46" stroke={C.yellow} strokeWidth={8} strokeLinecap="round" opacity={0.75} />
      <g transform="rotate(38 32 30)">
        <rect x={23} y={4} width={18} height={30} rx={4} fill={C.tealDark} transform="translate(0 2)" />
        <rect x={23} y={4} width={18} height={30} rx={4} fill={C.teal} />
        <rect x={23} y={4} width={18} height={9} rx={4} fill={C.tealDark} />
        <path d="M24 34 H40 L37 44 H27 Z" fill={INK} opacity={0.8} />
        <path d="M28 44 H36 L34.5 50 H29.5 Z" fill={C.yellow} />
        <rect x={27} y={15} width={3} height={15} rx={1.5} fill={WHITE} opacity={0.55} />
      </g>
    </g>
  );
}

function Speech() {
  return (
    <g>
      <path d="M30 6 H50 Q58 6 58 14 V26 Q58 34 50 34 H48 L52 42 L40 34 H30 Q22 34 22 26 V14 Q22 6 30 6 Z" fill={C.blue} />
      <path d="M14 22 H36 Q44 22 44 30 V42 Q44 50 36 50 H22 L12 58 L14 50 Q6 50 6 42 V30 Q6 22 14 22 Z" fill={C.greenDark} transform="translate(0 2)" />
      <path d="M14 22 H36 Q44 22 44 30 V42 Q44 50 36 50 H22 L12 58 L14 50 Q6 50 6 42 V30 Q6 22 14 22 Z" fill={C.green} />
      <circle cx={16} cy={36} r={3} fill={WHITE} />
      <circle cx={25} cy={36} r={3} fill={WHITE} />
      <circle cx={34} cy={36} r={3} fill={WHITE} />
    </g>
  );
}

export const EMBLEMS: Record<BadgeEmblem, () => ReactNode> = {
  books: Books,
  genres: Genres,
  flame: () => <FlameShape />,
  gem: Gem,
  trophy: Trophy,
  quill: Quill,
  magnifier: Magnifier,
  moon: Moon,
  lotus: Lotus,
  scroll: Scroll,
  highlighter: Highlighter,
  speech: Speech,
};

