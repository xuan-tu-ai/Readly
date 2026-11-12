import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/app-shell";
import { GameRow, NewGame, type GameRowData } from "@/components/admin/game-editor";
import type { GameInput } from "@/lib/content/schemas";
import { detailDataSchema, matchDataSchema } from "@/lib/minigames";
import { listWorkGames, type AdminGame } from "@/server/services/admin/games";
import { segmentOptions } from "@/server/services/admin/works";
import { loadForAdmin } from "../load";

export const metadata: Metadata = { title: "Mini game" };

export default function GamesPage({ params }: PageProps<"/admin/works/[id]/games">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Games params={params} />
    </Suspense>
  );
}

function toInput(g: AdminGame): { input: GameInput; size: number } {
  const match = matchDataSchema.safeParse(g.data);
  const detail = detailDataSchema.safeParse(g.data);
  const pairs = match.success ? match.data.pairs.map(({ left, right }) => ({ left, right })) : [];
  const items = detail.success
    ? detail.data.items.map((it) => ({
        text: it.text,
        options: [...it.options, "", ""].slice(0, Math.max(3, it.options.length)),
        answer: it.answer,
        explanation: it.explanation ?? null,
      }))
    : [];
  return {
    input: { type: g.type, title: g.title, unlockSegmentId: g.unlockSegmentId, published: g.published, pairs, items },
    size: g.type === "MATCH" ? pairs.length : items.length,
  };
}

async function Games({ params }: Pick<PageProps<"/admin/works/[id]/games">, "params">) {
  const { id } = await params;
  const [games, segments] = await Promise.all([loadForAdmin((user) => listWorkGames(user, id)), segmentOptions(id)]);
  const choices = segments.map((s) => ({ id: s.id, label: s.title ?? `Phần ${s.order}` }));
  const rows: GameRowData[] = games.map((g) => {
    const { input, size } = toInput(g);
    return {
      id: g.id,
      input,
      size,
      title: g.title,
      type: g.type,
      published: g.published,
      segmentLabel: g.unlockSegment.title ?? `Phần ${g.unlockSegment.order}`,
      plays: g.plays,
    };
  });
  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Mini game mở khi học sinh đọc tới phân đoạn đã chọn, cho tối đa 30 điểm theo kỷ lục. Game đã có lượt chơi không xóa được
        (giữ điểm của học sinh), chỉ bỏ xuất bản.
      </p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có mini game.</p> : null}
      {rows.map((r) => (
        <GameRow key={r.id} workId={id} row={r} segments={choices} />
      ))}
      {segments.length > 0 ? (
        <NewGame workId={id} segments={choices} />
      ) : (
        <p className="text-sm text-muted-foreground">Cần có văn bản trước khi thêm mini game.</p>
      )}
    </div>
  );
}
