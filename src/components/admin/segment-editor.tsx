"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Pencil, Trash2 } from "lucide-react";
import { segmentCommandAction, updateSegmentAction } from "@/app/actions/admin-content";
import { Field, FormAlert, SubmitButton } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { previewHtml } from "@/lib/content/preview";
import { initialFormState } from "@/lib/form-state";
import { Labeled, areaClass } from "./fields";

type Usage = { highlights: number; questions: number; reads: number; unlocksGames: number };

/**
 * One segment: preview, edit (title + sanitised HTML), move, remove. The HTML
 * is edited as text on purpose: it keeps poems' line breaks and italics exact.
 */
export function SegmentEditor({
  segment,
  usage,
  first,
  last,
}: {
  segment: { id: string; order: number; title: string | null; content: string };
  usage: Usage;
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState(segment.content);
  const [state, formAction] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await updateSegmentAction(prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, initialFormState);
  const used = usage.reads + usage.highlights + usage.questions + usage.unlocksGames > 0;
  const command = (name: string, label: string, icon: React.ReactNode, disabled = false, confirmText?: string) => (
    <form
      action={segmentCommandAction}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="command" value={name} />
      <input type="hidden" name="id" value={segment.id} />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label={label} title={label} disabled={disabled}>
        {icon}
      </Button>
    </form>
  );

  return (
    <article className="grid gap-3 rounded-2xl border-2 bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-muted text-sm font-extrabold tabular-nums">{segment.order}</span>
        <h3 className="min-w-0 flex-1 font-bold">{segment.title ?? `Phân đoạn ${segment.order}`}</h3>
        <span className="text-xs text-muted-foreground">
          {usage.questions} câu hỏi · {usage.highlights} highlight · {usage.reads} lượt đọc
        </span>
        <div className="flex">
          {command("up", "Lên trên", <ArrowUp />, first)}
          {command("down", "Xuống dưới", <ArrowDown />, last)}
          <Button variant="ghost" size="icon-sm" aria-label={editing ? "Xem" : "Sửa"} title={editing ? "Xem" : "Sửa"} onClick={() => setEditing((v) => !v)}>
            {editing ? <Eye /> : <Pencil />}
          </Button>
          {command(
            "remove",
            "Xóa phân đoạn",
            <Trash2 />,
            false,
            used
              ? "Phân đoạn đã có học sinh đọc/tô sáng hoặc có câu hỏi: sẽ được lưu trữ (ẩn khỏi trang đọc). Tiếp tục?"
              : "Xóa phân đoạn này?",
          )}
        </div>
      </header>

      {editing ? (
        <form action={formAction} className="grid gap-3" noValidate>
          <input type="hidden" name="segmentId" value={segment.id} />
          <Field label="Tiêu đề" name="title" defaultValue={state.values?.title ?? segment.title ?? ""} placeholder="Ví dụ: Khổ 1, Cảnh 2…" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Labeled id={`html-${segment.id}`} label="Nội dung (HTML)" hint="Dùng <p>, <br />, <em>, <strong>. Thẻ khác bị bỏ khi lưu." error={state.fieldErrors?.html}>
              <textarea
                id={`html-${segment.id}`}
                name="html"
                rows={10}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className={`${areaClass} font-mono text-xs`}
              />
            </Labeled>
            <div className="grid content-start gap-1.5">
              <span className="text-sm font-medium">Xem trước</span>
              {/* Same whitelist as the server applies on save. */}
              <div
                className="max-h-72 overflow-auto rounded-xl border-2 bg-background px-4 py-3 font-heading leading-relaxed [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: previewHtml(html) }}
              />
            </div>
          </div>
          <FormAlert state={state} />
          <div className="flex gap-2">
            <SubmitButton size="sm">Lưu phân đoạn</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div
            className="max-h-48 overflow-hidden font-heading leading-relaxed text-foreground/90 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: segment.content }}
          />
          {state.message ? (
            <p role="status" className="text-sm font-semibold text-primary">
              {state.message}
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}
