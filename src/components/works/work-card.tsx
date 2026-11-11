import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GENRE_LABEL, difficultyLabel, formatMinutes } from "@/lib/catalog";
import type { WorkCard as WorkCardData } from "@/server/services/works";
import { WorkCover } from "./work-cover";

export function WorkCard({ work, note }: { work: WorkCardData; note?: string }) {
  const comingSoon = work.status === "COMING_SOON";
  return (
    <Link
      href={`/student/works/${work.slug}`}
      className="group grid gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="relative">
        <WorkCover
          title={work.title}
          genre={work.genre}
          coverUrl={work.coverUrl}
          className={comingSoon ? "opacity-60 transition-opacity group-hover:opacity-80" : "transition-transform group-hover:-translate-y-0.5"}
        />
        {comingSoon ? (
          <Badge variant="secondary" className="absolute top-2 right-2">
            Sắp có
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-0.5">
        <p className="line-clamp-2 font-medium leading-snug group-hover:underline">{work.title}</p>
        <p className="truncate text-sm text-muted-foreground">{work.author}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {formatMinutes(work.estMinutes)} · {difficultyLabel(work.difficulty)} · {GENRE_LABEL[work.genre]}
        </p>
        {note ? <p className="mt-1 text-xs text-primary">{note}</p> : null}
      </div>
    </Link>
  );
}

export function WorkGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>;
}
