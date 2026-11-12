import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/server/auth/dal";
import { countUnread } from "@/server/services/notifications";
import { cn } from "@/lib/utils";

/** Bell with the unread count; opens the notifications page. Streams in behind Suspense. */
export async function NotificationBell({ className }: { className?: string }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return null;
  const unread = await countUnread(user.id);
  return (
    <Link
      href="/student/notifications"
      aria-label={unread > 0 ? `Thông báo: ${unread} chưa đọc` : "Thông báo"}
      className={cn("relative grid size-9 place-items-center rounded-xl hover:bg-muted", className)}
    >
      <Bell className="size-5" aria-hidden strokeWidth={2.5} />
      {unread > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] font-extrabold text-white tabular-nums ring-2 ring-background">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function NotificationBellSkeleton() {
  return <span aria-hidden className="size-9 animate-pulse rounded-xl bg-muted" />;
}
