import type { BadgeEmblem, BadgeTier } from "@/lib/art";
import { cn } from "@/lib/utils";
import { EMBLEMS } from "./emblems";
import { TIER_COLORS, WHITE } from "./palette";

const CREST = "M22 6 H98 Q114 6 114 22 V68 Q114 98 60 128 Q6 98 6 68 V22 Q6 6 22 6 Z";
const CREST_LEFT = "M22 6 H60 V128 Q6 98 6 68 V22 Q6 6 22 6 Z";

type Props = {
  emblem: BadgeEmblem;
  tier: BadgeTier;
  /** Not earned yet: grey frame, faded emblem and a lock. */
  locked?: boolean;
  /** Short ribbon text, e.g. "7 NGÀY" (about 10 characters max). */
  caption?: string;
  size?: number;
  className?: string;
  /** Accessible name; "" when a visible label sits next to the badge. */
  label?: string;
};

/**
 * Achievement badge: a two-tone crest whose colour shows the tier (đồng, bạc,
 * vàng, kim cương), the emblem in the middle and an optional ribbon. One
 * emblem + several tiers makes a series (e.g. streak 3 / 7 / 30 ngày).
 */
export function BadgeArt({ emblem, tier, locked = false, caption, size = 96, className, label }: Props) {
  const t = TIER_COLORS[locked ? "locked" : tier];
  const Emblem = EMBLEMS[emblem];
  const decorative = label === "";
  return (
    <svg
      viewBox="0 0 120 136"
      width={size}
      height={(size * 136) / 120}
      className={cn("shrink-0 overflow-visible", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <path d={CREST} fill={t.edge} transform="translate(0 6)" />
      <path d={CREST} fill={t.face} />
      <path d={CREST_LEFT} fill={t.light} />
      <path d={CREST} fill={t.inner} transform="translate(60 62) scale(0.76) translate(-60 -62)" />
      <path d="M17 30 Q19 16 34 14" stroke={WHITE} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.6} />
      <g
        transform="translate(29.6 28) scale(0.95)"
        opacity={locked ? 0.35 : 1}
        style={locked ? { filter: "grayscale(1)" } : undefined}
      >
        <Emblem />
      </g>
      {caption ? (
        <g>
          <path d="M10 104 L20 104 L20 124 L10 124 L15 114 Z" fill={t.edge} />
          <path d="M110 104 L100 104 L100 124 L110 124 L105 114 Z" fill={t.edge} />
          <rect x={18} y={100} width={84} height={22} rx={4} fill={t.ribbon} />
          <text
            x={60}
            y={115.5}
            textAnchor="middle"
            fontSize={11.5}
            fontWeight={800}
            letterSpacing={0.6}
            fill={t.text}
            fontFamily="var(--font-sans), system-ui, sans-serif"
          >
            {caption}
          </text>
        </g>
      ) : null}
      {locked ? (
        <g transform="translate(92 96)">
          <circle r={13} fill={t.edge} />
          <rect x={-6.5} y={-2} width={13} height={10} rx={2} fill={WHITE} />
          <path d="M-4 -2 V-5 A4 4 0 0 1 4 -5 V-2" stroke={WHITE} strokeWidth={2.6} fill="none" />
        </g>
      ) : null}
    </svg>
  );
}
