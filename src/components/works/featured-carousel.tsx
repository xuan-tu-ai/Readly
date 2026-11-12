"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GENRE_LABEL, difficultyLabel, formatMinutes } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { FeaturedWork } from "@/server/services/works";
import { GENRE_COLOR, WorkCover } from "./work-cover";

const ROTATE_MS = 7_000;

/** Waka-style hero: one featured work at a time, with its neighbours peeking behind. */
export function FeaturedCarousel({ works }: { works: FeaturedWork[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = works.length;

  useEffect(() => {
    if (paused || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  if (count === 0) return null;
  const work = works[index];
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const next = works[(index + 1) % count];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Tác phẩm nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative isolate overflow-hidden rounded-3xl bg-[#1f2230] text-white"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 transition-[background] duration-700"
        style={{
          background: `radial-gradient(120% 90% at 85% 30%, ${GENRE_COLOR[work.genre]} 0%, transparent 60%)`,
        }}
      />
      <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:p-10">
        <div key={work.id} className="grid animate-rise-in content-start gap-3" aria-live="polite">
          <span className="w-fit rounded-md bg-white/15 px-2 py-1 text-[0.7rem] font-bold tracking-widest uppercase">
            Readly đề xuất · {GENRE_LABEL[work.genre]}
          </span>
          <h2 className="font-heading text-3xl leading-tight font-semibold sm:text-4xl">{work.title}</h2>
          <p className="text-sm font-medium text-white/70">
            {work.author} · {formatMinutes(work.estMinutes)} · {difficultyLabel(work.difficulty)}
          </p>
          <p className="line-clamp-3 max-w-prose text-white/85">{work.summary}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href={`/student/works/${work.slug}`}
              className={buttonVariants({ size: "lg", className: "uppercase" })}
            >
              <BookOpen aria-hidden /> Đọc sách
            </Link>
          </div>
        </div>

        <div className="relative hidden h-72 md:block" aria-hidden>
          {count > 1 ? (
            <WorkCover
              title={next.title}
              genre={next.genre}
              coverUrl={next.coverUrl}
              className="absolute top-8 right-0 w-36 rotate-6 opacity-50 blur-[1px]"
            />
          ) : null}
          <WorkCover
            key={work.id}
            title={work.title}
            genre={work.genre}
            coverUrl={work.coverUrl}
            className="absolute top-0 right-16 w-48 animate-pop-in -rotate-3 shadow-2xl ring-4 ring-white/90"
          />
        </div>
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-between gap-3 px-6 pb-6 sm:px-8 md:px-10">
          <div className="flex gap-1.5">
            {works.map((w, i) => (
              <button
                key={w.id}
                type="button"
                aria-label={`Xem ${w.title}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-2 bg-white/35 hover:bg-white/60")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Tác phẩm trước"
              onClick={() => go(-1)}
              className="grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Tác phẩm tiếp theo"
              onClick={() => go(1)}
              className="grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
