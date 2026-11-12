import { BookOpen, Drama, Feather, Landmark, Newspaper, ScrollText, type LucideIcon } from "lucide-react";
import type { Genre } from "@/generated/prisma/enums";
import { GENRE_LABEL } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const STYLE: Record<Genre, { bg: string; icon: LucideIcon }> = {
  THO: { bg: "linear-gradient(150deg, #ff9fb2, #e2557a)", icon: Feather },
  TRUYEN_NGAN: { bg: "linear-gradient(150deg, #ffd27a, #f08a3c)", icon: BookOpen },
  TIEU_THUYET: { bg: "linear-gradient(150deg, #8fe3a8, #2fa866)", icon: ScrollText },
  KICH: { bg: "linear-gradient(150deg, #c5a8ff, #7b4fe0)", icon: Drama },
  KI: { bg: "linear-gradient(150deg, #8fd3ff, #3383e0)", icon: Newspaper },
  NGHI_LUAN: { bg: "linear-gradient(150deg, #b9c4d6, #5a6b88)", icon: Landmark },
};

export const GENRE_COLOR: Record<Genre, string> = {
  THO: "#e2557a",
  TRUYEN_NGAN: "#f08a3c",
  TIEU_THUYET: "#2fa866",
  KICH: "#7b4fe0",
  KI: "#3383e0",
  NGHI_LUAN: "#5a6b88",
};

type Props = {
  title: string;
  genre: Genre;
  coverUrl?: string | null;
  className?: string;
};

/**
 * Book-shaped cover: the real image, or a generated placeholder (genre
 * gradient, pattern, icon and title) until real covers exist.
 */
export function WorkCover({ title, genre, coverUrl, className }: Props) {
  const shape = "relative aspect-[3/4] w-full overflow-hidden rounded-l-md rounded-r-xl shadow-[0_6px_16px_-6px_rgb(0_0_0/0.35)]";
  const spine = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-linear-to-r from-black/25 via-white/15 to-transparent"
    />
  );
  if (coverUrl) {
    return (
      <div className={cn(shape, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- covers may come from any host; sized by the parent */}
        <img src={coverUrl} alt="" className="size-full object-cover" />
        {spine}
      </div>
    );
  }
  const { bg, icon: Icon } = STYLE[genre];
  return (
    <div aria-hidden className={cn(shape, "@container text-white", className)} style={{ background: bg }}>
      <svg className="absolute inset-0 size-full opacity-20" preserveAspectRatio="none" viewBox="0 0 100 133">
        <circle cx="92" cy="12" r="30" fill="white" />
        <circle cx="8" cy="120" r="22" fill="white" />
        <path d="M0 92 Q50 72 100 96" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>
      {spine}
      <div className="relative flex h-full flex-col justify-between p-[9%] pl-[13%]">
        <Icon className="size-[16cqw] min-h-4 min-w-4 opacity-90" strokeWidth={2.25} />
        <div className="grid gap-[3cqw]">
          <p className="text-[clamp(0.55rem,7cqw,0.75rem)] font-bold tracking-wider uppercase opacity-85">
            {GENRE_LABEL[genre]}
          </p>
          <p className="line-clamp-4 font-heading text-[clamp(0.75rem,11cqw,1.5rem)] leading-[1.15] font-semibold [text-shadow:0_1px_2px_rgb(0_0_0/0.2)]">
            {title}
          </p>
        </div>
      </div>
    </div>
  );
}
