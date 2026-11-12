import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell";
import { Mascot } from "@/components/mascot/mascot";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/server/auth/dal";
import { DomainError } from "@/server/errors";
import { getGameForPlay } from "@/server/services/minigames";
import { GamePlayer } from "./game-player";

export const metadata: Metadata = { title: "Mini game" };

export default function GamePage({ params }: PageProps<"/student/games/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Game params={params} />
    </Suspense>
  );
}

async function loadGame(id: string) {
  const user = await requireUser("STUDENT");
  try {
    return { game: await getGameForPlay(user, id) };
  } catch (error) {
    if (error instanceof DomainError && error.code === "FORBIDDEN") return { locked: error.message };
    if (error instanceof DomainError) notFound();
    throw error;
  }
}

async function Game({ params }: Pick<PageProps<"/student/games/[id]">, "params">) {
  const { id } = await params;
  const result = await loadGame(id);
  if (result.game) return <GamePlayer game={result.game} />;
  return (
    <div className="mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-4 px-4 text-center">
      <Mascot pose="sleep" size={150} label="" />
      <h1 className="text-2xl font-semibold">Mini game chưa mở</h1>
      <p className="text-muted-foreground">{result.locked}</p>
      <Link href="/student/library" className={buttonVariants({ size: "lg", className: "uppercase" })}>
        Về thư viện
      </Link>
    </div>
  );
}
