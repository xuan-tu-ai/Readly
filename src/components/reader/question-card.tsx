"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, Loader2, Sparkles, XCircle } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LEVEL_LABEL, countWords, DEFAULT_ESSAY_WORDS } from "@/lib/questions/rules";
import type { AnswerView, QuestionView } from "@/server/services/questions";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<QuestionView["type"], string> = {
  PREDICTION: "Dự đoán",
  MCQ: "Trắc nghiệm",
  SHORT: "Tự luận ngắn",
  ESSAY: "Đoạn cảm nhận",
};

const LEVEL_STYLE: Record<string, string> = {
  CHUA_DAT: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  DAT: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  SAU_SAC: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

type Props = {
  question: QuestionView;
  onSubmit: (questionId: string, content: string) => Promise<string | null>;
};

export function QuestionCard({ question, onSubmit }: Props) {
  const { state } = question;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();

  const submit = (content: string) =>
    startTransition(async () => {
      const failure = await onSubmit(question.id, content);
      setError(failure);
      if (!failure) setDraft("");
    });

  const latest = question.answers.at(-1);
  const openType = question.type === "SHORT" || question.type === "ESSAY" || question.type === "PREDICTION";

  return (
    <div className="grid gap-3 rounded-2xl border-2 bg-card p-4 text-card-foreground" data-question={question.id}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{TYPE_LABEL[question.type]}</Badge>
        {question.required ? null : <span className="text-muted-foreground">Không bắt buộc</span>}
        <StatusPill question={question} />
      </div>
      <p className="font-medium leading-snug">{question.prompt}</p>

      {question.type === "MCQ" ? (
        <McqBody question={question} disabled={!state.canSubmit || submitting} onSubmit={submit} />
      ) : null}

      {/* History of open answers (newest last). */}
      {openType
        ? question.answers
            .filter((a) => a.status !== "FAILED" || a === latest)
            .map((a) => <AnswerFeedback key={a.id} answer={a} type={question.type} />)
        : null}

      {openType && state.canSubmit ? (
        <OpenAnswerForm
          question={question}
          draft={draft}
          setDraft={setDraft}
          submitting={submitting}
          onSubmit={() => submit(draft)}
        />
      ) : null}

      {state.status === "exhausted" ? (
        <p className="text-sm text-muted-foreground">
          Bạn đã dùng hết {state.attemptsUsed} lượt. Câu này được tính là đã làm, giáo viên sẽ xem lại cùng bạn.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function StatusPill({ question }: { question: QuestionView }) {
  const { state } = question;
  switch (state.status) {
    case "passed":
      return (
        <span className="ml-auto flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" aria-hidden /> Hoàn thành
        </span>
      );
    case "pending":
      return (
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden /> Đang chờ nhận xét
        </span>
      );
    case "retry":
      return <span className="ml-auto text-amber-700 dark:text-amber-400">Còn {state.attemptsLeft} lượt</span>;
    case "answered":
      return <span className="ml-auto text-muted-foreground">Đã trả lời</span>;
    default:
      return question.required && question.type !== "PREDICTION" ? (
        <span className="ml-auto text-muted-foreground">Bắt buộc</span>
      ) : null;
  }
}

function McqBody({
  question,
  disabled,
  onSubmit,
}: {
  question: QuestionView;
  disabled: boolean;
  onSubmit: (optionId: string) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const tried = new Set(question.answers.filter((a) => a.isCorrect === false).map((a) => a.content));
  const resolved = question.correctOptionId !== null;

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (choice) onSubmit(choice);
      }}
    >
      <fieldset className="grid gap-2" disabled={disabled}>
        <legend className="sr-only">Chọn một đáp án</legend>
        {question.options?.map((option) => {
          const correct = resolved && option.id === question.correctOptionId;
          const wrong = tried.has(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm font-medium has-checked:border-brand-blue has-checked:bg-sidebar-accent",
                correct && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
                wrong && "border-amber-400 text-muted-foreground line-through",
                disabled && "cursor-default",
              )}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={option.id}
                checked={choice === option.id}
                onChange={() => setChoice(option.id)}
                className="accent-primary"
              />
              {option.text}
              {correct ? <CheckCircle2 className="ml-auto size-4 text-emerald-600" aria-label="Đáp án đúng" /> : null}
              {wrong ? <XCircle className="ml-auto size-4 text-amber-600" aria-label="Đã chọn sai" /> : null}
            </label>
          );
        })}
      </fieldset>
      {question.state.canSubmit ? (
        <Button type="submit" size="sm" className="justify-self-start" disabled={disabled || !choice}>
          Trả lời
        </Button>
      ) : null}
      {question.state.status === "retry" ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">Chưa đúng, thử lại nhé.</p>
      ) : null}
      {question.explanation ? <p className="text-sm text-muted-foreground">{question.explanation}</p> : null}
    </form>
  );
}

function OpenAnswerForm({
  question,
  draft,
  setDraft,
  submitting,
  onSubmit,
}: {
  question: QuestionView;
  draft: string;
  setDraft: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const essay = question.type === "ESSAY";
  const min = question.minWords ?? DEFAULT_ESSAY_WORDS.min;
  const max = question.maxWords ?? DEFAULT_ESSAY_WORDS.max;
  const words = countWords(draft);
  const retry = question.state.status === "retry";
  const id = `answer-${question.id}`;

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {essay && question.outline ? (
        <details className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Dàn ý gợi ý</summary>
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{question.outline}</p>
        </details>
      ) : null}
      <label htmlFor={id} className="sr-only">
        Câu trả lời
      </label>
      <Textarea
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={essay ? 8 : 3}
        maxLength={essay ? 5000 : 1000}
        placeholder={question.type === "PREDICTION" ? "Viết dự đoán của bạn…" : "Viết câu trả lời của bạn…"}
        className="font-sans"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={submitting || !draft.trim()}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {retry ? `Nộp lại (còn ${question.state.attemptsLeft} lượt)` : "Nộp"}
        </Button>
        {essay ? (
          <span className={cn("text-xs tabular-nums", words < min || words > max ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {words}/{min}–{max} chữ
          </span>
        ) : null}
        {question.type !== "PREDICTION" ? (
          <span className="text-xs text-muted-foreground">Không ghi thông tin cá nhân vào câu trả lời.</span>
        ) : null}
      </div>
    </form>
  );
}

function AnswerFeedback({ answer, type }: { answer: AnswerView; type: QuestionView["type"] }) {
  return (
    <div className="grid gap-2 rounded-lg border-l-4 border-muted bg-muted/30 px-3 py-2 text-sm">
      <p className="whitespace-pre-line">{answer.content}</p>
      {answer.status === "PENDING" ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Mascot pose="think" size={44} label="" /> Mướp đang đọc câu trả lời của bạn… Bạn cứ đọc tiếp nhé.
        </p>
      ) : null}
      {answer.status === "FAILED" ? (
        <p className="text-muted-foreground">Chưa nhận xét được câu trả lời này. Bạn có thể nộp lại, lượt này không bị tính.</p>
      ) : null}
      {answer.status === "GRADED" && type !== "PREDICTION" && answer.level ? (
        <div className="grid gap-1">
          <span className={cn("w-fit rounded-full px-2 py-0.5 text-xs font-medium", LEVEL_STYLE[answer.level])}>
            {LEVEL_LABEL[answer.level]}
            {answer.levelByTeacher ? " · giáo viên chấm" : ""}
          </span>
          {answer.strengths ? (
            <p>
              <span className="font-medium">Điểm mạnh: </span>
              {answer.strengths}
            </p>
          ) : null}
          {answer.improvements ? (
            <p>
              <span className="font-medium">Cần bổ sung: </span>
              {answer.improvements}
            </p>
          ) : null}
        </div>
      ) : null}
      {type === "PREDICTION" && answer.feedback ? (
        <p className="flex gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{answer.feedback}</span>
        </p>
      ) : null}
      {answer.teacherNote ? (
        <p>
          <span className="font-medium">Giáo viên: </span>
          {answer.teacherNote}
        </p>
      ) : null}
    </div>
  );
}
