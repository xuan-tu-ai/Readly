import type { ReactNode } from "react";
import { AVATARS, type AvatarKey } from "@/lib/art";
import { cn } from "@/lib/utils";
import { C, INK, WHITE } from "./palette";

/**
 * Profile avatars: Mướp's head in different coats and accessories, on a
 * pastel disc. Drawn in Mướp's 200-unit head coordinates, scaled into 100×100.
 */

type Coat = {
  fur: string;
  stripes?: string;
  muzzle: string;
  ear: string;
  /** Extra coat markings, drawn over the head. */
  marks?: "calico" | "siamese" | "tuxedo";
  /** Light eye rims so dark eyes show on dark fur. */
  darkFur?: boolean;
};

type Accessory =
  | "none"
  | "glasses"
  | "scarf"
  | "flower"
  | "bow"
  | "beret"
  | "headphones"
  | "non-la"
  | "grad-cap"
  | "book"
  | "headband"
  | "pencil";

const SPEC: Record<AvatarKey, { coat: Coat; accessory: Accessory; bg: string }> = {
  muop: { coat: { fur: "#f2a65a", stripes: "#d9823b", muzzle: "#fff1dc", ear: "#f7a1a8" }, accessory: "none", bg: "#ffe9cf" },
  tro: { coat: { fur: "#a7adb8", stripes: "#7d838f", muzzle: "#eef0f3", ear: "#f3b3bb" }, accessory: "glasses", bg: "#dff1ff" },
  mun: { coat: { fur: "#34313d", muzzle: "#4a4654", ear: "#8a5a68", darkFur: true }, accessory: "scarf", bg: "#e9e2ff" },
  bong: { coat: { fur: "#f7f5f2", muzzle: "#ffffff", ear: "#f7a1a8" }, accessory: "flower", bg: "#ffe3ec" },
  "tam-the": { coat: { fur: "#fbf7f0", muzzle: "#ffffff", ear: "#f7a1a8", marks: "calico" }, accessory: "bow", bg: "#e3f6ea" },
  xiem: { coat: { fur: "#f3e6d3", muzzle: "#f3e6d3", ear: "#6b4a3a", marks: "siamese" }, accessory: "beret", bg: "#fff3c9" },
  "mi-mi": { coat: { fur: "#2f2c37", muzzle: "#ffffff", ear: "#8a5a68", marks: "tuxedo", darkFur: true }, accessory: "headphones", bg: "#ffe1d6" },
  gung: { coat: { fur: "#f7c58d", stripes: "#e9a35e", muzzle: "#fff6ea", ear: "#f7a1a8" }, accessory: "non-la", bg: "#dcf4f1" },
  khoai: { coat: { fur: "#a8794f", stripes: "#7b5534", muzzle: "#f3e2cc", ear: "#e6a3a3" }, accessory: "grad-cap", bg: "#fff0d6" },
  suong: { coat: { fur: "#8e9db5", muzzle: "#c9d3e2", ear: "#e6b0bd" }, accessory: "book", bg: "#eaf0ff" },
  dau: { coat: { fur: "#e8d3b0", stripes: "#c9a979", muzzle: "#fff8ec", ear: "#f7a1a8" }, accessory: "headband", bg: "#ffe6f0" },
  cam: { coat: { fur: "#f59b45", muzzle: "#fff1dc", ear: "#f7a1a8" }, accessory: "pencil", bg: "#e6f7d9" },
};

function Head({ coat }: { coat: Coat }) {
  return (
    <g>
      <g strokeLinejoin="round">
        <path d="M52 72 L58 24 L94 52 Z" fill={coat.fur} stroke={coat.fur} strokeWidth="8" />
        <path d="M62 62 L64 38 L82 53 Z" fill={coat.ear} />
        <path d="M148 72 L142 24 L106 52 Z" fill={coat.fur} stroke={coat.fur} strokeWidth="8" />
        <path d="M138 62 L136 38 L118 53 Z" fill={coat.ear} />
      </g>
      <ellipse cx="100" cy="84" rx="55" ry="46" fill={coat.fur} />
      {coat.marks === "calico" ? (
        <g>
          <path d="M58 52 Q76 40 92 50 Q90 70 70 74 Q52 70 58 52 Z" fill="#f2a65a" />
          <path d="M120 44 Q140 46 148 66 Q138 78 124 70 Q112 58 120 44 Z" fill="#3a3640" />
          <path d="M136 108 Q148 104 152 92 Q154 108 140 116 Z" fill="#f2a65a" />
        </g>
      ) : null}
      {coat.marks === "siamese" ? (
        <g>
          <path d="M52 72 L58 24 L94 52 Z" fill="#6b4a3a" stroke="#6b4a3a" strokeWidth="8" strokeLinejoin="round" />
          <path d="M148 72 L142 24 L106 52 Z" fill="#6b4a3a" stroke="#6b4a3a" strokeWidth="8" strokeLinejoin="round" />
          <ellipse cx="100" cy="98" rx="34" ry="26" fill="#8a6450" opacity="0.85" />
        </g>
      ) : null}
      {coat.marks === "tuxedo" ? <path d="M100 58 Q114 80 124 104 Q112 124 100 124 Q88 124 76 104 Q86 80 100 58 Z" fill="#ffffff" /> : null}
      {coat.stripes ? (
        <g stroke={coat.stripes} strokeWidth="5" strokeLinecap="round">
          <path d="M100 40 v14 M87 42 l2 11 M113 42 l-2 11" />
          <path d="M46 84 h10 M47 94 h9 M154 84 h-10 M153 94 h-9" strokeWidth="4" />
        </g>
      ) : null}
      <ellipse cx="100" cy="104" rx="23" ry="15" fill={coat.muzzle} />
      <circle cx="70" cy="101" r="7" fill="#f7a1a8" opacity={coat.darkFur ? 0.35 : 0.55} />
      <circle cx="130" cy="101" r="7" fill="#f7a1a8" opacity={coat.darkFur ? 0.35 : 0.55} />
      {coat.darkFur ? (
        <g fill="#ffd34d">
          <ellipse cx="80" cy="86" rx="10" ry="12" />
          <ellipse cx="120" cy="86" rx="10" ry="12" />
        </g>
      ) : null}
      <g>
        <ellipse cx="80" cy="86" rx="7.5" ry="9.5" fill={INK} />
        <circle cx="82.5" cy="82.5" r="2.6" fill={WHITE} />
        <ellipse cx="120" cy="86" rx="7.5" ry="9.5" fill={INK} />
        <circle cx="122.5" cy="82.5" r="2.6" fill={WHITE} />
      </g>
      <path d="M95 97.5 h10 l-5 6 z" fill="#f7a1a8" stroke="#f7a1a8" strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 104 Q100 111 93 110 M100 104 Q100 111 107 110" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <g stroke={coat.darkFur ? WHITE : INK} strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round">
        <path d="M62 100 L38 95 M62 106 L38 109 M138 100 L162 95 M138 106 L162 109" />
      </g>
    </g>
  );
}

/** Accessories in the same 200-unit head coordinates. */
const ACCESSORIES: Record<Accessory, () => ReactNode> = {
  none: () => null,
  glasses: () => (
    <g fill={WHITE} fillOpacity="0.25" stroke={INK} strokeWidth="4">
      <circle cx="80" cy="86" r="15" />
      <circle cx="120" cy="86" r="15" />
      <path d="M95 84 Q100 80 105 84" fill="none" />
      <path d="M65 82 L48 78 M135 82 L152 78" fill="none" />
    </g>
  ),
  scarf: () => (
    <g>
      <path d="M48 120 Q100 142 152 120 L152 136 Q100 158 48 136 Z" fill={C.red} />
      <path d="M62 126 v14 M82 132 v14 M118 132 v14 M138 126 v14" stroke={WHITE} strokeWidth="4" opacity="0.6" />
      <path d="M128 136 L140 170 L120 172 L114 140 Z" fill={C.redDark} />
    </g>
  ),
  flower: () => (
    <g transform="translate(146 40)">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-11" rx="7" ry="11" fill={C.pink} transform={`rotate(${a})`} />
      ))}
      <circle r="7" fill={C.yellow} />
    </g>
  ),
  bow: () => (
    <g transform="translate(62 34) rotate(-20)">
      <path d="M0 0 L-22 -12 Q-26 0 -22 12 Z" fill={C.pink} />
      <path d="M0 0 L22 -12 Q26 0 22 12 Z" fill={C.pink} />
      <circle r="6" fill={C.pinkDark} />
    </g>
  ),
  beret: () => (
    <g>
      <path d="M50 46 Q56 14 104 16 Q150 18 150 40 Q104 54 50 46 Z" fill={C.red} />
      <path d="M50 46 Q104 54 150 40 L150 46 Q104 60 50 52 Z" fill={C.redDark} />
      <rect x="96" y="6" width="8" height="12" rx="3" fill={C.redDark} />
    </g>
  ),
  headphones: () => (
    <g>
      <path d="M44 92 V76 Q44 22 100 22 Q156 22 156 76 V92" stroke={INK} strokeWidth="9" fill="none" strokeLinecap="round" />
      <rect x="32" y="74" width="22" height="34" rx="9" fill={C.blue} />
      <rect x="146" y="74" width="22" height="34" rx="9" fill={C.blue} />
      <rect x="36" y="80" width="5" height="22" rx="2.5" fill={WHITE} opacity="0.5" />
    </g>
  ),
  "non-la": () => (
    <g>
      <path d="M30 50 L100 2 L170 50 Q100 64 30 50 Z" fill="#e9c46a" />
      <path d="M100 2 L30 50 Q64 58 100 58 Z" fill="#f4d78c" />
      <path d="M100 2 L60 54 M100 2 L80 57 M100 2 L120 57 M100 2 L140 54" stroke="#c9a24a" strokeWidth="2" />
      <path d="M58 56 Q72 120 80 128 M142 56 Q128 120 120 128" stroke="#c9a24a" strokeWidth="2.5" fill="none" />
    </g>
  ),
  "grad-cap": () => (
    <g>
      <path d="M68 38 V52 Q100 64 132 52 V38 Z" fill="#2c3150" />
      <path d="M100 6 L156 30 L100 52 L44 30 Z" fill="#454c78" />
      <path d="M100 30 L144 36 V62" stroke={C.yellow} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M140 60 h9 l-1.5 12 h-6 z" fill={C.yellow} />
    </g>
  ),
  book: () => (
    <g>
      <path d="M58 150 L100 158 L142 150 L142 184 L100 192 L58 184 Z" fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 158 V192" stroke={INK} strokeWidth="2.5" />
      <path d="M58 150 L100 158 V192 L58 184 Z" fill={C.blue} opacity="0.35" />
    </g>
  ),
  headband: () => (
    <g>
      <path d="M48 64 Q100 18 152 64" stroke={C.purple} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M128 26 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5z" fill={C.yellow} />
    </g>
  ),
  pencil: () => (
    <g transform="rotate(-35 150 44)">
      <rect x="120" y="38" width="52" height="12" rx="2" fill={C.yellow} />
      <rect x="120" y="38" width="10" height="12" fill={C.pink} />
      <rect x="128" y="38" width="5" height="12" fill={C.grayDark} />
      <path d="M172 38 L184 44 L172 50 Z" fill="#f2d39b" />
      <path d="M180 42 L184 44 L180 46 Z" fill={INK} />
    </g>
  ),
};

export function CatAvatar({
  avatar,
  size = 48,
  className,
  label,
}: {
  avatar: AvatarKey;
  size?: number;
  className?: string;
  /** Accessible name; "" when the user's name is shown next to it. */
  label?: string;
}) {
  const spec = SPEC[avatar];
  const Accessory = ACCESSORIES[spec.accessory];
  const name = label ?? `Avatar ${AVATARS.find((a) => a.key === avatar)?.label ?? avatar}`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
    >
      <circle cx="50" cy="50" r="50" fill={spec.bg} />
      <path d="M22 90 Q50 72 78 90 A50 50 0 0 1 22 90 Z" fill={spec.coat.fur} />
      {spec.coat.marks === "tuxedo" ? <path d="M40 84 Q50 78 60 84 L56 99 Q50 100 44 99 Z" fill={WHITE} /> : null}
      <g transform="translate(50 54) scale(0.58) translate(-100 -84)">
        <Head coat={spec.coat} />
        <Accessory />
      </g>
    </svg>
  );
}
