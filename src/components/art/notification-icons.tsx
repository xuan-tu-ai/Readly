import {
  AlarmClock,
  Award,
  BookPlus,
  ChevronsUp,
  CircleCheck,
  CircleHelp,
  Feather,
  Flag,
  Flame,
  GraduationCap,
  MessageCircleReply,
  Pin,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { DiscussionMarker, NotificationKind } from "@/lib/art";
import { cn } from "@/lib/utils";

/**
 * Icons for in-app notifications (bell list) and discussion posts: a lucide
 * glyph on a coloured tile, matching the sidebar navigation tiles.
 */

type Tile = { icon: LucideIcon; tone: string };

const NOTIFICATION_TILES: Record<NotificationKind, Tile> = {
  assignment: { icon: BookPlus, tone: "bg-brand-blue" },
  reminder: { icon: AlarmClock, tone: "bg-brand-orange" },
  graded: { icon: Sparkles, tone: "bg-primary" },
  "teacher-review": { icon: GraduationCap, tone: "bg-brand-purple" },
  badge: { icon: Award, tone: "bg-[#f7b72a]" },
  reply: { icon: MessageCircleReply, tone: "bg-brand-pink" },
  "level-up": { icon: ChevronsUp, tone: "bg-[#35c2b8]" },
  streak: { icon: Flame, tone: "bg-[#ff7a3d]" },
};

const DISCUSSION_TILES: Record<DiscussionMarker, Tile> = {
  question: { icon: CircleHelp, tone: "bg-brand-blue" },
  reflection: { icon: Feather, tone: "bg-brand-pink" },
  pinned: { icon: Pin, tone: "bg-brand-orange" },
  resolved: { icon: CircleCheck, tone: "bg-primary" },
  reported: { icon: Flag, tone: "bg-destructive" },
};

const SIZE = {
  sm: { box: "size-7 rounded-lg", icon: "size-4" },
  md: { box: "size-10 rounded-xl", icon: "size-5" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6" },
};

function IconTile({ tile, size, className, label }: { tile: Tile; size: keyof typeof SIZE; className?: string; label?: string }) {
  const Icon = tile.icon;
  return (
    <span
      className={cn("grid shrink-0 place-items-center text-white", SIZE[size].box, tile.tone, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon className={SIZE[size].icon} strokeWidth={2.5} />
    </span>
  );
}

export function NotificationIcon({
  kind,
  size = "md",
  className,
  label,
}: {
  kind: NotificationKind;
  size?: keyof typeof SIZE;
  className?: string;
  label?: string;
}) {
  return <IconTile tile={NOTIFICATION_TILES[kind]} size={size} className={className} label={label} />;
}

export function DiscussionIcon({
  marker,
  size = "sm",
  className,
  label,
}: {
  marker: DiscussionMarker;
  size?: keyof typeof SIZE;
  className?: string;
  label?: string;
}) {
  return <IconTile tile={DISCUSSION_TILES[marker]} size={size} className={className} label={label} />;
}
