import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { HighlightColor } from "@/generated/prisma/enums";
import { PageSkeleton } from "@/components/app-shell";
import { Mascot } from "@/components/mascot/mascot";
import { cn } from "@/lib/utils";
import { getClassHighlights, type HeatSegment } from "@/server/services/teacher";
import { loadForTeacher } from "../load";
import { formatDayMonth } from "@/lib/vn-date";

export const metadata: Metadata = { title: "Highlight của lớp" };

const COLOR = {
  YELLOW: { label: "Ấn tượng", swatch: "var(--hl-yellow)" },
  BLUE: { label: "Thắc mắc", swatch: "var(--hl-blue)" },
  PINK: { label: "Cảm xúc", swatch: "var(--hl-pink)" },
  PURPLE: { label: "Nghệ thuật", swatch: "var(--hl-purple)" },
} satisfies Record<HighlightColor, { label: string; swatch: string }>;

/** Sequential scale, one hue (orange), light → dark with the share of students. */
const HEAT_STEPS = [16, 32, 52, 74];
const heatStep = (count: number, max: number) =>
  count <= 0 || max <= 0 ? -1 : Math.min(HEAT_STEPS.length - 1, Math.ceil((count / max) * HEAT_STEPS.length) - 1);
const heatColor = (step: number) => `color-mix(in oklch, var(--brand-orange) ${HEAT_STEPS[step]}%, transparent)`;

export default function ClassHighlightsPage({ params, searchParams }: PageProps<"/teacher/classes/[classId]/highlights">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Highlights params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Highlights({ params, searchParams }: PageProps<"/teacher/classes/[classId]/highlights">) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const workId = typeof query.work === "string" ? query.work : undefined;
  const data = await loadForTeacher((user) => getClassHighlights(user, classId, workId));

  if (!data.selected || !data.heat) {
    return (
      <div className="grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center">
        <Mascot pose="read" size={96} label="" />
        <p className="font-bold">Lớp chưa có highlight nào</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Khi học sinh tô sáng trong lúc đọc, những đoạn được nhiều em chú ý sẽ hiện ở đây. Highlight riêng tư không bao giờ hiển
          thị.
        </p>
      </div>
    );
  }
  const heat = data.heat;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section className="grid min-w-0 gap-4" aria-labelledby="heat-heading">
        <div className="grid gap-1">
          <h2 id="heat-heading" className="text-2xl font-semibold">
            Đoạn được tô nhiều nhất
          </h2>
          <p className="text-sm text-muted-foreground">
            Màu càng đậm, càng nhiều học sinh tô đoạn đó. {heat.students} học sinh đã tô sáng tác phẩm này (không tính highlight
            riêng tư).
          </p>
        </div>

        {data.works.length > 1 ? (
          <nav aria-label="Chọn tác phẩm" className="flex flex-wrap gap-2">
            {data.works.map((w) => (
              <Link
                key={w.id}
                href={`/teacher/classes/${classId}/highlights?work=${w.id}`}
                aria-current={w.id === data.selected!.id ? "page" : undefined}
                className={cn(
                  "rounded-full border-2 px-3 py-1 text-sm font-bold hover:bg-muted",
                  w.id === data.selected!.id && "border-primary bg-primary/10 hover:bg-primary/10",
                )}
              >
                {w.title} <span className="font-semibold text-muted-foreground tabular-nums">· {w.count}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <HeatLegend max={heat.maxCount} />

        {heat.passages.length > 0 ? (
          <ol className="grid gap-2" aria-label="Top đoạn được tô">
            {heat.passages.map((p, i) => (
              <li key={`${p.segmentTitle}-${p.start}`} className="flex gap-3 rounded-2xl border-2 bg-card p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-orange font-extrabold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-heading leading-relaxed">“{p.quote.length > 240 ? `${p.quote.slice(0, 240)}…` : p.quote}”</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {p.segmentTitle} · {p.students} học sinh tô
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="grid gap-5 rounded-2xl border-2 bg-card p-5">
          <h3 className="font-heading text-xl font-semibold">{data.selected.title}</h3>
          {heat.segments.map((s) => (
            <HeatText key={s.id} segment={s} max={heat.maxCount} />
          ))}
        </div>
      </section>

      <aside className="grid gap-3" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="text-lg font-semibold">
          Ghi chú gần đây
        </h2>
        {data.feed.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground">Chưa có highlight nào kèm ghi chú.</p>
        ) : (
          <ul className="grid gap-3">
            {data.feed.map((h) => (
              <li key={h.id} className="grid gap-2 rounded-2xl border-2 bg-card p-4">
                <p className="text-sm">
                  <span className="rounded px-0.5" style={{ background: COLOR[h.color].swatch }}>
                    “{h.quote.length > 160 ? `${h.quote.slice(0, 160)}…` : h.quote}”
                  </span>
                </p>
                <p className="text-sm font-semibold">{h.note}</p>
                <p className="text-xs text-muted-foreground">
                  {h.student} · {COLOR[h.color].label} · {h.work}, {h.segment} · {formatDayMonth(h.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Highlight học sinh đánh dấu riêng tư không hiển thị với giáo viên.
        </p>
      </aside>
    </div>
  );
}

function HeatLegend({ max }: { max: number }) {
  if (max <= 0) return null;
  // Step i holds the counts c with i < 4c/max <= i + 1 (see heatStep).
  const steps = HEAT_STEPS.map((_, i) => {
    const from = Math.floor((i * max) / HEAT_STEPS.length) + 1;
    const to = Math.floor(((i + 1) * max) / HEAT_STEPS.length);
    return { i, from, to, text: from === to ? `${to}` : `${from}–${to}` };
  }).filter((s) => s.from <= s.to);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold text-muted-foreground">Số học sinh tô:</span>
      {steps.map((s) => (
        <span key={s.i} className="flex items-center gap-1">
          <span aria-hidden className="h-3 w-6 rounded" style={{ background: heatColor(s.i) }} />
          <span className="tabular-nums">{s.text}</span>
        </span>
      ))}
    </div>
  );
}

function HeatText({ segment, max }: { segment: HeatSegment; max: number }) {
  return (
    <section className="grid gap-1.5">
      <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{segment.title}</h4>
      <p className="font-heading text-[1.05rem] leading-loose whitespace-pre-wrap">
        {segment.runs.map((run) => {
          const text = segment.text.slice(run.start, run.end);
          const step = heatStep(run.count, max);
          if (step < 0) return <span key={run.start}>{text}</span>;
          return (
            <mark
              key={run.start}
              title={`${run.count} học sinh tô`}
              className="rounded-sm text-inherit"
              style={{ background: heatColor(step) }}
            >
              {text}
            </mark>
          );
        })}
      </p>
    </section>
  );
}
