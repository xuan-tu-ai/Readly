import type { CSSProperties } from "react";
import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import boy from "./art/boy.webp";
import bookWings from "./art/book-wings.webp";
import books from "./art/books.webp";
import flame from "./art/flame.webp";
import girlAodai from "./art/girl-aodai.webp";
import girlPhone from "./art/girl-phone.webp";
import heart from "./art/heart.webp";
import medal from "./art/medal.webp";
import muopJump from "./art/muop-jump.webp";
import muopPhone from "./art/muop-phone.webp";
import trophy from "./art/trophy.webp";

/**
 * One piece of art on the square stage. x / y / w are % of the stage width;
 * d = pop-in delay (s); bob = sway period (s); r0 → r1 = sway angle; dy = rise.
 */
type Layer = { src: StaticImageData; x: number; y: number; w: number; d: number; bob?: number; r0?: number; r1?: number; dy?: number };

/** Scene A: Mướp and friends reading together. */
const CLUSTER: Layer[] = [
  { src: flame, x: 6, y: 5, w: 17, d: 0.3, bob: 2.6, r0: -6, r1: 6, dy: -8 },
  { src: medal, x: 49, y: 0, w: 10, d: 0.4, bob: 3, r0: -10, r1: 8 },
  { src: girlAodai, x: 64, y: 2, w: 31, d: 0.15, bob: 4.2, r0: -3, r1: 2, dy: -5 },
  { src: boy, x: 3, y: 29, w: 25, d: 0.2, bob: 3.1, r0: -4, r1: 3, dy: -6 },
  { src: muopJump, x: 27, y: 12, w: 47, d: 0, bob: 2.4, r0: -2, r1: 2, dy: -5 },
  { src: girlPhone, x: 70, y: 49, w: 24, d: 0.25, bob: 3.6, r0: 3, r1: -2, dy: -5 },
  { src: trophy, x: 12, y: 73, w: 18, d: 0.35, bob: 2.9, r0: -5, r1: 5 },
  { src: books, x: 39, y: 72, w: 25, d: 0.1, bob: 3.8, r0: -2, r1: 2, dy: -3 },
];

/** Scene B: Mướp climbing out of a phone, hinting at installing the app. */
const PHONE: Layer[] = [
  { src: muopPhone, x: 20, y: 7, w: 60, d: 0, bob: 3.2, r0: -4, r1: 3, dy: -3 },
  { src: heart, x: 3, y: 16, w: 19, d: 0.2, bob: 2.7, r0: -8, r1: 6, dy: -10 },
  { src: bookWings, x: 71, y: 8, w: 26, d: 0.3, bob: 2.2, r0: 6, r1: -6, dy: -12 },
  { src: medal, x: 7, y: 60, w: 13, d: 0.4, bob: 3.4, r0: -10, r1: 10 },
  { src: flame, x: 78, y: 62, w: 16, d: 0.25, bob: 2.5, r0: -6, r1: 6, dy: -8 },
];

/** Stage size: up to 20rem on phones, up to 28rem beside the text on computers. */
const STAGE_PX = { phone: 320, desktop: 448 };

/**
 * Animated hero (CSS only, see "Landing hero" in globals.css): each layer pops
 * in, sways on its own, then the scene swaps every 6 s, Duolingo-style.
 * Under reduced motion only scene A shows, standing still.
 */
export function HeroArt({ className }: { className?: string }) {
  return (
    <div role="img" aria-label="Mèo Mướp cùng các bạn học sinh đọc sách" className={cn("relative aspect-square", className)}>
      {CLUSTER.map((layer, i) => (
        <LayerImage key={`a${i}`} layer={layer} scene="a" eager />
      ))}
      {PHONE.map((layer, i) => (
        <LayerImage key={`b${i}`} layer={layer} scene="b" />
      ))}
    </div>
  );
}

function LayerImage({ layer, scene, eager = false }: { layer: Layer; scene: "a" | "b"; eager?: boolean }) {
  const { src, x, y, w, d, bob, r0, r1, dy } = layer;
  const style = {
    left: `${x}%`,
    top: `${y}%`,
    width: `${w}%`,
    "--d": `${d}s`,
    ...(bob ? { "--bob": `${bob}s` } : {}),
    ...(r0 !== undefined ? { "--r0": `${r0}deg` } : {}),
    ...(r1 !== undefined ? { "--r1": `${r1}deg` } : {}),
    ...(dy !== undefined ? { "--dy": `${dy}%` } : {}),
  } as CSSProperties;
  return (
    <Image
      src={src}
      alt=""
      sizes={`(min-width: 768px) ${Math.round((STAGE_PX.desktop * w) / 100)}px, ${Math.round((STAGE_PX.phone * w) / 100)}px`}
      loading={eager ? "eager" : "lazy"}
      className={cn("hero-layer h-auto select-none", scene === "a" ? "hero-a" : "hero-b")}
      style={style}
      draggable={false}
    />
  );
}
