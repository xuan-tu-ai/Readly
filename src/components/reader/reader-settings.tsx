"use client";

import { AlignJustify, BookOpenText, Check, Minus, Plus, Type } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BACKDROPS,
  FONT_SIZES,
  LINE_HEIGHTS,
  PAGE_MODES,
  READING_FONTS,
  THEMES,
  type ReadingSettings,
} from "@/lib/reading/appearance";
import { cn } from "@/lib/utils";

export type ReaderSettingsValue = ReadingSettings;

const LINE_HEIGHT_LABEL: Record<number, string> = { 1.5: "Hẹp", 1.7: "Vừa", 1.9: "Rộng" };

const THEME_SWATCH: Record<string, string> = {
  LIGHT: "bg-white",
  SEPIA: "bg-[#f6eedc]",
  DARK: "bg-[#1d1c1a]",
};

/** Waka-style display panel: colours, backgrounds, layout, size and typeface. */
export function ReaderSettings({
  value,
  onChange,
}: {
  value: ReaderSettingsValue;
  onChange: (next: ReaderSettingsValue) => void;
}) {
  const set = (patch: Partial<ReaderSettingsValue>) => onChange({ ...value, ...patch });
  const sizeIndex = (FONT_SIZES as readonly number[]).indexOf(value.fontSize);

  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label="Tùy chỉnh hiển thị">
        <Type /> <span className="hidden sm:inline">Hiển thị</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[min(80dvh,40rem)] w-80 gap-5 overflow-y-auto rounded-2xl border-2 p-4">
        <Group title="Nền">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const active = value.backdrop === "none" && value.theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ theme: t.value, backdrop: "none" })}
                  className={cn(
                    "h-10 rounded-xl border-2 text-xs font-bold",
                    THEME_SWATCH[t.value],
                    t.value === "DARK" ? "text-white" : "text-neutral-800",
                    active && "ring-3 ring-primary ring-offset-2 ring-offset-popover",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Ảnh nền">
          <div className="grid grid-cols-3 gap-2">
            {BACKDROPS.filter((b) => b.id !== "none").map((b) => {
              const active = value.backdrop === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ backdrop: b.id })}
                  className={cn(
                    "reader-surface relative grid h-14 place-items-end overflow-hidden rounded-xl border-2 p-1.5 text-left text-[0.7rem] font-bold [background-size:auto,cover]",
                    active && "ring-3 ring-primary ring-offset-2 ring-offset-popover",
                  )}
                  data-backdrop={b.id}
                >
                  {active ? (
                    <Check className="absolute top-1.5 right-1.5 size-4 rounded-full bg-primary p-0.5 text-white" aria-hidden />
                  ) : null}
                  {b.label}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Dàn trang">
          <div className="grid grid-cols-2 gap-2">
            {PAGE_MODES.map((m) => {
              const Icon = m.value === "SCROLL" ? AlignJustify : BookOpenText;
              return (
                <Button
                  key={m.value}
                  size="sm"
                  variant={value.pageMode === m.value ? "blue" : "outline"}
                  aria-pressed={value.pageMode === m.value}
                  onClick={() => set({ pageMode: m.value })}
                >
                  <Icon aria-hidden /> {m.label}
                </Button>
              );
            })}
          </div>
        </Group>

        <Group title="Cỡ chữ">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Giảm cỡ chữ"
              disabled={sizeIndex <= 0}
              onClick={() => set({ fontSize: FONT_SIZES[sizeIndex - 1] })}
            >
              <Minus />
            </Button>
            <span className="text-sm font-bold tabular-nums">{value.fontSize}px</span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Tăng cỡ chữ"
              disabled={sizeIndex >= FONT_SIZES.length - 1}
              onClick={() => set({ fontSize: FONT_SIZES[sizeIndex + 1] })}
            >
              <Plus />
            </Button>
          </div>
        </Group>

        <Group title="Giãn dòng">
          <div className="grid grid-cols-3 gap-2">
            {LINE_HEIGHTS.map((lh) => (
              <Button
                key={lh}
                size="sm"
                variant={value.lineHeight === lh ? "blue" : "outline"}
                aria-pressed={value.lineHeight === lh}
                onClick={() => set({ lineHeight: lh })}
              >
                {LINE_HEIGHT_LABEL[lh]}
              </Button>
            ))}
          </div>
        </Group>

        <Group title="Kiểu chữ">
          <div className="grid gap-1.5">
            {READING_FONTS.map((f) => {
              const active = value.font === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ font: f.value })}
                  style={{ fontFamily: f.css }}
                  className={cn(
                    "flex items-center justify-between rounded-xl border-2 px-3 py-2 text-left text-base hover:bg-muted",
                    active && "border-brand-blue bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  )}
                >
                  {f.label}
                  {active ? <Check className="size-4" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </Group>
      </PopoverContent>
    </Popover>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}
