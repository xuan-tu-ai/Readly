/**
 * Colours for the illustration library. Same flat style as Mướp: no outlines,
 * a darker "edge" under each shape for depth and a white gloss on top.
 * Hex values (not CSS variables) so the SVGs also render inside <img>, in
 * generated PNGs and in notifications.
 */
export const INK = "#2d2a36";
export const WHITE = "#ffffff";
export const CREAM = "#fff1dc";
export const PAPER = "#fff8ec";

export const C = {
  orange: "#f2a65a",
  orangeDark: "#d9823b",
  red: "#ef5a5a",
  redDark: "#c53f3f",
  yellow: "#ffc83d",
  yellowDark: "#e09b0f",
  green: "#3cbf6b",
  greenDark: "#2a9452",
  blue: "#4ea3f5",
  blueDark: "#2f7fd1",
  purple: "#9b6cf0",
  purpleDark: "#7346c9",
  pink: "#f37ea6",
  pinkDark: "#d0557f",
  teal: "#35c2b8",
  tealDark: "#21968e",
  gray: "#c9cdd6",
  grayDark: "#9aa0ad",
  grayLight: "#eceef2",
  brown: "#a8714a",
  brownDark: "#7e5233",
} as const;

export type TierColors = { face: string; light: string; edge: string; inner: string; ribbon: string; text: string };

export const TIER_COLORS: Record<"bronze" | "silver" | "gold" | "diamond" | "locked", TierColors> = {
  bronze: { face: "#d98a4e", light: "#eaa874", edge: "#a65a26", inner: "#fbe3cc", ribbon: "#b8652d", text: WHITE },
  silver: { face: "#aeb8c7", light: "#cfd6e0", edge: "#7d889b", inner: "#f3f5f9", ribbon: "#8792a5", text: WHITE },
  gold: { face: "#f7b72a", light: "#ffd45e", edge: "#c48508", inner: "#fff4cf", ribbon: "#db940b", text: WHITE },
  diamond: { face: "#47b6f0", light: "#8fdcff", edge: "#2178b8", inner: "#e2f7ff", ribbon: "#2b8fd0", text: WHITE },
  locked: { face: "#dcdfe5", light: "#e8eaee", edge: "#b8bcc6", inner: "#f4f5f7", ribbon: "#b8bcc6", text: WHITE },
};
