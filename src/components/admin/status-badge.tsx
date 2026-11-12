import type { WorkStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STYLE: Record<WorkStatus, [string, string]> = {
  DRAFT: ["Nháp", "bg-muted text-muted-foreground"],
  PUBLISHED: ["Đã xuất bản", "bg-primary/15 text-[#178a45]"],
  COMING_SOON: ["Sắp có", "bg-brand-orange/15 text-[#a8461b]"],
};

export function StatusBadge({ status, className }: { status: WorkStatus; className?: string }) {
  const [label, style] = STYLE[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", style, className)}>{label}</span>;
}
