import Link from "next/link";
import { StreakFlame, XpIcon } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/dal";
import { getPlayer } from "@/server/services/gamification";

/** Streak, points and level chips (Duolingo-style top bar); links to "Thành tích". */
export async function PlayerChips({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return null;
  const player = await getPlayer(user.id);
  const chip = "flex items-center gap-1.5 rounded-xl px-2 py-1 font-extrabold tabular-nums hover:bg-muted";
  return (
    <Link
      href="/student/achievements"
      className="flex items-center gap-1 text-sm"
      aria-label={`Streak ${player.streak.current} ngày, ${player.points} điểm, cấp ${player.level.level} ${player.level.name}. Xem thành tích`}
    >
      <span className={cn(chip, player.streak.today ? "text-[#f26b2b]" : "text-muted-foreground")}>
        <StreakFlame lit={player.streak.today} size={22} />
        {player.streak.current}
      </span>
      <span className={cn(chip, "text-[#c48508] dark:text-[#f2c14e]")}>
        <XpIcon size={22} />
        {player.points}
      </span>
      <span className={cn(chip, "text-foreground")}>
        <LevelEmblem level={player.level.level} size={24} label="" />
        {compact ? null : <span className="hidden lg:inline">{player.level.name}</span>}
      </span>
    </Link>
  );
}

export function PlayerChipsSkeleton() {
  return <div className="h-8 w-40 animate-pulse rounded-xl bg-muted" aria-hidden />;
}
