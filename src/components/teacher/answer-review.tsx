"use client";

import { useState } from "react";
import { Flag, PencilLine } from "lucide-react";
import type { AnswerLevel } from "@/generated/prisma/enums";
import { reportAiAction, reviewAnswerAction } from "@/app/actions/teacher";
import { FormAlert } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { LEVEL_LABEL } from "@/lib/questions/rules";
import { cn } from "@/lib/utils";
import { useKeptForm } from "./use-kept-form";

const LEVELS: AnswerLevel[] = ["CHUA_DAT", "DAT", "SAU_SAC"];

type Props = {
  answerId: string;
  aiLevel: AnswerLevel | null;
  teacherLevel: AnswerLevel | null;
  teacherNote: string | null;
  aiHidden: boolean;
  reported: boolean;
};

/**
 * Teacher controls on one AI-graded answer (spec §6.5): override the level,
 * write a note, hide the AI feedback, or report it to the admin.
 */
export function AnswerReviewControls(props: Props) {
  const [panel, setPanel] = useState<"none" | "review" | "report">("none");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const close = (message?: string) => {
    setPanel("none");
    setLastMessage(message ?? null);
  };

  return (
    <div className="grid gap-3">
      {panel === "none" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPanel("review")}>
            <PencilLine aria-hidden /> Chỉnh mức / nhận xét
          </Button>
          {props.reported ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Flag className="size-4" aria-hidden /> Đã báo admin
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setPanel("report")}>
              <Flag aria-hidden /> Báo admin
            </Button>
          )}
          {lastMessage ? (
            <p role="status" className="text-sm font-semibold text-primary">
              {lastMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      {panel === "review" ? <ReviewForm {...props} onDone={close} /> : null}
      {panel === "report" ? <ReportForm answerId={props.answerId} onDone={close} /> : null}
    </div>
  );
}

function ReviewForm({ answerId, aiLevel, teacherLevel, teacherNote, aiHidden, onDone }: Props & { onDone: (m?: string) => void }) {
  const [hide, setHide] = useState(aiHidden);
  const { state, pending, onSubmit } = useKeptForm(async (prev: FormState, formData: FormData) => {
    const result = await reviewAnswerAction(prev, formData);
    if (result.ok) onDone(result.message);
    return result;
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border-2 border-dashed p-3">
      <input type="hidden" name="answerId" value={answerId} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">Mức đánh giá</legend>
        <div className="flex flex-wrap gap-2">
          {(["", ...LEVELS] as const).map((level) => (
            <label
              key={level || "ai"}
              className="flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold has-checked:border-primary has-checked:bg-primary/10"
            >
              <input
                type="radio"
                name="level"
                value={level}
                defaultChecked={(teacherLevel ?? "") === level}
                className="accent-primary"
              />
              {level ? LEVEL_LABEL[level] : `Giữ mức AI${aiLevel ? ` (${LEVEL_LABEL[aiLevel]})` : ""}`}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`note-${answerId}`}>Nhận xét của giáo viên {hide ? "(bắt buộc khi ẩn nhận xét AI)" : "(không bắt buộc)"}</Label>
        <Textarea id={`note-${answerId}`} name="note" rows={3} maxLength={1000} defaultValue={teacherNote ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="hideAi"
          checked={hide}
          onChange={(e) => setHide(e.target.checked)}
          className="size-4 accent-primary"
        />
        Ẩn nhận xét của AI với học sinh
      </label>
      <FormAlert state={state} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone()}>
          Hủy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Đổi mức sẽ tính lại điểm của học sinh (có thể cộng hoặc trừ).</p>
    </form>
  );
}

function ReportForm({ answerId, onDone }: { answerId: string; onDone: (m?: string) => void }) {
  const { state, pending, onSubmit } = useKeptForm(async (prev: FormState, formData: FormData) => {
    const result = await reportAiAction(prev, formData);
    if (result.ok) onDone(result.message);
    return result;
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border-2 border-dashed p-3">
      <input type="hidden" name="answerId" value={answerId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`reason-${answerId}`}>Nhận xét AI có vấn đề gì?</Label>
        <Textarea
          id={`reason-${answerId}`}
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="Ví dụ: chấm Sâu sắc dù câu trả lời chưa nêu ý chính; rubric cần rõ hơn."

        />
      </div>
      <FormAlert state={state} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={pending}>
          {pending ? "Đang gửi…" : "Gửi báo cáo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone()}>
          Hủy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Admin sẽ xem lại câu hỏi và rubric. Học sinh không thấy báo cáo này.</p>
    </form>
  );
}

export const LEVEL_CHIP: Record<AnswerLevel, string> = {
  CHUA_DAT: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  DAT: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  SAU_SAC: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

export function LevelChip({ level, by, className }: { level: AnswerLevel; by?: string; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", LEVEL_CHIP[level], className)}>
      {by ? <span className="font-semibold opacity-75">{by}:</span> : null}
      {LEVEL_LABEL[level]}
    </span>
  );
}
