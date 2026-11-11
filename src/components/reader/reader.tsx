"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import type { HighlightColor } from "@/generated/prisma/enums";
import {
  createHighlightAction,
  deleteHighlightAction,
  updateHighlightAction,
  updateReadingSettingsAction,
} from "@/app/actions/reading";
import { buttonVariants } from "@/components/ui/button";
import type { OwnHighlight, ReaderData } from "@/server/services/reading";
import { ActiveToolbar, COLOR_OPTIONS, PendingToolbar } from "./highlight-toolbar";
import { ReaderSettings, type ReaderSettingsValue } from "./reader-settings";
import { TocSheet } from "./toc-sheet";
import { highlightsSupported, useHighlighter } from "./use-highlighter";
import { scrollToSegment, useReadingTracker } from "./use-reading-tracker";

/** Segment HTML is rendered once and never re-rendered, so text offsets stay stable. */
const SegmentText = memo(function SegmentText({ id, html }: { id: string; html: string }) {
  return <div className="reader-text" data-segment-text={id} dangerouslySetInnerHTML={{ __html: html }} />;
});

export function Reader({ data }: { data: ReaderData }) {
  const { work, segments } = data;
  const headerRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  const segmentIds = useMemo(() => segments.map((s) => s.id), [segments]);
  const initialPosition = useMemo(
    () => (data.progress?.segmentId ? { segmentId: data.progress.segmentId, fraction: data.progress.segmentFraction } : null),
    [data.progress],
  );
  const { readIds, currentId } = useReadingTracker({
    segmentIds,
    initialRead: data.readSegmentIds,
    initialPosition,
    headerRef,
  });

  // ── Settings (saved shortly after the last change) ──
  const [settings, setSettings] = useState<ReaderSettingsValue>(data.settings);
  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    const t = setTimeout(() => void updateReadingSettingsAction(settings), 600);
    return () => clearTimeout(t);
  }, [settings]);

  // ── Highlights ──
  const [highlights, setHighlights] = useState<OwnHighlight[]>(data.highlights);
  const { pending, activeId, setActiveId, setPending, clear } = useHighlighter({ rootRef: articleRef, highlights });
  const [busy, startTransition] = useTransition();
  const active = highlights.find((h) => h.id === activeId) ?? null;
  // Errors belong to the selection they happened on; selecting something else hides them.
  const selectionKey = activeId ?? (pending ? `${pending.segmentId}:${pending.start}-${pending.end}` : null);
  const [failure, setFailure] = useState<{ key: string | null; message: string } | null>(null);
  const error = failure && failure.key === selectionKey ? failure.message : null;
  const setError = (message: string) => setFailure({ key: selectionKey, message });

  const createHighlight = (color: HighlightColor) => {
    if (!pending) return;
    startTransition(async () => {
      const result = await createHighlightAction({ ...pending, color });
      if (!result.ok) return setError(result.error);
      setHighlights((prev) => [...prev, result.data]);
      setPending(null);
      setActiveId(result.data.id);
    });
  };

  const updateActive = (patch: Partial<Pick<OwnHighlight, "color" | "note" | "isPrivate">>) => {
    if (!active) return;
    startTransition(async () => {
      const result = await updateHighlightAction({ id: active.id, ...patch });
      if (!result.ok) return setError(result.error);
      setHighlights((prev) => prev.map((h) => (h.id === result.data.id ? result.data : h)));
    });
  };

  const deleteActive = () => {
    if (!active) return;
    startTransition(async () => {
      const result = await deleteHighlightAction(active.id);
      if (!result.ok) return setError(result.error);
      setHighlights((prev) => prev.filter((h) => h.id !== active.id));
      clear();
    });
  };

  const jumpTo = useCallback((segmentId: string, fraction = 0) => scrollToSegment(segmentId, fraction, headerRef), []);

  const percent = segments.length ? Math.round((readIds.size / segments.length) * 100) : 0;
  const currentHighlights = highlights.filter((h) => h.segmentId === currentId);
  const currentSegment = segments.find((s) => s.id === currentId);

  return (
    <div className="grid gap-4">
      <header
        ref={headerRef}
        className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b bg-background/95 px-2 py-2 backdrop-blur md:-mx-8 md:px-6"
      >
        <Link
          href={`/student/works/${work.slug}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label="Về trang tác phẩm"
        >
          <ChevronLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{work.title}</p>
          <div className="flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Tiến độ đọc"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
          </div>
        </div>
        <TocSheet segments={segments} readIds={readIds} currentId={currentId} onJump={jumpTo} />
        <ReaderSettings value={settings} onChange={setSettings} />
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8">
        <article
          ref={articleRef}
          data-theme={settings.theme}
          className="reader-surface rounded-xl px-5 py-6 sm:px-8 md:px-12 md:py-10"
          style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
        >
          <h1 className="mb-1 text-[1.6em] leading-tight font-semibold">{work.title}</h1>
          <p className="mb-8 text-[0.85em] opacity-70">{work.author}</p>
          {segments.map((segment) => (
            <section key={segment.id} id={`seg-${segment.id}`} aria-label={segment.title ?? `Phần ${segment.order}`} className="scroll-mt-20 pb-6">
              {segment.title ? (
                <h2 className="mb-3 text-[0.8em] font-semibold tracking-wide uppercase opacity-60">{segment.title}</h2>
              ) : null}
              <SegmentText id={segment.id} html={segment.content} />
              <div data-end-of={segment.id} aria-hidden className="h-px" />
            </section>
          ))}
          <div className="mt-6 rounded-lg border border-dashed p-4 text-center text-[0.85em] opacity-80">
            Bạn đã đến cuối tác phẩm.{" "}
            <Link href="/student/library" className="underline underline-offset-4">
              Về thư viện
            </Link>
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-20 grid gap-3 rounded-xl border p-4">
            <p className="text-xs font-medium text-muted-foreground">Đang đọc</p>
            <p className="font-medium">{currentSegment?.title ?? work.title}</p>
            <p className="text-xs font-medium text-muted-foreground">Đoạn bạn đã tô sáng ở đây</p>
            {currentHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Kéo để chọn, hoặc chạm vào một câu để tô sáng.
              </p>
            ) : (
              <ul className="grid gap-2">
                {currentHighlights.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(h.id)}
                      className="w-full rounded-md border-l-4 bg-muted/50 px-2 py-1.5 text-left text-sm hover:bg-muted"
                      style={{ borderColor: `var(--hl-${h.color.toLowerCase()})` }}
                    >
                      <span className="line-clamp-2">{h.quote}</span>
                      {h.note ? <span className="mt-1 block text-xs text-muted-foreground">✎ {h.note}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Màu: {COLOR_OPTIONS.map((c) => c.label.toLowerCase()).join(", ")}.
            </p>
          </div>
        </aside>
      </div>

      {!highlightsSupported() ? null : pending ? (
        <PendingToolbar onPick={createHighlight} onCancel={clear} busy={busy} error={error} />
      ) : active ? (
        <ActiveToolbar
          key={active.id}
          highlight={active}
          onUpdate={updateActive}
          onDelete={deleteActive}
          onClose={clear}
          busy={busy}
          error={error}
        />
      ) : null}
    </div>
  );
}
