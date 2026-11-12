"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileUp, Scissors, Upload } from "lucide-react";
import type { Genre } from "@/generated/prisma/enums";
import { analyzeDocxAction, saveSegmentsAction } from "@/app/actions/admin-content";
import { Button } from "@/components/ui/button";
import { buildSegments, defaultSegmentTitle, type ImportDraft } from "@/lib/content/segmenter";
import { GENRE_LABEL } from "@/lib/catalog";
import { previewHtml } from "@/lib/content/preview";
import { cn } from "@/lib/utils";

/**
 * .docx import (spec §3.3): upload → Readly suggests segment boundaries →
 * the admin merges/splits (toggle the cut between two paragraphs) and names
 * segments → save. Re-importing keeps segment ids by position.
 */
export function ImportWizard({ workId, genre, existingSegments }: { workId: string; genre: Genre; existingSegments: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const analyze = (formData: FormData) =>
    startTransition(async () => {
      setError(null);
      formData.set("genre", genre);
      const result = await analyzeDocxAction(formData);
      if (!result.ok) return setError(result.error);
      const { warnings: w, ...rest } = result.data;
      setDraft(rest);
      setWarnings(w);
    });

  const segments = useMemo(() => (draft ? buildSegments(draft, genre) : []), [draft, genre]);
  /** Segment number of each block (1-based). */
  const segmentOf = useMemo(() => {
    let n = 0;
    return (draft?.blocks ?? []).map((_, i) => (i === 0 || draft!.starts[i] ? ++n : n));
  }, [draft]);

  const toggleCut = (i: number) =>
    setDraft((d) => {
      if (!d || i === 0) return d;
      const starts = [...d.starts];
      starts[i] = !starts[i];
      return { ...d, starts };
    });
  const setTitle = (i: number, title: string) =>
    setDraft((d) => {
      if (!d) return d;
      const titles = [...d.titles];
      titles[i] = title;
      return { ...d, titles };
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveSegmentsAction(workId, segments);
      if (!result.ok) return setError(result.error);
      const { moved, orphaned } = result.data;
      router.push(`/admin/works/${workId}/text?reanchored=${moved}-${orphaned}`);
    });

  if (!draft) {
    return (
      <section className="grid gap-4 rounded-2xl border-2 bg-card p-6" aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="flex items-center gap-2 text-xl font-semibold">
          <FileUp className="size-5" aria-hidden /> Nhập văn bản từ Word (.docx)
        </h2>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
          <li>Giữ nguyên in nghiêng, in đậm và xuống dòng (quan trọng với thơ).</li>
          <li>
            Gợi ý chia phân đoạn theo tiêu đề (Heading), dòng trống{genre === "THO" ? " giữa các khổ" : " (2 dòng trống liền nhau)"}
            {genre === "KICH" ? ", dòng “Cảnh …/Hồi …/Lớp …”" : ""} và dấu “* * *”. Bạn chỉnh lại trước khi lưu.
          </li>
          <li>Thể loại hiện tại: {GENRE_LABEL[genre]}. PDF hãy chuyển sang .docx trước.</li>
          {existingSegments > 0 ? (
            <li className="font-semibold text-foreground">
              Tác phẩm đang có {existingSegments} phân đoạn: nhập lại sẽ thay văn bản theo thứ tự, giữ nguyên phân đoạn, và neo lại highlight.
            </li>
          ) : null}
        </ul>
        <form action={analyze} className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="docx-file">
            Tệp .docx
          </label>
          <input
            id="docx-file"
            name="file"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="text-sm file:mr-3 file:rounded-lg file:border-2 file:bg-muted file:px-3 file:py-1.5 file:font-bold"
          />
          <Button type="submit" disabled={busy}>
            <Upload aria-hidden /> {busy ? "Đang đọc tệp…" : "Đọc tệp"}
          </Button>
        </form>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 bg-card/95 p-4 backdrop-blur md:top-2">
        <p className="text-sm">
          <span className="font-bold">{segments.length} phân đoạn</span> từ {draft.blocks.length} đoạn văn. Bấm{" "}
          <Scissors className="inline size-4" aria-label="kéo" /> giữa hai đoạn để cắt hoặc gộp.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
            Chọn tệp khác
          </Button>
          <Button onClick={save} disabled={busy} className="uppercase">
            {busy ? "Đang lưu…" : "Lưu phân đoạn"}
          </Button>
        </div>
      </div>
      {warnings.length > 0 ? (
        <details className="rounded-xl border-2 px-4 py-2 text-sm">
          <summary className="cursor-pointer font-bold">{warnings.length} ghi chú khi đọc tệp</summary>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {warnings.slice(0, 20).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ol className="grid gap-0">
        {draft.blocks.map((block, i) => {
          const starts = i === 0 || draft.starts[i];
          const segmentNo = segmentOf[i];
          return (
            <li key={i} className="grid">
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleCut(i)}
                  aria-pressed={draft.starts[i]}
                  className={cn(
                    "group my-1 flex items-center gap-2 text-xs font-bold",
                    draft.starts[i] ? "text-brand-orange" : "text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  <span className={cn("h-0.5 flex-1", draft.starts[i] ? "bg-brand-orange" : "bg-border")} aria-hidden />
                  <Scissors className="size-4" aria-hidden />
                  {draft.starts[i] ? "Bỏ cắt (gộp với phân đoạn trên)" : "Cắt ở đây"}
                  <span className={cn("h-0.5 flex-1", draft.starts[i] ? "bg-brand-orange" : "bg-border")} aria-hidden />
                </button>
              ) : null}
              {starts ? (
                <label className="mt-2 flex items-center gap-2 rounded-t-xl border-2 border-b-0 bg-muted/60 px-3 py-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-extrabold text-white">{segmentNo}</span>
                  <span className="sr-only">Tên phân đoạn {segmentNo}</span>
                  <input
                    value={draft.titles[i] ?? ""}
                    placeholder={defaultSegmentTitle(genre, segmentNo)}
                    onChange={(e) => setTitle(i, e.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-lg border-2 bg-background px-2 text-sm font-bold"
                  />
                </label>
              ) : null}
              <div
                className={cn(
                  "border-x-2 bg-card px-4 py-2 font-heading text-[0.95rem] leading-relaxed [&_p]:my-1",
                  starts && "pt-3",
                  (i === draft.blocks.length - 1 || draft.starts[i + 1]) && "rounded-b-xl border-b-2 pb-3",
                )}
                dangerouslySetInnerHTML={{ __html: previewHtml(block.html) }}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
