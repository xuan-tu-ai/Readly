import Link from "next/link";
import { BellRing, CalendarDays, CheckCircle2 } from "lucide-react";
import { XpIcon } from "@/components/art/game-icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { StudentAssignment } from "@/server/services/assignments";
import { WorkCover } from "./work-cover";
import { formatDayMonth } from "@/lib/vn-date";

/** "Bài được giao" on the student home: deadline, progress and the teacher's latest reminder. */
export function AssignedWorks({ items, earlyBonus }: { items: StudentAssignment[]; earlyBonus: number }) {
  const open = items.filter((a) => a.progress.status !== "done");
  const done = items.length - open.length;
  return (
    <section aria-labelledby="assigned-heading" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="assigned-heading" className="font-heading text-2xl font-semibold">
          Bài được giao
        </h2>
        {done > 0 ? (
          <p className="flex items-center gap-1 text-sm font-bold text-primary">
            <CheckCircle2 className="size-4" aria-hidden /> Đã xong {done}/{items.length}
          </p>
        ) : null}
      </div>
      {open.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground">
          Bạn đã xong mọi tác phẩm được giao. Giỏi lắm!
        </p>
      ) : (
        <ul className="grid gap-3">
          {open.map((a) => {
            const urgent = a.progress.overdue || a.dueLabel === "hạn hôm nay" || a.dueLabel === "hạn ngày mai";
            return (
              <li key={a.id}>
                <Link
                  href={`/student/works/${a.work.slug}`}
                  className="grid grid-cols-[56px_1fr] gap-4 rounded-2xl border-2 bg-card p-3 transition-transform hover:-translate-y-0.5 sm:grid-cols-[64px_1fr]"
                >
                  <WorkCover title={a.work.title} genre={a.work.genre} coverUrl={a.work.coverUrl} className="shadow-md" />
                  <div className="grid min-w-0 content-center gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-heading text-lg leading-tight font-semibold">{a.work.title}</p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                          a.progress.overdue
                            ? "bg-destructive/10 text-destructive"
                            : urgent
                              ? "bg-brand-orange/15 text-[#a8461b] dark:text-[#ff9e6b]"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        <CalendarDays className="size-3.5" aria-hidden />
                        Hạn {formatDayMonth(a.dueAt)} · {a.dueLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar value={a.progress.percent} label={`Tiến độ ${a.work.title}`} className="h-2.5 flex-1" />
                      <span className="text-sm font-bold tabular-nums">{a.progress.percent}%</span>
                    </div>
                    {a.progress.percent === 100 ? (
                      <p className="text-xs font-bold text-muted-foreground">Đã đọc hết, còn câu hỏi bắt buộc chưa xong.</p>
                    ) : null}
                    {!a.progress.overdue && earlyBonus > 0 ? (
                      <p className="flex items-center gap-1 text-xs font-bold text-[#a8761b] dark:text-[#e8b54a]">
                        <XpIcon size={16} /> Xong trước hạn: thêm {earlyBonus} điểm
                      </p>
                    ) : null}
                    {a.reminder ? (
                      <p className="flex items-start gap-2 rounded-xl bg-brand-orange/10 px-3 py-2 text-sm">
                        <BellRing className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden />
                        <span>
                          <span className="font-bold">{a.reminder.from ?? "Mướp"} nhắc:</span> {a.reminder.body}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
