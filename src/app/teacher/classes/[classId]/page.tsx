import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, CalendarDays, Clock3, Download, Flag, UserRound } from "lucide-react";
import { PageSkeleton } from "@/components/app-shell";
import { Mascot } from "@/components/mascot/mascot";
import { AssignForm, AssignmentActions } from "@/components/teacher/assignment-forms";
import { ProgressLegend, ProgressSplit } from "@/components/teacher/progress-split";
import { StatusText } from "@/components/teacher/status-text";
import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { progressText, vnDateString } from "@/lib/teacher";
import { cn } from "@/lib/utils";
import { formatDate, formatTimeDayMonth } from "@/lib/vn-date";
import { listAssignableWorks } from "@/server/services/assignments";
import { countOpenReports } from "@/server/services/discussions";
import { getClassDashboard, type AssignmentRow } from "@/server/services/teacher";
import { loadForTeacher } from "./load";

export const metadata: Metadata = { title: "Tổng quan lớp" };

export default function ClassDashboardPage({ params }: PageProps<"/teacher/classes/[classId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: Pick<PageProps<"/teacher/classes/[classId]">, "params">) {
  const { classId } = await params;
  // Deadlines are compared with the request time.
  await connection();
  const now = new Date();
  const [data, works, openReports] = await Promise.all([
    loadForTeacher((user) => getClassDashboard(user, classId, now)),
    listAssignableWorks(),
    countOpenReports(classId),
  ]);
  const today = vnDateString(now);
  const active = data.assignments.filter((a) => !a.overdue);
  const past = data.assignments.filter((a) => a.overdue);
  const totals = data.assignments.reduce((sum, a) => ({ done: sum.done + a.summary.done, all: sum.all + a.summary.total }), {
    done: 0,
    all: 0,
  });
  const assignedIds = new Set(data.assignments.map((a) => a.work.id));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid min-w-0 gap-8">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Học sinh" value={data.members.length} />
          <Stat label="Bài đang giao" value={active.length} />
          <Stat label="Hoàn thành (mọi bài giao)" value={totals.all ? `${Math.round((totals.done * 100) / totals.all)}%` : "–"} />
          <Stat label="Học sinh quá hạn" value={data.behind.length} alert={data.behind.length > 0} />
        </dl>

        <section className="grid gap-4" aria-labelledby="assignments-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="assignments-heading" className="text-2xl font-semibold">
              Tác phẩm được giao
            </h2>
            {data.assignments.length > 0 ? (
              <a href={`/teacher/classes/${classId}/export`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
                <Download aria-hidden /> Xuất báo cáo .xlsx
              </a>
            ) : null}
          </div>
          {data.assignments.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center">
              <Mascot pose="think" size={96} label="" />
              <p className="font-bold">Lớp chưa có tác phẩm được giao</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Giao một tác phẩm kèm hạn đọc để theo dõi tiến độ, nhắc học sinh và xuất báo cáo.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {active.map((a) => (
                <AssignmentCard key={a.id} a={a} classId={classId} minDate={today} />
              ))}
              {past.length > 0 ? (
                <>
                  <h3 className="mt-2 text-sm font-bold tracking-wider text-muted-foreground uppercase">Đã qua hạn</h3>
                  {past.map((a) => (
                    <AssignmentCard key={a.id} a={a} classId={classId} minDate={today} />
                  ))}
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <aside className="grid gap-5">
        <section className="grid gap-3 rounded-2xl border-2 bg-card p-5" aria-labelledby="assign-heading">
          <h2 id="assign-heading" className="text-lg font-semibold">
            Giao tác phẩm
          </h2>
          <AssignForm classId={classId} works={works.filter((w) => !assignedIds.has(w.id))} minDate={today} />
        </section>

        {openReports > 0 ? (
          <Link
            href={`/teacher/classes/${classId}/discussions`}
            className="flex items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 hover:bg-destructive/10"
          >
            <Flag className="size-5 shrink-0 text-destructive" aria-hidden />
            <span className="grid">
              <span className="font-bold">{openReports} báo cáo thảo luận chờ xem</span>
              <span className="text-xs text-muted-foreground">Bấm để mở hàng chờ kiểm duyệt</span>
            </span>
          </Link>
        ) : null}

        <section className="grid gap-3 rounded-2xl border-2 bg-card p-5" aria-labelledby="behind-heading">
          <h2 id="behind-heading" className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-5 text-destructive" aria-hidden /> Cần chú ý
          </h2>
          {data.behind.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có học sinh nào quá hạn.</p>
          ) : (
            <ul className="grid gap-2">
              {data.behind.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/teacher/classes/${classId}/students/${s.id}`}
                    className="grid rounded-xl px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="font-bold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">Quá hạn: {s.overdue.join(", ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl border-2 bg-card px-4 py-3">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className={cn("text-3xl font-extrabold tabular-nums", alert && "text-destructive")}>{value}</dd>
    </div>
  );
}

function AssignmentCard({ a, classId, minDate }: { a: AssignmentRow; classId: string; minDate: string }) {
  const s = a.summary;
  const pending = a.students
    .filter((st) => st.status !== "done")
    .map((st) => ({
      id: st.id,
      name: st.name,
      status: progressText(st, (d) => formatDate(d)),
      lastReminder: st.lastReminderAt ? formatTimeDayMonth(st.lastReminderAt) : null,
    }));
  return (
    <article className="grid gap-4 rounded-2xl border-2 bg-card p-5" aria-labelledby={`assignment-${a.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`assignment-${a.id}`} className="font-heading text-xl leading-tight font-semibold">
            {a.work.title}
          </h3>
          <p className="text-sm text-muted-foreground">{a.work.author}</p>
        </div>
        <p
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold",
            a.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
          )}
        >
          <CalendarDays className="size-4" aria-hidden />
          Hạn {formatDate(a.dueAt)} · {a.dueLabel}
        </p>
      </div>

      <div className="grid gap-2">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-extrabold tabular-nums">
            {s.done}/{s.total}
          </span>
          <span className="text-sm text-muted-foreground">
            học sinh hoàn thành ({Math.round(s.completionRate * 100)}%)
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock3 className="size-4" aria-hidden /> TB {a.avgMinutes} phút đọc / HS đã đọc
          </span>
        </p>
        <ProgressSplit summary={s} />
        <ProgressLegend summary={s} />
        {s.overdue > 0 ? (
          <p className="flex items-center gap-1.5 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4" aria-hidden /> {s.overdue} học sinh quá hạn chưa xong
          </p>
        ) : null}
      </div>

      <AssignmentActions
        assignmentId={a.id}
        workTitle={a.work.title}
        dueDate={vnDateString(a.dueAt)}
        minDate={minDate}
        pending={pending}
      />

      <details className="group rounded-xl border-2">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-bold select-none group-open:border-b-2 marker:hidden">
          <span className="inline-flex items-center gap-2">
            <UserRound className="size-4" aria-hidden /> Từng học sinh
          </span>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-bold">Học sinh</th>
                <th className="px-2 py-2 font-bold">Trạng thái</th>
                <th className="px-2 py-2 font-bold">Tiến độ</th>
                <th className="px-2 py-2 text-right font-bold">Đọc</th>
                <th className="px-4 py-2 font-bold whitespace-nowrap">Nhắc gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {a.students.map((st) => (
                <tr key={st.id} className="border-t">
                  <td className="px-4 py-2">
                    <Link href={`/teacher/classes/${classId}/students/${st.id}`} className="font-bold hover:underline">
                      {st.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <StatusText progress={st} />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={st.percent} label={`Tiến độ của ${st.name}`} className="h-2 w-20" />
                      <span className="tabular-nums">{st.percent}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{st.minutes} ph</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                    {st.lastReminderAt ? formatTimeDayMonth(st.lastReminderAt) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
