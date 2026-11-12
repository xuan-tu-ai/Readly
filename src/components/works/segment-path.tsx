import Link from "next/link";
import { BookOpen, Check, CircleHelp, Trophy } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import { cn } from "@/lib/utils";
import type { WorkPathNode } from "@/server/services/reading";

/** Horizontal offsets (px) that make the path wind left and right. */
const WIND = [0, 44, 72, 44, 0, -44, -72, -44];

/**
 * Duolingo-style path of a work's segments. Nothing is locked: every node
 * opens the reader at that segment; the state only shows progress.
 */
export function SegmentPath({
  slug,
  nodes,
  completed,
}: {
  slug: string;
  nodes: WorkPathNode[];
  completed: boolean;
}) {
  const started = nodes.some((n) => n.read);
  return (
    <ol className="relative grid justify-items-center gap-7 py-4" aria-label="Lộ trình phân đoạn">
      {nodes.map((node, i) => {
        const offset = WIND[i % WIND.length];
        // "Owed" only matters once the segment has been read; unread ones simply wait.
        const state = node.current ? "current" : node.read ? (node.owed ? "owed" : "read") : "todo";
        const label = node.title ?? `Phần ${node.order}`;
        return (
          <li
            key={node.id}
            className={cn("relative grid justify-items-center gap-2", node.current && i > 0 && "mt-8")}
            style={{ transform: `translateX(${offset}px)` }}
          >
            {node.current ? (
              <span className="absolute -top-11 z-10 animate-pop-in rounded-xl whitespace-nowrap border-2 bg-card px-3 py-1.5 text-xs font-extrabold tracking-wide text-primary uppercase shadow-[0_3px_0_var(--border)] after:absolute after:-bottom-[7px] after:left-1/2 after:size-3 after:-translate-x-1/2 after:rotate-45 after:border-r-2 after:border-b-2 after:bg-card">
                {started ? "Tiếp tục" : "Bắt đầu"}
              </span>
            ) : null}
            <Link
              href={`/student/read/${slug}?seg=${node.id}`}
              aria-label={`${label}${stateLabel(state)}`}
              className={cn(
                "relative grid size-[68px] place-items-center rounded-full text-white transition-transform duration-100 active:translate-y-1 active:shadow-none",
                state === "read" && "bg-primary shadow-[0_6px_0_var(--primary-edge)]",
                state === "owed" && "bg-brand-yellow text-amber-900 shadow-[0_6px_0_oklch(0.72_0.14_80)]",
                state === "current" && "animate-pulse-ring bg-brand-orange shadow-[0_6px_0_var(--brand-orange-edge)]",
                state === "todo" && "bg-muted text-muted-foreground shadow-[0_6px_0_var(--border)]",
              )}
            >
              {state === "read" ? (
                <Check className="size-8" strokeWidth={3.5} aria-hidden />
              ) : state === "owed" ? (
                <CircleHelp className="size-8" strokeWidth={3} aria-hidden />
              ) : (
                <BookOpen className="size-7" strokeWidth={2.75} aria-hidden />
              )}
              <span aria-hidden className="absolute top-2 left-3.5 h-2 w-4 rounded-full bg-white/35" />
            </Link>
            <span className="max-w-32 text-center text-xs font-bold text-muted-foreground">{label}</span>
            {node.current ? (
              <Mascot
                pose="read"
                size={84}
                label=""
                className={cn("absolute top-0", offset >= 0 ? "-left-28" : "-right-28")}
              />
            ) : null}
          </li>
        );
      })}
      <li className="grid justify-items-center gap-2">
        <span
          className={cn(
            "grid size-[76px] place-items-center rounded-2xl",
            completed
              ? "bg-brand-yellow text-amber-900 shadow-[0_6px_0_oklch(0.72_0.14_80)]"
              : "bg-muted text-muted-foreground shadow-[0_6px_0_var(--border)]",
          )}
          aria-hidden
        >
          <Trophy className="size-9" strokeWidth={2.5} />
        </span>
        <span className="text-xs font-bold text-muted-foreground">{completed ? "Đã hoàn thành" : "Hoàn thành tác phẩm"}</span>
      </li>
    </ol>
  );
}

function stateLabel(state: "read" | "owed" | "current" | "todo") {
  switch (state) {
    case "read":
      return " – đã đọc";
    case "owed":
      return " – còn câu hỏi";
    case "current":
      return " – đang đọc";
    default:
      return " – chưa đọc";
  }
}
