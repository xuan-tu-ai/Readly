"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { playGameAction, type PlayGameResult } from "@/app/actions/gamification";
import { DetailGameIcon, MatchGameIcon, StarIcon } from "@/components/art/game-icons";
import { useRewards } from "@/components/gamification/celebrations";
import { Mascot } from "@/components/mascot/mascot";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MINI_GAME_LABEL, type GameAnswers, type PublicDetail, type PublicMatch } from "@/lib/minigames";
import { cn } from "@/lib/utils";
import type { PlayableGame } from "@/server/services/minigames";

/** Colours shared by a character and the event it is paired with. */
const PAIR_TONES = [
  "border-brand-blue bg-sidebar-accent",
  "border-brand-orange bg-accent",
  "border-brand-purple bg-[#f1eaff] dark:bg-[#3a2d57]",
  "border-brand-pink bg-[#ffe8f0] dark:bg-[#4f2433]",
  "border-primary bg-secondary",
  "border-[#35c2b8] bg-[#dcf6f4] dark:bg-[#173f3c]",
  "border-[#f7b72a] bg-[#fff4cf] dark:bg-[#4a3b12]",
  "border-[#a8714a] bg-[#f6e9de] dark:bg-[#43301f]",
];

export function GamePlayer({ game }: { game: PlayableGame }) {
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<PlayGameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { celebrate, toastPoints } = useRewards();

  const submit = (answers: GameAnswers) =>
    startTransition(async () => {
      const outcome = await playGameAction({ gameId: game.id, answers });
      if (!outcome.ok) return setError(outcome.error);
      setError(null);
      setResult(outcome.data);
      toastPoints(outcome.data.pointsAdded);
      celebrate(outcome.data.celebrations);
    });

  const replay = () => {
    setResult(null);
    setRound((r) => r + 1);
  };

  const Icon = game.game.type === "MATCH" ? MatchGameIcon : DetailGameIcon;
  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-3xl grid-rows-[auto_1fr] px-4 sm:px-6">
      <header className="flex items-center gap-3 py-4">
        <Link
          href={`/student/read/${game.work.slug}`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
          aria-label="Đóng mini game, quay lại đọc"
        >
          <X className="size-6" />
        </Link>
        <Icon size={36} />
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-wider text-brand-purple uppercase">{MINI_GAME_LABEL[game.game.type]}</p>
          <p className="truncate font-bold">{game.title}</p>
        </div>
      </header>

      {result ? (
        <Result result={result} game={game} onReplay={replay} />
      ) : game.game.type === "MATCH" ? (
        <MatchBoard key={round} game={game.game} pending={pending} error={error} onSubmit={submit} />
      ) : (
        <DetailQuiz key={round} game={game.game} pending={pending} error={error} onSubmit={submit} />
      )}
    </div>
  );
}

type BoardProps<G> = { game: G; pending: boolean; error: string | null; onSubmit: (answers: GameAnswers) => void };

/** Tap a character, then the event that goes with it. Tap a paired card to undo. */
function MatchBoard({ game, pending, error, onSubmit }: BoardProps<PublicMatch>) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const pairIndex = useMemo(() => {
    const order = Object.keys(pairs);
    return (leftId: string) => order.indexOf(leftId);
  }, [pairs]);
  const leftOf = (rightId: string) => Object.keys(pairs).find((l) => pairs[l] === rightId);
  const done = Object.keys(pairs).length === game.lefts.length;

  const unpair = (leftId: string) =>
    setPairs(Object.fromEntries(Object.entries(pairs).filter(([l]) => l !== leftId)));

  const tapLeft = (id: string) => {
    if (pairs[id]) {
      unpair(id);
      return;
    }
    setPicked(picked === id ? null : id);
  };
  const tapRight = (id: string) => {
    const owner = leftOf(id);
    if (owner) {
      unpair(owner);
      return;
    }
    if (!picked) return;
    setPairs({ ...pairs, [picked]: id });
    setPicked(null);
  };

  return (
    <div className="grid content-start gap-6 pb-8">
      <div className="flex items-center gap-4">
        <Mascot pose="point" size={84} label="" />
        <p className="font-heading text-xl font-semibold sm:text-2xl">Ghép mỗi nhân vật với sự kiện của họ</p>
      </div>
      <ProgressBar value={Object.keys(pairs).length} max={game.lefts.length} label="Số cặp đã ghép" />
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        <ul className="grid content-start gap-3" aria-label="Nhân vật">
          {game.lefts.map((l) => {
            const index = pairIndex(l.id);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  aria-pressed={picked === l.id || Boolean(pairs[l.id])}
                  onClick={() => tapLeft(l.id)}
                  className={cn(
                    "w-full rounded-2xl border-2 bg-card p-3 text-left font-bold shadow-[0_4px_0_var(--border)] transition active:translate-y-1 active:shadow-none",
                    picked === l.id && "border-brand-blue ring-3 ring-brand-blue/30",
                    index >= 0 && PAIR_TONES[index % PAIR_TONES.length],
                  )}
                >
                  {l.text}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="grid content-start gap-3" aria-label="Sự kiện">
          {game.rights.map((r) => {
            const owner = leftOf(r.id);
            const index = owner ? pairIndex(owner) : -1;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  aria-pressed={Boolean(owner)}
                  disabled={!picked && !owner}
                  onClick={() => tapRight(r.id)}
                  className={cn(
                    "w-full rounded-2xl border-2 bg-card p-3 text-left text-sm font-semibold shadow-[0_4px_0_var(--border)] transition active:translate-y-1 active:shadow-none disabled:cursor-default",
                    !picked && !owner && "opacity-80",
                    index >= 0 && PAIR_TONES[index % PAIR_TONES.length],
                  )}
                >
                  {r.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {picked ? "Giờ chọn sự kiện ở cột phải." : done ? "Đã ghép xong, nộp bài nhé!" : "Chọn một nhân vật ở cột trái."}
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button size="xl" className="w-full uppercase sm:ml-auto sm:w-60" disabled={!done || pending} onClick={() => onSubmit(pairs)}>
        {pending ? "Đang chấm…" : "Nộp bài"}
      </Button>
    </div>
  );
}

/** One sentence per screen: pick the missing detail, then "Tiếp tục". */
function DetailQuiz({ game, pending, error, onSubmit }: BoardProps<PublicDetail>) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const item = game.items[step];
  const chosen = answers[item.id];
  const last = step === game.items.length - 1;
  const [before, after] = item.text.split("___");

  return (
    <div className="grid content-start gap-6 pb-8">
      <ProgressBar value={step} max={game.items.length} label="Tiến độ mini game" />
      <div key={item.id} className="grid animate-rise-in gap-6">
        <div className="flex items-center gap-4">
          <Mascot pose="think" size={84} label="" />
          <p className="text-sm font-bold text-muted-foreground">
            Câu {step + 1}/{game.items.length} · Chi tiết nào còn thiếu?
          </p>
        </div>
        <p className="rounded-2xl border-2 bg-card p-5 font-heading text-xl leading-relaxed sm:text-2xl">
          {before}
          <span className="mx-1 inline-block min-w-16 border-b-4 border-brand-purple px-2 text-center text-brand-purple">
            {chosen !== undefined ? item.options[chosen] : " "}
          </span>
          {after}
        </p>
        <div role="radiogroup" aria-label="Lựa chọn" className="grid gap-3 sm:grid-cols-2">
          {item.options.map((option, i) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={chosen === i}
              onClick={() => setAnswers({ ...answers, [item.id]: i })}
              className={cn(
                "rounded-2xl border-2 bg-card p-4 text-left font-bold shadow-[0_4px_0_var(--border)] transition active:translate-y-1 active:shadow-none",
                chosen === i && "border-brand-blue bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_4px_0_var(--brand-blue)]",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3 sm:justify-end">
        {step > 0 ? (
          <Button variant="outline" size="xl" onClick={() => setStep(step - 1)}>
            Quay lại
          </Button>
        ) : null}
        <Button
          size="xl"
          className="flex-1 uppercase sm:w-60 sm:flex-none"
          disabled={chosen === undefined || pending}
          onClick={() => (last ? onSubmit(answers) : setStep(step + 1))}
        >
          {last ? (pending ? "Đang chấm…" : "Nộp bài") : "Tiếp tục"}
        </Button>
      </div>
    </div>
  );
}

function Result({ result, game, onReplay }: { result: PlayGameResult; game: PlayableGame; onReplay: () => void }) {
  const pose = result.stars === 3 ? "cheer" : result.stars === 0 ? "sad" : "idle";
  const labels = useMemo(() => {
    if (game.game.type === "MATCH") return new Map(game.game.lefts.map((l) => [l.id, l.text]));
    return new Map(game.game.items.map((i) => [i.id, i.text]));
  }, [game.game]);

  return (
    <div className="grid content-start justify-items-center gap-5 pb-10 text-center">
      <Mascot pose={pose} size={140} label="" />
      <div className="flex" aria-label={`${result.stars}/3 sao`}>
        {[1, 2, 3].map((n) => (
          <StarIcon key={n} filled={n <= result.stars} size={52} className={n === 2 ? "-translate-y-2" : undefined} />
        ))}
      </div>
      <h1 className="text-3xl font-semibold">
        {result.correct}/{result.total} câu đúng
      </h1>
      <p className="text-muted-foreground">
        {result.newRecord ? "Kỷ lục mới! " : ""}
        {result.pointsAdded > 0
          ? `Bạn nhận thêm ${result.pointsAdded} điểm.`
          : result.newRecord
            ? "Chơi tốt hơn để nhận thêm điểm."
            : "Điểm chỉ cộng khi bạn phá kỷ lục của mình."}
      </p>
      <ul className="grid w-full gap-2 text-left">
        {result.results.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex gap-3 rounded-2xl border-2 p-3 text-sm",
              r.correct ? "border-primary/40 bg-secondary" : "border-destructive/30 bg-[#fdecec] dark:bg-[#4a2222]",
            )}
          >
            {r.correct ? (
              <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-label="Đúng" />
            ) : (
              <X className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Sai" />
            )}
            <span>
              <span className="font-bold">{labels.get(r.id)?.replace("___", "…")}</span>
              <br />
              <span className="text-muted-foreground">Đáp án: </span>
              {r.answer}
              {r.explanation ? <span className="block text-muted-foreground">{r.explanation}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="outline" size="xl" onClick={onReplay}>
          <RotateCcw aria-hidden /> Chơi lại
        </Button>
        <Link href={`/student/read/${game.work.slug}`} className={buttonVariants({ size: "xl", className: "uppercase" })}>
          Đọc tiếp
        </Link>
      </div>
    </div>
  );
}
