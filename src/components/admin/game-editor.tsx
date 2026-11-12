"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { deleteGameAction, draftGameAction, saveGameAction } from "@/app/actions/admin-content";
import { Button } from "@/components/ui/button";
import type { GameInput } from "@/lib/content/schemas";
import { MINI_GAME_LABEL } from "@/lib/minigames";
import { cn } from "@/lib/utils";
import { Labeled, selectClass } from "./fields";

export type SegmentChoice = { id: string; label: string };

type Item = GameInput["items"][number];
const emptyItem = (): Item => ({ text: "", options: ["", "", ""], answer: 0, explanation: null });

export const emptyGame = (segmentId: string): GameInput => ({
  type: "DETAIL",
  title: "",
  unlockSegmentId: segmentId,
  published: false,
  pairs: [
    { left: "", right: "" },
    { left: "", right: "" },
    { left: "", right: "" },
  ],
  items: [emptyItem(), emptyItem()],
});

/** Mini game form (spec §8.5): pairs for MATCH, sentences with "___" for DETAIL. */
export function GameForm({
  workId,
  gameId,
  initial,
  segments,
  played = false,
  onDone,
}: {
  workId: string;
  gameId?: string;
  initial: GameInput;
  segments: SegmentChoice[];
  played?: boolean;
  onDone: (message?: string) => void;
}) {
  const [g, setG] = useState<GameInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const id = gameId ?? "new";
  const set = <K extends keyof GameInput>(key: K, value: GameInput[K]) => setG((prev) => ({ ...prev, [key]: value }));
  const setItem = (i: number, patch: Partial<Item>) => set("items", g.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveGameAction({ workId, gameId, data: g });
      if (result.ok) onDone(gameId ? "Đã lưu mini game." : "Đã thêm mini game.");
      else setError(result.error);
    });

  const draft = () =>
    startTransition(async () => {
      setError(null);
      const result = await draftGameAction({ workId, segmentId: g.unlockSegmentId, type: g.type });
      if (!result.ok) return setError(result.error);
      const d = result.data;
      setG((prev) =>
        d.type === "MATCH"
          ? { ...prev, title: d.title, pairs: d.pairs }
          : { ...prev, title: d.title, items: d.items.map((it) => ({ ...it, options: [...it.options, "", "", ""].slice(0, Math.max(3, it.options.length)) })) },
      );
    });

  return (
    <div className="grid gap-3 rounded-2xl border-2 border-dashed bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Labeled id={`gtype-${id}`} label="Loại" hint={played ? "Đã có lượt chơi: không đổi loại." : undefined}>
          <select id={`gtype-${id}`} className={selectClass} value={g.type} disabled={played} onChange={(e) => set("type", e.target.value as GameInput["type"])}>
            <option value="DETAIL">{MINI_GAME_LABEL.DETAIL}</option>
            <option value="MATCH">{MINI_GAME_LABEL.MATCH}</option>
          </select>
        </Labeled>
        <Labeled id={`gseg-${id}`} label="Mở khóa sau phân đoạn" hint="Chỉ dùng chi tiết đến phân đoạn này để không lộ nội dung.">
          <select id={`gseg-${id}`} className={selectClass} value={g.unlockSegmentId} onChange={(e) => set("unlockSegmentId", e.target.value)}>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="grid content-end">
          <Button type="button" variant="outline" size="sm" onClick={draft} disabled={busy} className="border-brand-purple/50">
            <Sparkles aria-hidden /> {busy ? "AI đang soạn…" : "AI soạn nháp"}
          </Button>
        </div>
      </div>
      <Labeled id={`gtitle-${id}`} label="Tên mini game">
        <input id={`gtitle-${id}`} className={selectClass} value={g.title} onChange={(e) => set("title", e.target.value)} />
      </Labeled>

      {g.type === "MATCH" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Cặp ghép (2–8 cặp; học sinh nối vế trái với vế phải)</legend>
          {g.pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <input
                aria-label={`Vế trái ${i + 1}`}
                placeholder="Nhân vật / hình ảnh"
                className={selectClass}
                value={p.left}
                onChange={(e) => set("pairs", g.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))}
              />
              <input
                aria-label={`Vế phải ${i + 1}`}
                placeholder="Sự kiện / chi tiết"
                className={selectClass}
                value={p.right}
                onChange={(e) => set("pairs", g.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))}
              />
              <Button variant="ghost" size="icon-sm" aria-label={`Bỏ cặp ${i + 1}`} onClick={() => set("pairs", g.pairs.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          {g.pairs.length < 8 ? (
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => set("pairs", [...g.pairs, { left: "", right: "" }])}>
              <Plus aria-hidden /> Thêm cặp
            </Button>
          ) : null}
        </fieldset>
      ) : (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Câu đoán chi tiết (viết “___” vào chỗ chi tiết bị ẩn, chọn đáp án đúng)</legend>
          {g.items.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-xl border-2 p-3">
              <div className="flex gap-2">
                <input
                  aria-label={`Câu ${i + 1}`}
                  placeholder="Ví dụ: Gió qua hàng ___, nắng vàng trên đê."
                  className={cn(selectClass, "flex-1")}
                  value={it.text}
                  onChange={(e) => setItem(i, { text: e.target.value })}
                />
                <Button variant="ghost" size="icon-sm" aria-label={`Bỏ câu ${i + 1}`} onClick={() => set("items", g.items.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {it.options.map((o, k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`ans-${id}-${i}`}
                      checked={it.answer === k}
                      onChange={() => setItem(i, { answer: k })}
                      aria-label={`Đáp án đúng là lựa chọn ${k + 1}`}
                      className="size-4 accent-primary"
                    />
                    <input
                      aria-label={`Lựa chọn ${k + 1} của câu ${i + 1}`}
                      placeholder={`Lựa chọn ${k + 1}`}
                      className={cn(selectClass, "h-9 flex-1")}
                      value={o}
                      onChange={(e) => setItem(i, { options: it.options.map((x, m) => (m === k ? e.target.value : x)) })}
                    />
                  </label>
                ))}
              </div>
              <input
                aria-label={`Giải thích câu ${i + 1}`}
                placeholder="Giải thích (không bắt buộc)"
                className={cn(selectClass, "h-9")}
                value={it.explanation ?? ""}
                onChange={(e) => setItem(i, { explanation: e.target.value || null })}
              />
            </div>
          ))}
          {g.items.length < 10 ? (
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => set("items", [...g.items, emptyItem()])}>
              <Plus aria-hidden /> Thêm câu
            </Button>
          ) : null}
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={g.published} onChange={(e) => set("published", e.target.checked)} className="size-4 accent-primary" />
        Xuất bản (học sinh thấy khi đọc tới phân đoạn mở khóa)
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Đang lưu…" : gameId ? "Lưu mini game" : "Thêm mini game"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone()} disabled={busy}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

export type GameRowData = { id: string; input: GameInput; title: string; type: GameInput["type"]; published: boolean; segmentLabel: string; plays: number; size: number };

export function GameRow({ workId, row, segments }: { workId: string; row: GameRowData; segments: SegmentChoice[] }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const remove = () => {
    if (!confirm(`Xóa “${row.title}”?`)) return;
    startTransition(async () => {
      const result = await deleteGameAction(row.id);
      setMessage(result.ok ? null : result.error);
    });
  };
  if (editing) {
    return (
      <GameForm
        workId={workId}
        gameId={row.id}
        initial={row.input}
        segments={segments}
        played={row.plays > 0}
        onDone={(m) => {
          setEditing(false);
          setMessage(m ?? null);
        }}
      />
    );
  }
  return (
    <div className="grid gap-1 rounded-2xl border-2 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{MINI_GAME_LABEL[row.type]}</span>
        <span className="rounded-full border-2 px-2 py-0.5 text-xs font-bold">Mở sau {row.segmentLabel}</span>
        <span className={cn("text-xs font-bold", row.published ? "text-[#178a45]" : "text-muted-foreground")}>
          {row.published ? "Đã xuất bản" : "Nháp"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {row.size} {row.type === "MATCH" ? "cặp" : "câu"} · {row.plays} lượt chơi
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Sửa mini game" onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Xóa mini game" onClick={remove} disabled={busy}>
          <Trash2 />
        </Button>
      </div>
      <p className="font-semibold">{row.title}</p>
      {message ? (
        <p role="status" className="text-sm font-semibold text-primary">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function NewGame({ workId, segments }: { workId: string; segments: SegmentChoice[] }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus aria-hidden /> Thêm mini game
        </Button>
        {message ? (
          <p role="status" className="text-sm font-semibold text-primary">
            {message}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <GameForm
      workId={workId}
      initial={emptyGame(segments[0].id)}
      segments={segments}
      onDone={(m) => {
        setOpen(false);
        setMessage(m ?? null);
      }}
    />
  );
}
