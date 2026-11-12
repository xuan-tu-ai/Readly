"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, MessageCircleQuestion, Trash2, X } from "lucide-react";
import type { HighlightColor } from "@/generated/prisma/enums";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const COLOR_OPTIONS: { value: HighlightColor; label: string; swatch: string }[] = [
  { value: "YELLOW", label: "Ấn tượng", swatch: "bg-yellow-300" },
  { value: "BLUE", label: "Thắc mắc", swatch: "bg-sky-300" },
  { value: "PINK", label: "Cảm xúc", swatch: "bg-pink-300" },
  { value: "PURPLE", label: "Nghệ thuật", swatch: "bg-violet-300" },
];

export type ToolbarHighlight = {
  id: string;
  quote: string;
  color: HighlightColor;
  note: string | null;
  isPrivate: boolean;
};

function ColorPicker({
  value,
  onPick,
  disabled,
}: {
  value?: HighlightColor;
  onPick: (color: HighlightColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Màu tô sáng">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c.value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(c.value)}
          aria-pressed={value === c.value}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50",
            value === c.value && "border-primary bg-primary/10 font-medium",
          )}
        >
          <span className={cn("size-3.5 rounded-full", c.swatch)} aria-hidden />
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-label="Tô sáng"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto grid max-w-lg animate-rise-in gap-3 rounded-2xl border-2 bg-popover p-3 font-sans text-popover-foreground shadow-[0_4px_0_var(--border)]"
    >
      {children}
    </div>
  );
}

function DiscussLink({ href }: { href: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
      <MessageCircleQuestion aria-hidden /> Thảo luận đoạn này
    </Link>
  );
}

export function PendingToolbar({
  onPick,
  onCancel,
  busy,
  error,
  discussHref,
}: {
  onPick: (color: HighlightColor) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
  discussHref?: string;
}) {
  return (
    <Shell>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Tô sáng đoạn đã chọn</p>
        <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Hủy">
          <X />
        </Button>
      </div>
      <ColorPicker onPick={onPick} disabled={busy} />
      {discussHref ? <DiscussLink href={discussHref} /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </Shell>
  );
}

export function ActiveToolbar({
  highlight,
  onUpdate,
  onDelete,
  onClose,
  busy,
  error,
  discussHref,
}: {
  highlight: ToolbarHighlight;
  onUpdate: (patch: Partial<Pick<ToolbarHighlight, "color" | "note" | "isPrivate">>) => void;
  onDelete: () => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  discussHref?: string;
}) {
  const [note, setNote] = useState(highlight.note ?? "");
  const noteChanged = note.trim() !== (highlight.note ?? "");

  return (
    <Shell>
      <div className="flex items-start justify-between gap-2">
        <blockquote className="line-clamp-2 border-l-2 pl-2 text-sm text-muted-foreground italic">
          {highlight.quote}
        </blockquote>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng">
          <X />
        </Button>
      </div>
      <ColorPicker value={highlight.color} onPick={(color) => onUpdate({ color })} disabled={busy} />
      <div className="grid gap-2">
        <label htmlFor={`note-${highlight.id}`} className="text-xs font-medium text-muted-foreground">
          Ghi chú
        </label>
        <Textarea
          id={`note-${highlight.id}`}
          value={note}
          maxLength={500}
          rows={2}
          placeholder="Vì sao đoạn này ấn tượng với bạn?"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !noteChanged} onClick={() => onUpdate({ note: note.trim() || null })}>
          <Check /> Lưu ghi chú
        </Button>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={highlight.isPrivate}
            disabled={busy}
            onChange={(e) => onUpdate({ isPrivate: e.target.checked })}
            className="size-4 accent-primary"
          />
          <Lock className="size-3.5" aria-hidden /> Chỉ mình tôi xem
        </label>
        <Button variant="ghost" size="sm" className="ml-auto text-destructive" disabled={busy} onClick={onDelete}>
          <Trash2 /> Xóa
        </Button>
      </div>
      {discussHref ? <DiscussLink href={discussHref} /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </Shell>
  );
}
