import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FlameShape } from "./emblems";
import { C, INK, PAPER, WHITE } from "./palette";

/**
 * Small gamification icons (64×64): streak, points, ranks, ratings and the
 * two mini game types. Same flat style as the badges.
 */

type IconProps = { size?: number; className?: string; label?: string };

function Icon({ size = 32, className, label, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0 overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

/** Streak flame; `lit={false}` for a day without reading or a broken streak. */
export function StreakFlame({ lit = true, ...props }: IconProps & { lit?: boolean }) {
  return (
    <Icon {...props}>
      <FlameShape lit={lit} />
    </Icon>
  );
}

const HEX = "M32 4 L56 18 V46 L32 60 L8 46 V18 Z";

/** Points (XP): a lightning bolt in a hexagon. */
export function XpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={HEX} fill={C.yellowDark} transform="translate(0 3)" />
      <path d={HEX} fill={C.yellow} />
      <path d="M32 4 L8 18 V46 L32 60 Z" fill="#ffd56b" />
      <path d="M36 12 L20 36 H31 L27 52 L44 26 H33 Z" fill={WHITE} />
      <path d="M36 12 L20 36 H31 L27 52 L44 26 H33 Z" fill="#ff9f1a" opacity={0.25} transform="translate(1.5 1.5)" />
    </Icon>
  );
}

const MEDAL: Record<1 | 2 | 3, { face: string; light: string; edge: string; ribbon: [string, string] }> = {
  1: { face: "#f7b72a", light: "#ffd45e", edge: "#c48508", ribbon: [C.blue, C.blueDark] },
  2: { face: "#aeb8c7", light: "#cfd6e0", edge: "#7d889b", ribbon: [C.red, C.redDark] },
  3: { face: "#d98a4e", light: "#eaa874", edge: "#a65a26", ribbon: [C.green, C.greenDark] },
};

/** Podium medal for leaderboard places 1–3. */
export function RankMedal({ rank, ...props }: IconProps & { rank: 1 | 2 | 3 }) {
  const m = MEDAL[rank];
  return (
    <Icon {...props}>
      <path d="M18 2 H30 L36 26 H24 Z" fill={m.ribbon[1]} />
      <path d="M46 2 H34 L28 26 H40 Z" fill={m.ribbon[0]} />
      <circle cx={32} cy={42} r={19} fill={m.edge} />
      <circle cx={32} cy={40} r={19} fill={m.face} />
      <path d="M32 21 A19 19 0 0 0 32 59 Z" fill={m.light} />
      <circle cx={32} cy={40} r={13} fill={m.light} stroke={m.edge} strokeWidth={2} strokeOpacity={0.4} />
      <text
        x={32}
        y={46}
        textAnchor="middle"
        fontSize={17}
        fontWeight={800}
        fill={m.edge}
        fontFamily="var(--font-sans), system-ui, sans-serif"
      >
        {rank}
      </text>
    </Icon>
  );
}

/** Crown for the weekly leader. */
export function CrownIcon(props: IconProps) {
  const crown = "M6 22 L19 34 L32 12 L45 34 L58 22 L52 50 H12 Z";
  return (
    <Icon {...props}>
      <path d={crown} fill={C.yellowDark} transform="translate(0 3)" />
      <path d={crown} fill={C.yellow} />
      <path d="M6 22 L19 34 L32 12 V50 H12 Z" fill="#ffd56b" />
      <rect x={12} y={46} width={40} height={8} rx={3} fill={C.yellowDark} />
      <circle cx={32} cy={36} r={5} fill={C.red} />
      <circle cx={20} cy={42} r={3.4} fill={C.blue} />
      <circle cx={44} cy={42} r={3.4} fill={C.green} />
      <circle cx={6} cy={22} r={4} fill={C.yellow} />
      <circle cx={32} cy={11} r={4} fill={C.yellow} />
      <circle cx={58} cy={22} r={4} fill={C.yellow} />
    </Icon>
  );
}

const STAR = "M32 5 L40 22 L58 24.5 L44.5 37 L48 55 L32 46 L16 55 L19.5 37 L6 24.5 L24 22 Z";

/** Rating star (mini game result: 1–3 stars). */
export function StarIcon({ filled = true, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path d={STAR} fill={filled ? C.yellowDark : C.grayDark} transform="translate(0 3)" strokeLinejoin="round" />
      <path d={STAR} fill={filled ? C.yellow : C.gray} stroke={filled ? C.yellow : C.gray} strokeWidth={3} strokeLinejoin="round" />
      {filled ? <path d="M24 24 L28 17" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.7} /> : null}
    </Icon>
  );
}

/** Mini game "Ghép nhân vật – sự kiện": two cards joined by a link. */
export function MatchGameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(-8 18 30)">
        <rect x={4} y={14} width={26} height={34} rx={5} fill={C.purpleDark} transform="translate(0 2)" />
        <rect x={4} y={14} width={26} height={34} rx={5} fill={C.purple} />
        <circle cx={17} cy={26} r={5} fill={WHITE} />
        <path d="M9 41 Q17 31 25 41 Z" fill={WHITE} />
      </g>
      <g transform="rotate(8 46 30)">
        <rect x={34} y={14} width={26} height={34} rx={5} fill={C.orangeDark} transform="translate(0 2)" />
        <rect x={34} y={14} width={26} height={34} rx={5} fill={C.orange} />
        <path d="M49 20 L41 33 H47 L44 43 L53 29 H47 Z" fill={WHITE} />
      </g>
      <path d="M24 31 H40" stroke={INK} strokeWidth={3} strokeDasharray="3 3" strokeLinecap="round" />
      <circle cx={24} cy={31} r={3.5} fill={C.green} stroke={WHITE} strokeWidth={1.5} />
      <circle cx={40} cy={31} r={3.5} fill={C.green} stroke={WHITE} strokeWidth={1.5} />
    </Icon>
  );
}

/** Mini game "Đoán chi tiết": a page under a magnifying glass. */
export function DetailGameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={6} y={6} width={36} height={46} rx={5} fill="#e6dccb" transform="translate(0 2)" />
      <rect x={6} y={6} width={36} height={46} rx={5} fill={PAPER} />
      <path d="M13 16 H35 M13 23 H35 M13 30 H27 M13 37 H24" stroke={C.grayDark} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M44 46 L48 42 L60 54 Q61 58 57 59 Z" fill={C.brown} />
      <circle cx={38} cy={38} r={15} fill={C.blueDark} />
      <circle cx={38} cy={36} r={15} fill={C.blue} />
      <circle cx={38} cy={36} r={11} fill="#d6efff" />
      <text
        x={38}
        y={42}
        textAnchor="middle"
        fontSize={16}
        fontWeight={800}
        fill={C.blueDark}
        fontFamily="var(--font-sans), system-ui, sans-serif"
      >
        ?
      </text>
    </Icon>
  );
}

/** Padlock for content that is not open yet (e.g. a mini game before its segment). */
export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 28 V20 A12 12 0 0 1 44 20 V28" stroke={C.grayDark} strokeWidth={6} fill="none" />
      <rect x={12} y={28} width={40} height={30} rx={7} fill={C.grayDark} transform="translate(0 2)" />
      <rect x={12} y={28} width={40} height={30} rx={7} fill={C.gray} />
      <path d="M12 35 A7 7 0 0 1 19 28 H32 V58 H19 A7 7 0 0 1 12 51 Z" fill="#d9dce3" />
      <circle cx={32} cy={41} r={4.5} fill={INK} opacity={0.6} />
      <rect x={30} y={42} width={4} height={8} rx={2} fill={INK} opacity={0.6} />
    </Icon>
  );
}

/** Treasure chest: a reward waiting (e.g. finishing a work, a new record). */
export function ChestIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={6} y={30} width={52} height={26} rx={4} fill={C.brownDark} transform="translate(0 2)" />
      <rect x={6} y={30} width={52} height={26} rx={4} fill={C.brown} />
      <path d="M6 30 V24 Q6 10 32 10 Q58 10 58 24 V30 Z" fill="#c48a5c" />
      <rect x={6} y={28} width={52} height={6} fill={C.yellowDark} />
      <rect x={14} y={10} width={6} height={46} fill={C.yellow} opacity={0.9} />
      <rect x={44} y={10} width={6} height={46} fill={C.yellow} opacity={0.9} />
      <rect x={27} y={26} width={10} height={14} rx={2} fill={C.yellow} />
      <circle cx={32} cy={32} r={2} fill={C.brownDark} />
    </Icon>
  );
}
