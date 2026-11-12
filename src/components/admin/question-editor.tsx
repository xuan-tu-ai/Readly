"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { QuestionStage, QuestionType } from "@/generated/prisma/enums";
import {
  addDraftQuestionsAction,
  deleteQuestionAction,
  draftQuestionsAction,
  draftRubricAction,
  saveQuestionAction,
  type QuestionDraftRow,
} from "@/app/actions/admin-content";
import { Button } from "@/components/ui/button";
import { STAGE_LABEL, TYPE_LABEL } from "@/lib/content/labels";
import { STAGE_TYPES, type QuestionInput } from "@/lib/content/schemas";
import { cn } from "@/lib/utils";
import { Labeled, areaClass, selectClass } from "./fields";


export type SegmentChoice = { id: string; label: string };

export const emptyQuestion = (stage: QuestionStage = "DURING", segmentId: string | null = null): QuestionInput => ({
  stage,
  type: STAGE_TYPES[stage][0],
  segmentId,
  prompt: "",
  required: true,
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: null,
  rubricChuaDat: null,
  rubricDat: null,
  rubricSauSac: null,
  keyPoints: [],
  outline: null,
  minWords: null,
  maxWords: null,
});

/** Create or edit one question; fields follow the question type (spec §3.1). */
export function QuestionForm({
  workId,
  questionId,
  initial,
  segments,
  answered = false,
  onDone,
}: {
  workId: string;
  questionId?: string;
  initial: QuestionInput;
  segments: SegmentChoice[];
  answered?: boolean;
  onDone: (message?: string) => void;
}) {
  const [q, setQ] = useState<QuestionInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const set = <K extends keyof QuestionInput>(key: K, value: QuestionInput[K]) => setQ((prev) => ({ ...prev, [key]: value }));
  const id = questionId ?? "new";
  const open = q.type === "SHORT" || q.type === "ESSAY";

  const setStage = (stage: QuestionStage) =>
    setQ((prev) => ({
      ...prev,
      stage,
      type: (STAGE_TYPES[stage] as readonly QuestionType[]).includes(prev.type) ? prev.type : STAGE_TYPES[stage][0],
      segmentId: stage === "DURING" ? prev.segmentId ?? segments[0]?.id ?? null : null,
    }));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveQuestionAction({ workId, questionId, data: { ...q, options: q.options.map((o) => o.trim()) } });
      if (result.ok) onDone(questionId ? "Đã lưu câu hỏi." : "Đã thêm câu hỏi.");
      else setError(result.error);
    });

  const aiRubric = () =>
    startTransition(async () => {
      setError(null);
      const result = await draftRubricAction({
        workId,
        segmentId: q.stage === "DURING" ? q.segmentId ?? null : null,
        type: q.type === "ESSAY" ? "ESSAY" : "SHORT",
        prompt: q.prompt,
      });
      if (!result.ok) return setError(result.error);
      setQ((prev) => ({
        ...prev,
        rubricChuaDat: result.data.rubric.chuaDat,
        rubricDat: result.data.rubric.dat,
        rubricSauSac: result.data.rubric.sauSac,
        keyPoints: result.data.keyPoints,
      }));
    });

  return (
    <div className="grid gap-3 rounded-2xl border-2 border-dashed bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled id={`stage-${id}`} label="Giai đoạn">
          <select id={`stage-${id}`} className={selectClass} value={q.stage} onChange={(e) => setStage(e.target.value as QuestionStage)}>
            {(Object.keys(STAGE_LABEL) as QuestionStage[]).map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled id={`type-${id}`} label="Loại" hint={answered ? "Đã có học sinh trả lời: không đổi loại." : undefined}>
          <select
            id={`type-${id}`}
            className={selectClass}
            value={q.type}
            disabled={answered}
            onChange={(e) => set("type", e.target.value as QuestionType)}
          >
            {STAGE_TYPES[q.stage].map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Labeled>
        {q.stage === "DURING" ? (
          <Labeled id={`seg-${id}`} label="Phân đoạn">
            <select id={`seg-${id}`} className={selectClass} value={q.segmentId ?? ""} onChange={(e) => set("segmentId", e.target.value || null)}>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Labeled>
        ) : null}
      </div>

      <Labeled id={`prompt-${id}`} label={q.type === "ESSAY" ? "Đề bài" : "Câu hỏi"}>
        <textarea id={`prompt-${id}`} rows={2} className={areaClass} value={q.prompt} onChange={(e) => set("prompt", e.target.value)} />
      </Labeled>

      {q.type !== "PREDICTION" ? (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={q.required} onChange={(e) => set("required", e.target.checked)} className="size-4 accent-primary" />
          Bắt buộc để hoàn thành tác phẩm
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">Câu dự đoán không chấm và không bắt buộc; AI so sánh với nội dung khi học sinh đọc xong.</p>
      )}

      {q.type === "MCQ" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Lựa chọn (chọn đáp án đúng)</legend>
          {q.options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${id}`}
                checked={q.correctIndex === i}
                onChange={() => set("correctIndex", i)}
                aria-label={`Đáp án đúng là lựa chọn ${i + 1}`}
                className="size-4 accent-primary"
              />
              <input
                value={option}
                onChange={(e) => set("options", q.options.map((o, j) => (j === i ? e.target.value : o)))}
                placeholder={`Lựa chọn ${i + 1}${i >= 2 ? " (không bắt buộc)" : ""}`}
                aria-label={`Lựa chọn ${i + 1}`}
                className={cn(selectClass, "flex-1")}
              />
            </div>
          ))}
          <Labeled id={`expl-${id}`} label="Giải thích (hiện sau khi trả lời)">
            <textarea id={`expl-${id}`} rows={2} className={areaClass} value={q.explanation ?? ""} onChange={(e) => set("explanation", e.target.value || null)} />
          </Labeled>
        </fieldset>
      ) : null}

      {open ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 flex w-full items-center justify-between gap-2 text-sm font-medium">
            Rubric 3 mức và ý chính
            <Button type="button" size="xs" variant="outline" onClick={aiRubric} disabled={busy}>
              <Sparkles aria-hidden /> AI soạn rubric
            </Button>
          </legend>
          {(
            [
              ["rubricChuaDat", "Chưa đạt"],
              ["rubricDat", "Đạt"],
              ["rubricSauSac", "Sâu sắc"],
            ] as const
          ).map(([key, label]) => (
            <Labeled key={key} id={`${key}-${id}`} label={label}>
              <textarea id={`${key}-${id}`} rows={2} className={areaClass} value={q[key] ?? ""} onChange={(e) => set(key, e.target.value || null)} />
            </Labeled>
          ))}
          <Labeled id={`kp-${id}`} label="Ý chính mẫu (mỗi dòng một ý)">
            <textarea
              id={`kp-${id}`}
              rows={3}
              className={areaClass}
              value={q.keyPoints.join("\n")}
              onChange={(e) => set("keyPoints", e.target.value.split("\n"))}
            />
          </Labeled>
        </fieldset>
      ) : null}

      {q.type === "ESSAY" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
          <Labeled id={`outline-${id}`} label="Dàn ý gợi ý (hiện cho học sinh)">
            <textarea id={`outline-${id}`} rows={3} className={areaClass} value={q.outline ?? ""} onChange={(e) => set("outline", e.target.value || null)} />
          </Labeled>
          <Labeled id={`min-${id}`} label="Số chữ tối thiểu" hint="Mặc định 150">
            <input
              id={`min-${id}`}
              type="number"
              className={selectClass}
              value={q.minWords ?? ""}
              onChange={(e) => set("minWords", e.target.value ? Number(e.target.value) : null)}
            />
          </Labeled>
          <Labeled id={`max-${id}`} label="Số chữ tối đa" hint="Mặc định 300">
            <input
              id={`max-${id}`}
              type="number"
              className={selectClass}
              value={q.maxWords ?? ""}
              onChange={(e) => set("maxWords", e.target.value ? Number(e.target.value) : null)}
            />
          </Labeled>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} size="sm">
          {busy ? "Đang lưu…" : questionId ? "Lưu câu hỏi" : "Thêm câu hỏi"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDone()} disabled={busy}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

export type QuestionRowData = {
  id: string;
  input: QuestionInput;
  stage: QuestionStage;
  type: QuestionType;
  prompt: string;
  required: boolean;
  segmentLabel: string | null;
  answers: number;
  summary: string | null;
};

export function QuestionRow({ workId, row, segments }: { workId: string; row: QuestionRowData; segments: SegmentChoice[] }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const remove = () => {
    if (!confirm("Xóa câu hỏi này?")) return;
    startTransition(async () => {
      const result = await deleteQuestionAction(row.id);
      setMessage(result.ok ? null : result.error);
    });
  };
  if (editing) {
    return (
      <QuestionForm
        workId={workId}
        questionId={row.id}
        initial={row.input}
        segments={segments}
        answered={row.answers > 0}
        onDone={(m) => {
          setEditing(false);
          setMessage(m ?? null);
        }}
      />
    );
  }
  return (
    <div className="grid gap-1 rounded-2xl border-2 bg-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{TYPE_LABEL[row.type]}</span>
        {row.segmentLabel ? <span className="rounded-full border-2 px-2 py-0.5 text-xs font-bold">{row.segmentLabel}</span> : null}
        {row.required ? <span className="text-xs font-bold text-brand-orange">Bắt buộc</span> : null}
        <span className="ml-auto text-xs text-muted-foreground">{row.answers} câu trả lời</span>
        <Button variant="ghost" size="icon-sm" aria-label="Sửa câu hỏi" onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Xóa câu hỏi" onClick={remove} disabled={busy}>
          <Trash2 />
        </Button>
      </div>
      <p className="font-semibold">{row.prompt}</p>
      {row.summary ? <p className="text-sm text-muted-foreground">{row.summary}</p> : null}
      {message ? (
        <p role="status" className="text-sm font-semibold text-primary">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function NewQuestion({ workId, segments }: { workId: string; segments: SegmentChoice[] }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)} variant="outline">
          <Plus aria-hidden /> Thêm câu hỏi
        </Button>
        {message ? (
          <p role="status" className="text-sm font-semibold text-primary">
            {message}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <QuestionForm
      workId={workId}
      initial={emptyQuestion("DURING", segments[0]?.id ?? null)}
      segments={segments}
      onDone={(m) => {
        setOpen(false);
        setMessage(m ?? null);
      }}
    />
  );
}

/** "AI soạn nháp": a full question set to review; only checked drafts are saved. */
export function AiQuestionDrafts({ workId, disabled }: { workId: string; disabled: boolean }) {
  const [rows, setRows] = useState<QuestionDraftRow[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await draftQuestionsAction(workId);
      if (!result.ok) return setMessage(result.error);
      setRows(result.data);
      setPicked(new Set(result.data.map((_, i) => i)));
    });

  const add = () =>
    startTransition(async () => {
      const inputs = (rows ?? []).filter((_, i) => picked.has(i)).map((r) => r.input);
      const result = await addDraftQuestionsAction(workId, inputs);
      if (!result.ok) return setMessage(result.error);
      setRows(null);
      setMessage(`Đã thêm ${result.data} câu hỏi. Hãy đọc lại và sửa cho phù hợp.`);
    });

  return (
    <section className="grid gap-3 rounded-2xl border-2 border-brand-purple/40 bg-brand-purple/5 p-4" aria-labelledby="ai-drafts-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-drafts-heading" className="flex items-center gap-2 font-bold">
          <Sparkles className="size-5 text-brand-purple" aria-hidden /> AI soạn nháp bộ câu hỏi
        </h2>
        {rows ? null : (
          <Button size="sm" variant="outline" onClick={generate} disabled={busy || disabled}>
            {busy ? "AI đang đọc tác phẩm…" : "Soạn nháp"}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {disabled
          ? "Cần có văn bản trước khi AI soạn câu hỏi."
          : "AI đọc toàn văn và đề xuất câu hỏi cho 3 giai đoạn, kèm rubric và ý chính. Bạn chọn câu muốn giữ; câu được thêm vẫn sửa được."}
      </p>
      {message ? (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      ) : null}
      {rows ? (
        <>
          <ul className="grid gap-2">
            {rows.map((r, i) => (
              <li key={i}>
                <label className="flex cursor-pointer gap-3 rounded-xl border-2 bg-card p-3 has-checked:border-brand-purple">
                  <input
                    type="checkbox"
                    checked={picked.has(i)}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="grid gap-1 text-sm">
                    <span className="text-xs font-bold text-muted-foreground">
                      {STAGE_LABEL[r.draft.stage]} · {TYPE_LABEL[r.draft.type]}
                      {r.segmentLabel ? ` · ${r.segmentLabel}` : ""}
                    </span>
                    <span className="font-semibold">{r.draft.prompt}</span>
                    {r.draft.options ? (
                      <span className="text-muted-foreground">
                        {r.draft.options.map((o, j) => `${j === r.draft.correctIndex ? "✓ " : ""}${o}`).join(" · ")}
                      </span>
                    ) : null}
                    {r.draft.rubric ? <span className="text-muted-foreground">Đạt: {r.draft.rubric.dat}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={add} disabled={busy || picked.size === 0}>
              {busy ? "Đang thêm…" : `Thêm ${picked.size} câu đã chọn`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRows(null)} disabled={busy}>
              Bỏ bản nháp
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
