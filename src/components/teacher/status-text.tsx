import { AlertTriangle, BookOpen, CheckCircle2, Circle, Clock } from "lucide-react";
import type { WorkProgress } from "@/lib/teacher";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/vn-date";

/** A student's state on one work: icon + words, never colour alone. */
export function StatusText({ progress: p, className }: { progress: WorkProgress; className?: string }) {
  const [Icon, text, tone] =
    p.status === "done"
      ? p.late
        ? [Clock, `Xong trễ ${formatDayMonth(p.completedAt!)}`, "text-[#9a6700] dark:text-[#e8b54a]"]
        : [CheckCircle2, `Xong ${formatDayMonth(p.completedAt!)}`, "text-[#178a45] dark:text-[#5fd68f]"]
      : p.overdue
        ? [AlertTriangle, p.status === "reading" ? `Quá hạn · ${p.percent}%` : "Quá hạn · chưa đọc", "text-destructive"]
        : p.status === "reading"
          ? [BookOpen, "Đang đọc", "text-[#2a78d6] dark:text-[#7ab4ff]"]
          : [Circle, "Chưa đọc", "text-muted-foreground"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold whitespace-nowrap", tone, className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {text}
    </span>
  );
}
