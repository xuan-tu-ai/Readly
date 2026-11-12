import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Award, CalendarDays, ChevronLeft, Clock3, TriangleAlert } from "lucide-react";
import { resetStudentPasswordAction } from "@/app/actions/teacher";
import { PageSkeleton } from "@/components/app-shell";
import { CatAvatar } from "@/components/art/avatars";
import { StreakFlame, XpIcon } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { AnswerCard } from "@/components/teacher/answer-card";
import { RemoveStudentButton } from "@/components/teacher/class-controls";
import { StatusText } from "@/components/teacher/status-text";
import { ProgressBar } from "@/components/ui/progress-bar";
import { LEVEL_LABEL, effectiveLevel } from "@/lib/questions/rules";
import { cn } from "@/lib/utils";
import { getStudentReport, type StudentReport } from "@/server/services/teacher";
import { loadForTeacher } from "../../load";
import { formatDate } from "@/lib/vn-date";

export const metadata: Metadata = { title: "Học sinh" };

const STATE_LABEL = {
  unanswered: "Chưa trả lời",
  pending: "Đang chờ AI",
  retry: "Chưa đạt, còn lượt",
  passed: "Đạt",
  exhausted: "Hết 3 lượt",
  answered: "Đã trả lời",
} as const;

export default function StudentDetailPage({ params }: PageProps<"/teacher/classes/[classId]/students/[studentId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentDetail params={params} />
    </Suspense>
  );
}

async function StudentDetail({ params }: Pick<PageProps<"/teacher/classes/[classId]/students/[studentId]">, "params">) {
  const { classId, studentId } = await params;
  const report = await loadForTeacher((user) => getStudentReport(user, classId, studentId));
  const { student, player } = report;

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <Link
          href={`/teacher/classes/${classId}/students`}
          className="inline-flex w-fit items-center gap-1 text-sm font-bold text-muted-foreground uppercase hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> Danh sách học sinh
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <CatAvatar avatar={student.avatar} size={72} label="" />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold">{student.name}</h2>
            <p className="text-sm text-muted-foreground">
              {student.email} · vào lớp {formatDate(student.joinedAt)}
            </p>
          </div>
          <dl className="flex flex-wrap gap-2 text-sm">
            <Chip label="Cấp độ">
              <LevelEmblem level={player.level.level} size={24} label="" /> {player.level.name}
            </Chip>
            <Chip label="Điểm">
              <XpIcon size={20} /> {player.points}
            </Chip>
            <Chip label="Streak">
              <StreakFlame size={20} lit={player.streak.current > 0} label="" /> {player.streak.current} ngày
            </Chip>
            <Chip label="Huy hiệu">
              <Award className="size-5 text-brand-purple" aria-hidden /> {player.badges} huy hiệu
            </Chip>
          </dl>
        </div>
      </div>

      <section className="grid gap-4" aria-labelledby="works-heading">
        <h3 id="works-heading" className="text-xl font-semibold">
          Tác phẩm
        </h3>
        {report.works.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed p-6 text-center text-muted-foreground">
            Em chưa mở tác phẩm nào và lớp chưa giao bài.
          </p>
        ) : (
          report.works.map((w) => <WorkBlock key={w.id} work={w} classId={classId} />)
        )}
      </section>

      <section className="grid gap-3 rounded-2xl border-2 bg-card p-5 sm:max-w-md" aria-labelledby="account-heading">
        <h3 id="account-heading" className="text-lg font-semibold">
          Tài khoản
        </h3>
        <ResetPasswordForm userId={student.id} userName={student.name} action={resetStudentPasswordAction} />
        <RemoveStudentButton
          classId={classId}
          studentId={student.id}
          studentName={student.name}
          returnTo={`/teacher/classes/${classId}/students`}
        />
      </section>
    </div>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border-2 bg-card px-3 py-1 font-bold">
      <dt className="sr-only">{label}</dt>
      <dd className="flex items-center gap-1.5">{children}</dd>
    </div>
  );
}

function WorkBlock({ work: w, classId }: { work: StudentReport["works"][number]; classId: string }) {
  const answered = w.questions.length;
  return (
    <article className="grid gap-3 rounded-2xl border-2 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-heading text-lg leading-tight font-semibold">{w.title}</h4>
          <p className="text-sm text-muted-foreground">{w.author}</p>
        </div>
        {w.dueAt ? (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold">
            <CalendarDays className="size-4" aria-hidden /> Giao · hạn {formatDate(w.dueAt)}
          </span>
        ) : (
          <span className="rounded-full border-2 px-3 py-0.5 text-sm font-bold text-muted-foreground">Tự đọc</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <StatusText progress={w.progress} />
        <span className="flex items-center gap-2">
          <ProgressBar value={w.progress.percent} label={`Tiến độ đọc ${w.title}`} className="h-2.5 w-28" />
          <span className="tabular-nums">{w.progress.percent}% phân đoạn</span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock3 className="size-4" aria-hidden /> {w.progress.minutes} phút đọc
        </span>
        {w.onTime ? <span className="font-bold text-[#178a45] dark:text-[#5fd68f]">+ thưởng đúng hạn</span> : null}
        {w.owed > 0 ? <span className="font-bold text-[#9a6700] dark:text-[#e8b54a]">Còn {w.owed} câu bắt buộc</span> : null}
        {w.flagged > 0 ? (
          <span className="inline-flex items-center gap-1 font-bold text-destructive">
            <TriangleAlert className="size-4" aria-hidden /> {w.flagged} câu hết 3 lượt
          </span>
        ) : null}
      </div>

      {answered > 0 ? (
        <details className="group rounded-xl border-2" open={w.flagged > 0}>
          <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-bold select-none group-open:border-b-2">
            Câu trả lời ({answered} câu)
          </summary>
          <ol className="grid gap-4 p-4">
            {w.questions.map((q) => {
              const latest = q.attempts.at(-1)!;
              const level = latest.question.type === "MCQ" ? null : effectiveLevel({ level: latest.aiLevel, teacherLevel: latest.teacherLevel });
              return (
                <li key={q.id} className="grid gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-bold">{q.prompt}</p>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        q.state.flagged ? "text-destructive" : q.state.status === "passed" ? "text-[#178a45] dark:text-[#5fd68f]" : "text-muted-foreground",
                      )}
                    >
                      {q.state.status === "passed" ? (level ? LEVEL_LABEL[level] : "Đúng") : STATE_LABEL[q.state.status]}
                      {!q.required ? " · không bắt buộc" : ""}
                    </span>
                  </div>
                  {q.segmentTitle ? <p className="text-xs text-muted-foreground">{q.segmentTitle}</p> : null}
                  <div className="grid gap-2">
                    {q.attempts.map((a) => (
                      <AnswerCard key={a.id} answer={a} classId={classId} showStudent={false} showQuestion={false} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </article>
  );
}
