import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCheck } from "lucide-react";
import type { NotificationKind as DbKind } from "@/generated/prisma/enums";
import { markAllNotificationsReadAction, openNotificationAction } from "@/app/actions/discussions";
import { PageSkeleton } from "@/components/app-shell";
import { NotificationIcon } from "@/components/art/notification-icons";
import { Mascot } from "@/components/mascot/mascot";
import { PushSettings } from "@/components/notifications/push-settings";
import { Button } from "@/components/ui/button";
import type { NotificationKind } from "@/lib/art";
import { cn } from "@/lib/utils";
import { formatTimeDayMonth } from "@/lib/vn-date";
import { requireUser } from "@/server/auth/dal";
import { pushPublicKey } from "@/server/push";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Thông báo" };

/** Database kind → art key (src/lib/art.ts). */
const ART_KIND: Record<DbKind, NotificationKind> = {
  ASSIGNMENT: "assignment",
  REMINDER: "reminder",
  GRADED: "graded",
  TEACHER_REVIEW: "teacher-review",
  BADGE: "badge",
  REPLY: "reply",
  LEVEL_UP: "level-up",
  STREAK: "streak",
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Notifications />
    </Suspense>
  );
}

async function Notifications() {
  const user = await requireUser("STUDENT");
  const items = await listNotifications(user.id, 50);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Thông báo</h1>
          <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} thông báo chưa đọc` : "Bạn đã đọc hết."}</p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              <CheckCheck aria-hidden /> Đánh dấu đã đọc
            </Button>
          </form>
        ) : null}
      </div>

      <PushSettings publicKey={pushPublicKey()} />

      {items.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center">
          <Mascot pose="sleep" size={96} label="" />
          <p className="font-bold">Chưa có thông báo nào</p>
          <p className="text-sm text-muted-foreground">Mướp sẽ báo khi có bài mới, nhắc hạn, nhận xét hay ai đó trả lời bạn.</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="href" value={n.href ?? ""} />
                <button
                  type="submit"
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors hover:bg-muted/60",
                    n.readAt ? "bg-card" : "border-brand-blue/40 bg-sidebar-accent",
                  )}
                >
                  <NotificationIcon kind={ART_KIND[n.kind]} size="md" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className={cn("leading-snug", n.readAt ? "font-semibold" : "font-extrabold")}>{n.title}</span>
                    {n.body ? <span className="line-clamp-2 text-sm text-muted-foreground">{n.body}</span> : null}
                    <span className="text-xs text-muted-foreground">{formatTimeDayMonth(n.createdAt)}</span>
                  </span>
                  {n.readAt ? null : <span aria-label="Chưa đọc" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-blue" />}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
