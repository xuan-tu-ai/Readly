import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Mướp – Readly's tabby cat. Hand-drawn SVG split into parts (head, eyes,
 * tail, arms) so CSS can animate each one; see the "Mascot" block in
 * globals.css. Animations stop under `prefers-reduced-motion`.
 */
export type MascotPose = "idle" | "wave" | "think" | "cheer" | "sad" | "sleep" | "read";

const FUR = "#f2a65a";
const FUR_DARK = "#d9823b";
const CREAM = "#fff1dc";
const PINK = "#f7a1a8";
const INK = "#2d2a36";

type Props = {
  pose?: MascotPose;
  size?: number;
  className?: string;
  /** Accessible name; pass "" when the mascot is purely decorative next to text. */
  label?: string;
};

export function Mascot({ pose = "idle", size = 120, className, label = "Mèo Mướp" }: Props) {
  const decorative = label === "";
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      data-pose={pose}
      className={cn("mascot shrink-0 overflow-visible", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <Tail />
      <g className="m-body">
        <path d="M58 190 C50 150 70 116 100 116 C130 116 150 150 142 190 Z" fill={FUR} />
        <ellipse cx="100" cy="166" rx="27" ry="23" fill={CREAM} />
        <path d="M60 150 q8 4 6 12 M140 150 q-8 4 -6 12" stroke={FUR_DARK} strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="78" cy="190" rx="17" ry="9" fill={FUR} />
        <ellipse cx="122" cy="190" rx="17" ry="9" fill={FUR} />
        <path d="M74 186 v6 M82 186 v6 M118 186 v6 M126 186 v6" stroke={FUR_DARK} strokeWidth="2" strokeLinecap="round" />
      </g>
      <Arms pose={pose} />
      <g className="m-head">
        <Ears />
        <ellipse cx="100" cy="84" rx="55" ry="46" fill={FUR} />
        <path d="M100 40 v14 M87 42 l2 11 M113 42 l-2 11" stroke={FUR_DARK} strokeWidth="5" strokeLinecap="round" />
        <path d="M46 84 h10 M47 94 h9 M154 84 h-10 M153 94 h-9" stroke={FUR_DARK} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="100" cy="104" rx="23" ry="15" fill={CREAM} />
        <circle cx="70" cy="101" r="7" fill={PINK} opacity="0.55" />
        <circle cx="130" cy="101" r="7" fill={PINK} opacity="0.55" />
        <Eyes pose={pose} />
        <path d="M95 97.5 h10 l-5 6 z" fill={PINK} stroke={PINK} strokeWidth="2" strokeLinejoin="round" />
        <Mouth pose={pose} />
        <g stroke={INK} strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round">
          <path d="M62 100 L38 95 M62 106 L38 109 M138 100 L162 95 M138 106 L162 109" />
        </g>
      </g>
      <RaisedArms pose={pose} />
      <Extras pose={pose} />
    </svg>
  );
}

function Tail() {
  return (
    <g className="m-tail">
      <path
        d="M134 176 C168 180 186 154 176 128 C171 116 157 118 161 130 C168 148 160 162 132 162 Z"
        fill={FUR}
      />
      <path d="M170 136 l8 -3 M168 150 l9 2" stroke={FUR_DARK} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Ears() {
  return (
    <g strokeLinejoin="round">
      <path d="M52 72 L58 24 L94 52 Z" fill={FUR} stroke={FUR} strokeWidth="8" />
      <path d="M62 62 L64 38 L82 53 Z" fill={PINK} />
      <path d="M148 72 L142 24 L106 52 Z" fill={FUR} stroke={FUR} strokeWidth="8" />
      <path d="M138 62 L136 38 L118 53 Z" fill={PINK} />
    </g>
  );
}

function Eye({ cx, cy, rx = 7.5, ry = 9.5 }: { cx: number; cy: number; rx?: number; ry?: number }) {
  return (
    <g className="m-eye">
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} />
      <circle cx={cx + 2.5} cy={cy - 3.5} r="2.6" fill="#fff" />
    </g>
  );
}

function Eyes({ pose }: { pose: MascotPose }) {
  const arc = (d: string) => <path d={d} stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />;
  switch (pose) {
    case "cheer":
      return (
        <>
          {arc("M71 88 Q80 77 89 88")}
          {arc("M111 88 Q120 77 129 88")}
        </>
      );
    case "sleep":
      return (
        <>
          {arc("M71 86 Q80 93 89 86")}
          {arc("M111 86 Q120 93 129 86")}
        </>
      );
    case "sad":
      return (
        <>
          <Eye cx={80} cy={88} rx={6.5} ry={8} />
          <Eye cx={120} cy={88} rx={6.5} ry={8} />
          <path d="M69 76 L87 71 M131 76 L113 71" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </>
      );
    case "think":
      return (
        <>
          <Eye cx={83} cy={82} />
          <Eye cx={123} cy={82} />
        </>
      );
    case "read":
      return (
        <>
          <Eye cx={80} cy={91} ry={7.5} />
          <Eye cx={120} cy={91} ry={7.5} />
        </>
      );
    default:
      return (
        <>
          <Eye cx={80} cy={86} />
          <Eye cx={120} cy={86} />
        </>
      );
  }
}

function Mouth({ pose }: { pose: MascotPose }) {
  if (pose === "cheer" || pose === "wave") {
    return <path d="M92 106 Q100 120 108 106 Z" fill="#b5485a" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />;
  }
  if (pose === "sad") {
    return <path d="M93 113 Q100 106 107 113" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />;
  }
  return (
    <path
      d="M100 104 Q100 111 93 110 M100 104 Q100 111 107 110"
      stroke={INK}
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Paw({ cx, cy, rotate = 0, className }: { cx: number; cy: number; rotate?: number; className?: string }) {
  return (
    <g className={className}>
      <ellipse cx={cx} cy={cy} rx="10" ry="16" fill={FUR} transform={`rotate(${rotate} ${cx} ${cy})`} />
    </g>
  );
}

function Arms({ pose }: { pose: MascotPose }) {
  switch (pose) {
    case "wave":
    case "think":
      return <Paw cx={76} cy={160} rotate={15} />;
    case "cheer":
      return null;
    case "read":
      return (
        <g>
          <path d="M64 150 L100 158 L136 150 L136 184 L100 192 L64 184 Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M100 158 V192" stroke={INK} strokeWidth="2.5" />
          <path d="M72 162 l20 4 M72 170 l20 4 M108 166 l20 -4 M108 174 l20 -4" stroke={INK} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="64" cy="166" rx="9" ry="11" fill={FUR} />
          <ellipse cx="136" cy="166" rx="9" ry="11" fill={FUR} />
        </g>
      );
    default:
      return (
        <>
          <Paw cx={76} cy={160} rotate={15} />
          <Paw cx={124} cy={160} rotate={-15} />
        </>
      );
  }
}

/** Arms drawn in front of the head (waving, cheering, paw on chin). */
function RaisedArms({ pose }: { pose: MascotPose }) {
  switch (pose) {
    case "wave":
      return (
        <g className="m-arm m-arm-wave">
          <ellipse cx="150" cy="118" rx="11" ry="21" fill={FUR} stroke={FUR_DARK} strokeWidth="2" transform="rotate(-20 150 118)" />
          <ellipse cx="155" cy="100" rx="9" ry="8" fill={CREAM} />
        </g>
      );
    case "cheer":
      return (
        <g>
          <ellipse cx="44" cy="108" rx="11" ry="21" fill={FUR} stroke={FUR_DARK} strokeWidth="2" transform="rotate(30 44 108)" />
          <ellipse cx="156" cy="108" rx="11" ry="21" fill={FUR} stroke={FUR_DARK} strokeWidth="2" transform="rotate(-30 156 108)" />
          <circle cx="36" cy="92" r="8" fill={CREAM} />
          <circle cx="164" cy="92" r="8" fill={CREAM} />
        </g>
      );
    case "think":
      return (
        <g>
          <ellipse cx="128" cy="134" rx="11" ry="22" fill={FUR} stroke={FUR_DARK} strokeWidth="2" transform="rotate(-25 128 134)" />
          <ellipse cx="118" cy="118" rx="10" ry="9" fill={CREAM} stroke={FUR_DARK} strokeWidth="2" />
        </g>
      );
    default:
      return null;
  }
}

function Sparkle({ x, y, s = 1, color = "#ffc83d" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      d={`M${x} ${y - 10 * s} Q${x + 2 * s} ${y - 2 * s} ${x + 10 * s} ${y} Q${x + 2 * s} ${y + 2 * s} ${x} ${y + 10 * s} Q${x - 2 * s} ${y + 2 * s} ${x - 10 * s} ${y} Q${x - 2 * s} ${y - 2 * s} ${x} ${y - 10 * s} Z`}
      fill={color}
    />
  );
}

function Extras({ pose }: { pose: MascotPose }) {
  let content: ReactNode = null;
  switch (pose) {
    case "think":
      content = (
        <g fill="#cfd3dc">
          <circle cx="158" cy="44" r="4" />
          <circle cx="170" cy="30" r="6" />
          <circle cx="186" cy="12" r="9" />
        </g>
      );
      break;
    case "sleep":
      content = (
        <g fill={INK} fillOpacity="0.55" fontWeight="800" fontFamily="system-ui, sans-serif">
          <text x="148" y="46" fontSize="18">z</text>
          <text x="164" y="28" fontSize="24">Z</text>
        </g>
      );
      break;
    case "cheer":
      content = (
        <>
          <Sparkle x={26} y={50} />
          <Sparkle x={176} y={42} s={0.8} color="#7ad38c" />
          <Sparkle x={160} y={12} s={0.6} color="#f7a1a8" />
        </>
      );
      break;
    case "sad":
      content = <path d="M88 96 q4 7 0 10 q-4 -3 0 -10 z" fill="#8cc8f0" />;
      break;
    default:
      return null;
  }
  return <g className="m-float">{content}</g>;
}

/** The mascot with a speech bubble beside it. */
export function MascotSays({
  pose = "idle",
  size = 96,
  children,
  className,
}: {
  pose?: MascotPose;
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <Mascot pose={pose} size={size} label="" />
      <div className="relative mb-4 rounded-2xl border-2 bg-card px-4 py-3 text-sm font-medium shadow-[0_3px_0_var(--border)] before:absolute before:bottom-4 before:-left-[9px] before:size-4 before:rotate-45 before:border-b-2 before:border-l-2 before:bg-card">
        {children}
      </div>
    </div>
  );
}
