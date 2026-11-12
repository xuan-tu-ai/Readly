import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DetailGameIcon, LockIcon, MatchGameIcon, StarIcon } from "@/components/art/game-icons";
import { MINI_GAME_LABEL } from "@/lib/minigames";
import { cn } from "@/lib/utils";
import type { WorkGame } from "@/server/services/minigames";

/** A mini game teaser: playable once its segment is read, otherwise shows what unlocks it. */
export function MiniGameCard({ game, unlocked, className }: { game: WorkGame; unlocked: boolean; className?: string }) {
  const Icon = game.type === "MATCH" ? MatchGameIcon : DetailGameIcon;
  if (!unlocked) {
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl border-2 border-dashed bg-card/60 p-3 font-sans text-sm", className)}>
        <LockIcon size={40} />
        <div className="min-w-0">
          <p className="font-bold">{MINI_GAME_LABEL[game.type]}</p>
          <p className="text-muted-foreground">Đọc hết “{game.unlockSegmentTitle}” để mở mini game.</p>
        </div>
      </div>
    );
  }
  return (
    <Link
      href={`/student/games/${game.id}`}
      className={cn(
        "group flex animate-pop-in items-center gap-3 rounded-2xl border-2 border-brand-purple/40 bg-card p-3 font-sans text-card-foreground shadow-[0_4px_0_color-mix(in_oklch,var(--brand-purple)_35%,transparent)] transition-transform hover:-translate-y-0.5",
        className,
      )}
    >
      <Icon size={48} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold tracking-wider text-brand-purple uppercase">
          {game.bestStars === null ? "Mini game đã mở!" : MINI_GAME_LABEL[game.type]}
        </p>
        <p className="truncate font-bold">{game.title}</p>
        {game.bestStars !== null ? (
          <span className="flex" aria-label={`Kỷ lục: ${game.bestStars}/3 sao`}>
            {[1, 2, 3].map((n) => (
              <StarIcon key={n} filled={n <= game.bestStars!} size={18} />
            ))}
          </span>
        ) : null}
      </div>
      <span className="flex items-center gap-1 text-sm font-extrabold text-brand-purple uppercase">
        {game.bestStars === null ? "Chơi" : "Chơi lại"}
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
