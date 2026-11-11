"use client";

import { Minus, Plus, Type } from "lucide-react";
import type { ReadingTheme } from "@/generated/prisma/enums";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const FONT_SIZES = [16, 18, 20, 22, 24];
export const LINE_HEIGHTS = [
  { value: 1.5, label: "Hẹp" },
  { value: 1.7, label: "Vừa" },
  { value: 1.9, label: "Rộng" },
];
const THEMES: { value: ReadingTheme; label: string; swatch: string }[] = [
  { value: "LIGHT", label: "Sáng", swatch: "bg-white text-neutral-900" },
  { value: "SEPIA", label: "Giấy", swatch: "bg-[#f6eedc] text-[#4a3b2a]" },
  { value: "DARK", label: "Tối", swatch: "bg-[#1d1c1a] text-[#e6e2da]" },
];

export type ReaderSettingsValue = { fontSize: number; lineHeight: number; theme: ReadingTheme };

export function ReaderSettings({
  value,
  onChange,
}: {
  value: ReaderSettingsValue;
  onChange: (next: ReaderSettingsValue) => void;
}) {
  const sizeIndex = FONT_SIZES.indexOf(value.fontSize);
  return (
    <Popover>
      <PopoverTrigger className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label="Tùy chỉnh hiển thị">
        <Type /> <span className="hidden sm:inline">Hiển thị</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-4 p-4">
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Cỡ chữ</p>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Giảm cỡ chữ"
              disabled={sizeIndex <= 0}
              onClick={() => onChange({ ...value, fontSize: FONT_SIZES[sizeIndex - 1] })}
            >
              <Minus />
            </Button>
            <span className="text-sm tabular-nums">{value.fontSize}px</span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Tăng cỡ chữ"
              disabled={sizeIndex >= FONT_SIZES.length - 1}
              onClick={() => onChange({ ...value, fontSize: FONT_SIZES[sizeIndex + 1] })}
            >
              <Plus />
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Giãn dòng</p>
          <div className="grid grid-cols-3 gap-1.5">
            {LINE_HEIGHTS.map((lh) => (
              <Button
                key={lh.value}
                size="sm"
                variant={value.lineHeight === lh.value ? "default" : "outline"}
                aria-pressed={value.lineHeight === lh.value}
                onClick={() => onChange({ ...value, lineHeight: lh.value })}
              >
                {lh.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Nền</p>
          <div className="grid grid-cols-3 gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={value.theme === t.value}
                onClick={() => onChange({ ...value, theme: t.value })}
                className={cn(
                  "rounded-lg border py-2 text-sm",
                  t.swatch,
                  value.theme === t.value && "ring-2 ring-primary ring-offset-2 ring-offset-popover",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
