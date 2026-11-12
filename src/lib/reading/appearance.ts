import type { PageMode, ReadingFont, ReadingTheme } from "@/generated/prisma/enums";

/**
 * Reader appearance options shared by the settings panel (client) and the
 * settings validation (server). The visuals live in globals.css under
 * `.reader-surface[data-backdrop=…]` and `.reader-text[data-font=…]`.
 */

export const FONT_SIZES = [16, 18, 20, 22, 24] as const;
export const LINE_HEIGHTS = [1.5, 1.7, 1.9] as const;

export const THEMES: { value: ReadingTheme; label: string }[] = [
  { value: "LIGHT", label: "Sáng" },
  { value: "SEPIA", label: "Giấy" },
  { value: "DARK", label: "Tối" },
];

export const READING_FONTS: { value: ReadingFont; label: string; css: string }[] = [
  { value: "NOTO_SERIF", label: "Noto Serif", css: "var(--font-reading), Georgia, serif" },
  { value: "LORA", label: "Lora", css: "var(--font-lora), Georgia, serif" },
  { value: "BE_VIETNAM", label: "Be Vietnam Pro", css: "var(--font-sans), system-ui, sans-serif" },
];

export type Tone = "light" | "dark";

/** Decorative backgrounds ("Ảnh nền"). Each one also sets its own text colours. */
export const BACKDROPS: { id: string; label: string; tone: Tone }[] = [
  { id: "none", label: "Không", tone: "light" },
  { id: "hoa-dao", label: "Hoa đào", tone: "light" },
  { id: "tre-xanh", label: "Tre xanh", tone: "light" },
  { id: "song-bien", label: "Sóng biển", tone: "light" },
  { id: "giay-cu", label: "Giấy cũ", tone: "light" },
  { id: "dem-sao", label: "Đêm sao", tone: "dark" },
];

export const PAGE_MODES: { value: PageMode; label: string }[] = [
  { value: "SCROLL", label: "Cuộn dọc" },
  { value: "PAGED", label: "Lật trang" },
];

export type ReadingSettings = {
  fontSize: number;
  lineHeight: number;
  theme: ReadingTheme;
  font: ReadingFont;
  backdrop: string;
  pageMode: PageMode;
};

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 18,
  lineHeight: 1.7,
  theme: "LIGHT",
  font: "NOTO_SERIF",
  backdrop: "none",
  pageMode: "SCROLL",
};

/** Light or dark text treatment: a backdrop overrides the plain theme. */
export function toneOf(settings: Pick<ReadingSettings, "theme" | "backdrop">): Tone {
  const backdrop = BACKDROPS.find((b) => b.id === settings.backdrop);
  if (backdrop && backdrop.id !== "none") return backdrop.tone;
  return settings.theme === "DARK" ? "dark" : "light";
}
