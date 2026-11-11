"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ListOrdered } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type TocSegment = { id: string; order: number; title: string | null };

export function TocSheet({
  segments,
  readIds,
  owedIds,
  currentId,
  onJump,
}: {
  segments: TocSegment[];
  readIds: Set<string>;
  /** Segments with a required question still open ("câu nợ"). */
  owedIds: Set<string>;
  currentId: string | null;
  onJump: (segmentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label="Mục lục">
        <ListOrdered /> <span className="hidden sm:inline">Mục lục</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>Mục lục</SheetTitle>
          <SheetDescription>
            Đã đọc {readIds.size}/{segments.length} phân đoạn
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Phân đoạn" className="grid gap-1 overflow-y-auto px-2 pb-4">
          {segments.map((s) => {
            const read = readIds.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-current={s.id === currentId ? "location" : undefined}
                onClick={() => {
                  setOpen(false);
                  onJump(s.id);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                  s.id === currentId && "bg-muted font-medium",
                )}
              >
                {read ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Đã đọc" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="Chưa đọc" />
                )}
                <span className="flex-1">{s.title ?? `Phần ${s.order}`}</span>
                {owedIds.has(s.id) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    Còn câu hỏi
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
