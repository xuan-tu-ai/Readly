"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { acknowledgeCelebrationsAction } from "@/app/actions/gamification";
import { BadgeArt } from "@/components/art/badge";
import { Confetti, Sunburst } from "@/components/art/celebration";
import { XpIcon } from "@/components/art/game-icons";
import { LevelEmblem } from "@/components/art/level";
import { Mascot } from "@/components/mascot/mascot";
import { Button } from "@/components/ui/button";
import type { Celebrations } from "@/server/services/gamification";

/**
 * Reward feedback for students:
 * - a "+N điểm" toast when points go up (reader, mini games);
 * - a full-screen celebration for each new badge and level-up, one after
 *   another, acknowledged on the server when the last one is closed.
 * The provider is mounted by the student layouts with whatever the server
 * already knows; client components push new rewards with `useRewards()`.
 */

type Item =
  | { kind: "level"; level: NonNullable<Celebrations["levelUp"]> }
  | { kind: "badge"; badge: Celebrations["badges"][number] };

type RewardsApi = {
  /** Queue celebrations returned by an action (duplicates are ignored). */
  celebrate: (celebrations: Celebrations | null | undefined) => void;
  /** Show "+N điểm". */
  toastPoints: (points: number) => void;
};

const RewardsContext = createContext<RewardsApi>({ celebrate: () => {}, toastPoints: () => {} });

export function useRewards() {
  return useContext(RewardsContext);
}

function toItems(c: Celebrations | null | undefined): Item[] {
  if (!c) return [];
  return [
    ...(c.levelUp ? [{ kind: "level" as const, level: c.levelUp }] : []),
    ...c.badges.map((badge) => ({ kind: "badge" as const, badge })),
  ];
}

const itemKey = (item: Item) => (item.kind === "level" ? `level:${item.level.level}` : `badge:${item.badge.id}`);

export function RewardsProvider({ initial, children }: { initial?: Celebrations | null; children: ReactNode }) {
  const [queue, setQueue] = useState<Item[]>(() => toItems(initial));
  // Keys ever queued in this page, so repeated results (polling, Strict Mode) never show twice.
  const seen = useRef<Set<string>>(new Set(toItems(initial).map(itemKey)));
  const [toast, setToast] = useState<{ id: number; points: number } | null>(null);

  const celebrate = useCallback((c: Celebrations | null | undefined) => {
    const fresh = toItems(c).filter((i) => !seen.current.has(itemKey(i)));
    if (fresh.length === 0) return;
    fresh.forEach((i) => seen.current.add(itemKey(i)));
    setQueue((prev) => [...prev, ...fresh]);
  }, []);

  const toastPoints = useCallback((points: number) => {
    if (points > 0) setToast({ id: Date.now(), points });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const current = queue[0] ?? null;
  const next = () => {
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) void acknowledgeCelebrationsAction();
  };

  return (
    <RewardsContext.Provider value={{ celebrate, toastPoints }}>
      {children}
      {toast ? (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-none fixed top-20 left-1/2 z-50 flex -translate-x-1/2 animate-pop-in items-center gap-2 rounded-full border-2 border-[#e09b0f]/30 bg-card px-4 py-2 font-extrabold text-[#c48508] dark:text-[#f2c14e] shadow-[0_4px_0_var(--border)]"
        >
          <XpIcon size={26} /> +{toast.points} điểm
        </div>
      ) : null}
      <Dialog.Root open={current !== null} onOpenChange={(open) => !open && next()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 justify-items-center gap-4 overflow-hidden rounded-3xl border-2 bg-card p-6 text-center shadow-2xl transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {current ? <CelebrationBody key={itemKey(current)} item={current} /> : null}
            <Button size="xl" className="relative w-full uppercase" onClick={next}>
              {queue.length > 1 ? "Tiếp" : "Tuyệt vời!"}
            </Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </RewardsContext.Provider>
  );
}

function CelebrationBody({ item }: { item: Item }) {
  return (
    <>
      <Confetti count={56} />
      {item.kind === "level" ? (
        <>
          <p className="relative text-sm font-extrabold tracking-widest text-brand-orange uppercase">Lên cấp!</p>
          <Sunburst size={220}>
            <LevelEmblem level={item.level.level} size={130} label="" />
          </Sunburst>
          <Dialog.Title className="relative font-heading text-3xl font-semibold">{item.level.name}</Dialog.Title>
          <Dialog.Description className="relative text-muted-foreground">
            Bạn đã đạt cấp {item.level.level}. Mướp tự hào về bạn lắm!
          </Dialog.Description>
        </>
      ) : (
        <>
          <p className="relative text-sm font-extrabold tracking-widest text-primary uppercase">Huy hiệu mới!</p>
          <Sunburst size={220}>
            <BadgeArt
              emblem={item.badge.emblem}
              tier={item.badge.tier}
              caption={item.badge.caption}
              size={120}
              label=""
            />
          </Sunburst>
          <Dialog.Title className="relative font-heading text-3xl font-semibold">{item.badge.name}</Dialog.Title>
          <Dialog.Description className="relative text-muted-foreground">{item.badge.description}</Dialog.Description>
        </>
      )}
      <Mascot pose={item.kind === "level" ? "trophy" : "medal"} size={72} label="" className="relative -my-2" />
    </>
  );
}

/** Queues celebrations the server already knew about when the page was rendered. */
export function CelebrateOnMount({ celebrations }: { celebrations: Celebrations }) {
  const { celebrate } = useRewards();
  useEffect(() => {
    celebrate(celebrations);
    // Only on mount: later rewards arrive through action results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
