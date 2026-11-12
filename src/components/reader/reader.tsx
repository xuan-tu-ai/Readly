"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { HighlightColor } from "@/generated/prisma/enums";
import {
  createHighlightAction,
  deleteHighlightAction,
  updateHighlightAction,
  updateReadingSettingsAction,
} from "@/app/actions/reading";
import { Mascot } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { READING_FONTS, toneOf } from "@/lib/reading/appearance";
import { cn } from "@/lib/utils";
import type { OwnHighlight, ReaderData } from "@/server/services/reading";
import {
  ActiveToolbar,
  COLOR_OPTIONS,
  PendingToolbar,
} from "./highlight-toolbar";
import { MiniGameCard } from "@/components/gamification/mini-game-card";
import { QuestionCard } from "./question-card";
import { ReaderSettings, type ReaderSettingsValue } from "./reader-settings";
import { TocSheet } from "./toc-sheet";
import { highlightsSupported, useHighlighter } from "./use-highlighter";
import { useQuestions } from "./use-questions";
import { usePager } from "./use-pager";
import { useReadingTracker } from "./use-reading-tracker";

/** Segment HTML is rendered once and never re-rendered, so text offsets stay stable. */
const SegmentText = memo(function SegmentText({
  id,
  html,
}: {
  id: string;
  html: string;
}) {
  return (
    <div
      className="reader-text"
      data-segment-text={id}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export function Reader({
  data,
  startAt,
  focus,
}: {
  data: ReaderData;
  startAt?: string;
  /** A passage to mark (a quote opened from the discussion). */
  focus?: { segmentId: string; start: number; end: number };
}) {
  const { work, segments } = data;
  const headerRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

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

  const paged = settings.pageMode === "PAGED";

  const segmentIds = useMemo(() => segments.map((s) => s.id), [segments]);
  const initialPosition = useMemo(() => {
    // A segment picked on the work page ("?seg=") wins over the saved position.
    if (startAt && segments.some((s) => s.id === startAt))
      return { segmentId: startAt, fraction: 0 };
    return data.progress?.segmentId
      ? {
          segmentId: data.progress.segmentId,
          fraction: data.progress.segmentFraction,
        }
      : null;
  }, [data.progress, segments, startAt]);
  const { readIds, currentId, jumpTo, getPosition } = useReadingTracker({
    segmentIds,
    initialRead: data.readSegmentIds,
    initialPosition,
    headerRef,
    pagesRef,
    paged,
  });
  const relayout = useCallback(() => {
    const position = getPosition();
    if (position) jumpTo(position);
  }, [getPosition, jumpTo]);
  const { page, pageCount, turn } = usePager(pagesRef, paged, relayout);

  // A quote opened from the discussion: bring its segment into view, also when
  // this page is shown again from the router cache (effects re-run then).
  const focusSegment = focus?.segmentId;
  useEffect(() => {
    if (!focusSegment) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => jumpTo({ segmentId: focusSegment, fraction: 0 }));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [focusSegment, jumpTo]);

  // ── Questions ──
  const { pre, post, bySegment, owedSegments, completion, submit } =
    useQuestions(data, readIds.size);

  // ── Highlights ──
  const [highlights, setHighlights] = useState<OwnHighlight[]>(data.highlights);
  const { pending, activeId, setActiveId, setPending, clear } = useHighlighter({
    rootRef: articleRef,
    focus,
    highlights,
  });
  const [busy, startTransition] = useTransition();
  const active = highlights.find((h) => h.id === activeId) ?? null;
  // Errors belong to the selection they happened on; selecting something else hides them.
  const selectionKey =
    activeId ??
    (pending ? `${pending.segmentId}:${pending.start}-${pending.end}` : null);
  const [failure, setFailure] = useState<{
    key: string | null;
    message: string;
  } | null>(null);
  const error =
    failure && failure.key === selectionKey ? failure.message : null;
  const setError = (message: string) =>
    setFailure({ key: selectionKey, message });

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

  const updateActive = (
    patch: Partial<Pick<OwnHighlight, "color" | "note" | "isPrivate">>,
  ) => {
    if (!active) return;
    startTransition(async () => {
      const result = await updateHighlightAction({ id: active.id, ...patch });
      if (!result.ok) return setError(result.error);
      setHighlights((prev) =>
        prev.map((h) => (h.id === result.data.id ? result.data : h)),
      );
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

  /** "Thảo luận đoạn này": open the class discussion with the passage quoted. */
  const discussHref = (span: { segmentId: string; start: number; end: number }) =>
    `/student/works/${work.slug}/discussion?seg=${span.segmentId}&start=${span.start}&end=${span.end}`;

  const jumpToSegment = useCallback(
    (segmentId: string) => jumpTo({ segmentId, fraction: 0 }),
    [jumpTo],
  );

  const percent = segments.length
    ? Math.round((readIds.size / segments.length) * 100)
    : 0;
  const currentHighlights = highlights.filter((h) => h.segmentId === currentId);
  const currentSegment = segments.find((s) => s.id === currentId);

  const tone = toneOf(settings);
  const fontCss = READING_FONTS.find((f) => f.value === settings.font)?.css;

  const preReading =
    work.background || pre.length > 0 ? (
      <section
        aria-labelledby="pre-reading"
        className="mb-10 grid gap-3 font-sans text-base leading-normal"
      >
        <h2
          id="pre-reading"
          className="text-sm font-extrabold tracking-wider uppercase opacity-70"
        >
          Trước khi đọc
        </h2>
        {work.background ? (
          <div
            className="rounded-2xl border-2 bg-card p-4 text-sm text-card-foreground [&_p]:mb-2 last:[&_p]:mb-0"
            dangerouslySetInnerHTML={{ __html: work.background }}
          />
        ) : null}
        {pre.map((q) => (
          <QuestionCard key={q.id} question={q} onSubmit={submit} />
        ))}
      </section>
    ) : null;

  const body = (
    <>
      <h1 className="mb-1 font-heading text-[1.6em] leading-tight font-semibold">
        {work.title}
      </h1>
      <p className="mb-8 text-[0.85em] opacity-70">{work.author}</p>
      {preReading}
      {segments.map((segment) => (
        <section
          key={segment.id}
          id={`seg-${segment.id}`}
          aria-label={segment.title ?? `Phần ${segment.order}`}
          className="scroll-mt-20 pb-6"
        >
          {segment.title ? (
            <h2 className="mb-3 font-sans text-[0.75em] font-extrabold tracking-wider uppercase opacity-60">
              {segment.title}
            </h2>
          ) : null}
          <SegmentText id={segment.id} html={segment.content} />
          <div data-end-of={segment.id} aria-hidden className="h-px" />
          {bySegment.get(segment.id)?.length ? (
            <div
              className={cn(
                "mt-4 grid gap-3 font-sans text-base leading-normal",
                !paged && "lg:hidden",
              )}
            >
              {bySegment.get(segment.id)!.map((q) => (
                <QuestionCard key={q.id} question={q} onSubmit={submit} />
              ))}
            </div>
          ) : null}
          {data.games
            .filter((g) => g.unlockSegmentId === segment.id)
            .map((g) => (
              <MiniGameCard
                key={g.id}
                game={g}
                unlocked={readIds.has(segment.id)}
                className="mt-4 text-base leading-normal"
              />
            ))}
        </section>
      ))}
      <section
        aria-labelledby="post-reading"
        className="mt-6 grid gap-3 font-sans text-base leading-normal"
      >
        <h2
          id="post-reading"
          className="text-sm font-extrabold tracking-wider uppercase opacity-70"
        >
          Sau khi đọc
        </h2>
        <CompletionBanner completion={completion} />
        {post.map((q) => (
          <QuestionCard key={q.id} question={q} onSubmit={submit} />
        ))}
        <p className="text-center text-sm font-bold opacity-80">
          <Link
            href={`/student/works/${work.slug}`}
            className="underline underline-offset-4"
          >
            Về trang tác phẩm
          </Link>
        </p>
      </section>
    </>
  );

  return (
    <div
      className={cn(
        "reader-surface",
        paged ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh",
      )}
      data-theme={settings.theme}
      data-backdrop={settings.backdrop}
      data-tone={tone}
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-20 flex items-center gap-1 border-b border-current/10 bg-(--reader-chrome)/85 px-2 py-2 backdrop-blur md:px-4"
      >
        <Link
          href={`/student/works/${work.slug}`}
          className={buttonVariants({
            variant: "ghost",
            size: "icon-sm",
            className: "hover:bg-current/10 hover:text-current",
          })}
          aria-label="Đóng trình đọc"
        >
          <X />
        </Link>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-sm font-bold">{work.title}</p>
          <p className="truncate text-xs opacity-60">
            {currentSegment?.title ?? work.author}
          </p>
        </div>
        {completion.completedAt ? (
          <span className="hidden items-center gap-1 text-xs font-bold text-emerald-600 sm:flex">
            <CheckCircle2 className="size-4" aria-hidden /> Đã hoàn thành
          </span>
        ) : null}
        <div className="flex [&_button]:hover:bg-current/10 [&_button]:hover:text-current">
          <TocSheet
            segments={segments}
            readIds={readIds}
            owedIds={owedSegments}
            currentId={currentId}
            onJump={jumpToSegment}
          />
          <ReaderSettings value={settings} onChange={setSettings} />
        </div>
      </header>

      {paged ? (
        <div className="relative min-h-0 flex-1">
          <div className="mx-auto h-full max-w-6xl px-6 sm:px-16">
            {/* The page box: exactly one page wide; columns overflow to its right. */}
            <div ref={pagesRef} className="h-full overflow-hidden">
              <article
                ref={articleRef}
                className="reader-pages py-8 [column-count:1] [--page-gap:3rem] lg:[column-count:2] lg:[--page-gap:5rem]"
                style={{
                  fontSize: settings.fontSize,
                  lineHeight: settings.lineHeight,
                  ["--reader-font" as string]: fontCss,
                }}
              >
                {body}
              </article>
            </div>
          </div>
          <PageButton
            side="left"
            disabled={page === 0}
            onClick={() => turn(-1)}
          />
          <PageButton
            side="right"
            disabled={page >= pageCount - 1}
            onClick={() => turn(1)}
          />
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <article
            ref={articleRef}
            className="mx-auto w-full max-w-[42rem] pb-24"
            style={{
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
              ["--reader-font" as string]: fontCss,
            }}
          >
            {body}
          </article>

          <aside className="hidden font-sans lg:block">
            <div className="sticky top-20 grid max-h-[calc(100dvh-6rem)] gap-3 overflow-y-auto rounded-2xl border-2 border-current/10 bg-(--reader-chrome)/70 p-4 backdrop-blur">
              <p className="text-xs font-extrabold tracking-wider uppercase opacity-60">
                Đang đọc
              </p>
              <p className="font-bold">{currentSegment?.title ?? work.title}</p>
              {currentId && bySegment.get(currentId)?.length ? (
                <div className="grid gap-3">
                  <p className="text-xs font-bold opacity-60">
                    Câu hỏi cho phần này
                  </p>
                  {bySegment.get(currentId)!.map((q) => (
                    <QuestionCard key={q.id} question={q} onSubmit={submit} />
                  ))}
                </div>
              ) : null}
              <p className="text-xs font-bold opacity-60">
                Đoạn bạn đã tô sáng ở đây
              </p>
              {currentHighlights.length === 0 ? (
                <p className="text-sm opacity-70">
                  Kéo để chọn, hoặc chạm vào một câu để tô sáng.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {currentHighlights.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(h.id)}
                        className="w-full rounded-lg border-l-4 bg-current/5 px-2 py-1.5 text-left text-sm hover:bg-current/10"
                        style={{
                          borderColor: `var(--hl-${h.color.toLowerCase()})`,
                        }}
                      >
                        <span className="line-clamp-2">{h.quote}</span>
                        {h.note ? (
                          <span className="mt-1 block text-xs opacity-70">
                            ✎ {h.note}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs opacity-60">
                Màu:{" "}
                {COLOR_OPTIONS.map((c) => c.label.toLowerCase()).join(", ")}.
              </p>
            </div>
          </aside>
        </div>
      )}

      <footer
        className={cn(
          "z-10 flex items-center gap-3 border-t border-current/10 bg-(--reader-chrome)/85 px-4 py-2.5 font-sans text-xs font-bold backdrop-blur",
          !paged && "fixed inset-x-0 bottom-0",
        )}
      >
        {paged ? <FooterPageButton side="left" disabled={page === 0} onClick={() => turn(-1)} /> : null}
        <span className="hidden min-w-0 truncate opacity-70 sm:block">{currentSegment?.title ?? work.title}</span>
        <ProgressBar
          value={percent}
          label="Tiến độ đọc"
          className="h-2.5 flex-1 bg-current/10"
        />
        <span className="tabular-nums opacity-70">
          {paged ? `Trang ${page + 1}/${pageCount} · ` : ""}
          {percent}%
        </span>
        {paged ? <FooterPageButton side="right" disabled={page >= pageCount - 1} onClick={() => turn(1)} /> : null}
      </footer>

      {!highlightsSupported() ? null : pending ? (
        <PendingToolbar
          onPick={createHighlight}
          onCancel={clear}
          busy={busy}
          error={error}
          discussHref={discussHref(pending)}
        />
      ) : active ? (
        <ActiveToolbar
          key={active.id}
          highlight={active}
          onUpdate={updateActive}
          onDelete={deleteActive}
          onClose={clear}
          busy={busy}
          error={error}
          discussHref={discussHref(active)}
        />
      ) : null}
    </div>
  );
}

/** Small page-turn buttons in the footer, for phones (the side buttons are hidden there). */
function FooterPageButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Trang trước" : "Trang sau"}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-full bg-current/10 disabled:opacity-30 sm:hidden"
    >
      <Icon className="size-5" />
    </button>
  );
}

function PageButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Trang trước" : "Trang sau"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-neutral-900/70 text-white shadow-lg transition-opacity hover:bg-neutral-900/85 disabled:opacity-0 sm:grid",
        side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4",
      )}
    >
      <Icon className="size-6" />
    </button>
  );
}

function CompletionBanner({
  completion,
}: {
  completion: ReaderData["completion"];
}) {
  if (completion.completedAt) {
    return (
      <div className="flex animate-pop-in items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
        <Mascot pose="cheer" size={72} label="" />
        Tuyệt vời! Bạn đã hoàn thành tác phẩm này. Xem lại dự đoán ban đầu ở
        phần “Trước khi đọc” nhé.
      </div>
    );
  }
  const missingSegments = completion.totalSegments - completion.readSegments;
  const parts = [
    missingSegments > 0 ? `${missingSegments} phân đoạn chưa đọc` : null,
    completion.owedQuestions > 0
      ? `${completion.owedQuestions} câu hỏi bắt buộc chưa xong`
      : null,
  ].filter(Boolean);
  return (
    <p className="rounded-2xl border-2 border-dashed border-current/20 p-4 text-sm opacity-90">
      Để hoàn thành tác phẩm:{" "}
      {parts.length ? parts.join(", ") : "đang cập nhật…"}.
    </p>
  );
}
