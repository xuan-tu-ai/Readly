import Link from "next/link";
import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { difficultyLabel, formatMinutes } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { WorkCard as WorkCardData } from "@/server/services/works";
import { WorkCover } from "./work-cover";

export function WorkCard({ work, note }: { work: WorkCardData; note?: string }) {
  const comingSoon = work.status === "COMING_SOON";
  return (
    <Link
      href={`/student/works/${work.slug}`}
      className="group grid gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="relative">
        <WorkCover
          title={work.title}
          genre={work.genre}
          coverUrl={work.coverUrl}
          className={cn(
            "transition-transform duration-200",
            comingSoon ? "opacity-60 saturate-50 group-hover:opacity-80" : "group-hover:-translate-y-1 group-hover:rotate-[-1.5deg]",
          )}
        />
        {comingSoon ? (
          <Badge variant="secondary" className="absolute top-2 right-2 border-2 bg-card">
            Sắp có
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-0.5">
        <p className="line-clamp-2 font-bold leading-snug group-hover:text-primary">{work.title}</p>
        <p className="truncate text-sm text-muted-foreground">{work.author}</p>
        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {formatMinutes(work.estMinutes)} · {difficultyLabel(work.difficulty)}
        </p>
        {note ? <p className="mt-1 text-xs font-medium text-primary">{note}</p> : null}
      </div>
    </Link>
  );
}

export function WorkGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</ul>;
}

/** Horizontally scrolling shelf (snaps per card; scrollbar hidden). */
export function WorkShelf({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none] md:-mx-10 md:scroll-px-10 md:px-10 [&::-webkit-scrollbar]:hidden [&>li]:w-36 [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-40"
    >
      {children}
    </ul>
  );
}
