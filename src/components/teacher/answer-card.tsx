import Link from "next/link";
import { EyeOff, Flag, TriangleAlert } from "lucide-react";
import { MAX_ATTEMPTS } from "@/lib/questions/rules";
import { cn } from "@/lib/utils";
import type { TeacherAnswer } from "@/server/services/teacher";
import { AnswerReviewControls, LevelChip } from "./answer-review";
import { formatTimeDayMonth } from "@/lib/vn-date";

const TYPE_LABEL = { SHORT: "Tự luận ngắn", ESSAY: "Đoạn cảm nhận", MCQ: "Trắc nghiệm", PREDICTION: "Dự đoán" } as const;

/** One graded answer as the teacher sees it: the AI's verdict, any override, and the controls. */
export function AnswerCard({
  answer: a,
  classId,
  showStudent = true,
  showQuestion = true,
}: {
  answer: TeacherAnswer;
  classId: string;
  showStudent?: boolean;
  showQuestion?: boolean;
}) {
  const open = a.question.type === "SHORT" || a.question.type === "ESSAY";
  return (
    <article className={cn("grid gap-3 rounded-2xl border-2 bg-card p-4", a.flagged && "border-destructive/40")}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {showStudent ? (
          <Link href={`/teacher/classes/${classId}/students/${a.student.id}`} className="font-bold hover:underline">
            {a.student.name}
          </Link>
        ) : null}
        <span className="text-muted-foreground">
          {TYPE_LABEL[a.question.type]} · lần {a.attempt}/{MAX_ATTEMPTS}
          {a.gradedAt ? ` · ${formatTimeDayMonth(a.gradedAt)}` : ""}
        </span>
        {a.flagged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
            <TriangleAlert className="size-3.5" aria-hidden /> Hết 3 lượt chưa đạt
          </span>
        ) : null}
        {a.reported ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
            <Flag className="size-3.5" aria-hidden /> Đã báo admin
          </span>
        ) : null}
      </header>

      {showQuestion ? (
        <div className="grid gap-0.5">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {a.question.work.title}
            {a.question.segmentTitle ? ` · ${a.question.segmentTitle}` : ""}
          </p>
          <p className="font-bold">{a.question.prompt}</p>
        </div>
      ) : null}

      <blockquote className="rounded-xl border-l-4 border-brand-blue/50 bg-muted/40 px-3 py-2 whitespace-pre-line">{a.content}</blockquote>

      {a.question.type === "MCQ" ? (
        <p className={cn("text-sm font-bold", a.isCorrect ? "text-[#178a45]" : "text-destructive")}>
          {a.isCorrect ? "Đúng" : "Sai"}
        </p>
      ) : (
        <div className="grid gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {a.aiLevel ? <LevelChip level={a.aiLevel} by="AI" className={cn(a.teacherLevel && "opacity-60 line-through")} /> : null}
            {a.teacherLevel ? <LevelChip level={a.teacherLevel} by="GV" /> : null}
            {a.aiHidden ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <EyeOff className="size-3.5" aria-hidden /> Nhận xét AI đang ẩn với học sinh
              </span>
            ) : null}
          </div>
          <div className={cn("grid gap-1", a.aiHidden && "opacity-60")}>
            {a.strengths ? (
              <p>
                <span className="font-semibold">Điểm mạnh: </span>
                {a.strengths}
              </p>
            ) : null}
            {a.improvements ? (
              <p>
                <span className="font-semibold">Cần bổ sung: </span>
                {a.improvements}
              </p>
            ) : null}
          </div>
          {a.teacherNote ? (
            <p className="rounded-xl bg-primary/10 px-3 py-2">
              <span className="font-semibold">Nhận xét của giáo viên: </span>
              {a.teacherNote}
            </p>
          ) : null}
        </div>
      )}

      {open && a.status === "GRADED" ? (
        <AnswerReviewControls
          answerId={a.id}
          aiLevel={a.aiLevel}
          teacherLevel={a.teacherLevel}
          teacherNote={a.teacherNote}
          aiHidden={a.aiHidden}
          reported={a.reported}
        />
      ) : null}
    </article>
  );
}
