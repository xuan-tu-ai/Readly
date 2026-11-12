import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Pencil } from "lucide-react";
import { resolveAiReportAction } from "@/app/actions/admin-content";
import { PageSkeleton } from "@/components/app-shell";
import { LevelChip } from "@/components/teacher/answer-review";
import { Mascot } from "@/components/mascot/mascot";
import { Button, buttonVariants } from "@/components/ui/button";
import { TYPE_LABEL } from "@/lib/content/labels";
import { cn } from "@/lib/utils";
import { formatTimeDayMonth } from "@/lib/vn-date";
import { requireUser } from "@/server/auth/dal";
import { listAiReports } from "@/server/services/admin/gamification";

export const metadata: Metadata = { title: "Báo cáo AI" };

export default function AiReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const user = await requireUser("ADMIN");
  const show = (await searchParams).show === "resolved" ? "resolved" : "open";
  const reports = await listAiReports(user, show);
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Nhận xét AI bị giáo viên báo cáo</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Giáo viên báo cáo khi AI chấm hoặc nhận xét chưa phù hợp. Xem câu trả lời, nhận xét và rubric; nếu rubric cần rõ hơn thì sửa
          câu hỏi, rồi đánh dấu đã xử lý.
        </p>
      </div>
      <nav className="flex gap-2" aria-label="Lọc báo cáo">
        {(["open", "resolved"] as const).map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : "/admin/reports?show=resolved"}
            aria-current={s === show ? "page" : undefined}
            className={cn("rounded-full border-2 px-3 py-1 text-sm font-bold hover:bg-muted", s === show && "border-primary bg-primary/10")}
          >
            {s === "open" ? "Chờ xử lý" : "Đã xử lý"}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center">
          <Mascot pose="cheer" size={96} label="" />
          <p className="font-bold">{show === "open" ? "Không có báo cáo nào chờ xử lý" : "Chưa có báo cáo nào được xử lý"}</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {reports.map((r) => (
            <li key={r.id} className="grid gap-3 rounded-2xl border-2 bg-card p-4">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {r.question.work.title} · {TYPE_LABEL[r.question.type]} · {r.teacher} báo cáo lúc {formatTimeDayMonth(r.createdAt)}
              </p>
              <p className="rounded-xl bg-destructive/5 px-3 py-2 text-sm">
                <span className="font-semibold">Lý do: </span>
                {r.reason}
              </p>
              <p className="font-bold">{r.question.prompt}</p>
              <blockquote className="rounded-xl border-l-4 border-brand-blue/50 bg-muted/40 px-3 py-2 text-sm whitespace-pre-line">
                {r.answer.content}
              </blockquote>
              <div className="grid gap-1 text-sm">
                <div className="flex flex-wrap gap-2">
                  {r.answer.aiLevel ? <LevelChip level={r.answer.aiLevel} by="AI" /> : null}
                  {r.answer.level && r.answer.level !== r.answer.aiLevel ? <LevelChip level={r.answer.level} by="GV" /> : null}
                </div>
                {r.answer.strengths ? <p>Điểm mạnh: {r.answer.strengths}</p> : null}
                {r.answer.improvements ? <p>Cần bổ sung: {r.answer.improvements}</p> : null}
              </div>
              {r.question.rubric ? (
                <dl className="grid gap-1 rounded-xl border-2 p-3 text-sm sm:grid-cols-3">
                  {(
                    [
                      ["Chưa đạt", r.question.rubric.chuaDat],
                      ["Đạt", r.question.rubric.dat],
                      ["Sâu sắc", r.question.rubric.sauSac],
                    ] as const
                  ).map(([label, text]) => (
                    <div key={label}>
                      <dt className="font-bold">{label}</dt>
                      <dd className="text-muted-foreground">{text}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/works/${r.question.work.id}/questions`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Pencil aria-hidden /> Sửa câu hỏi
                </Link>
                {r.resolvedAt ? (
                  <span className="self-center text-sm text-muted-foreground">Đã xử lý {formatTimeDayMonth(r.resolvedAt)}</span>
                ) : (
                  <form action={resolveAiReportAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" size="sm">
                      <CheckCircle2 aria-hidden /> Đánh dấu đã xử lý
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
