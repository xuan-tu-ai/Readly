import { BookOpen, Drama, Feather, Landmark, Newspaper, ScrollText, type LucideIcon } from "lucide-react";
import type { Genre } from "@/generated/prisma/enums";
import { GENRE_LABEL } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const STYLE: Record<Genre, { className: string; icon: LucideIcon }> = {
  THO: { className: "from-rose-200 to-rose-400 text-rose-950", icon: Feather },
  TRUYEN_NGAN: { className: "from-amber-200 to-amber-400 text-amber-950", icon: BookOpen },
  TIEU_THUYET: { className: "from-emerald-200 to-emerald-400 text-emerald-950", icon: ScrollText },
  KICH: { className: "from-violet-200 to-violet-400 text-violet-950", icon: Drama },
  KI: { className: "from-sky-200 to-sky-400 text-sky-950", icon: Newspaper },
  NGHI_LUAN: { className: "from-slate-200 to-slate-400 text-slate-950", icon: Landmark },
};

type Props = {
  title: string;
  genre: Genre;
  coverUrl?: string | null;
  className?: string;
};

/**
 * Cover image, or a generated placeholder (genre colour + icon + title)
 * until real covers exist.
 */
export function WorkCover({ title, genre, coverUrl, className }: Props) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- covers may come from any host; sized by the parent
      <img src={coverUrl} alt="" className={cn("aspect-[3/4] w-full rounded-lg object-cover", className)} />
    );
  }
  const { className: tone, icon: Icon } = STYLE[genre];
  return (
    <div
      aria-hidden
      className={cn(
        "flex aspect-[3/4] w-full flex-col justify-between rounded-lg bg-linear-to-br p-3",
        tone,
        className,
      )}
    >
      <Icon className="size-5 opacity-70" />
      <div>
        <p className="text-[0.65rem] font-medium tracking-wide uppercase opacity-70">{GENRE_LABEL[genre]}</p>
        <p className="line-clamp-3 text-sm leading-snug font-semibold">{title}</p>
      </div>
    </div>
  );
}
