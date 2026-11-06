import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { GAMES, getGame } from "@/lib/data";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

async function Play({ params }: { params: PageProps<"/juegos/[id]/jugar">["params"] }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer gameId={game.id} title={game.title} />;
}

export default function PlayPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense fallback={<div className="pixel neon-cyan" style={{ padding: "80px 32px", textAlign: "center" }}>CARGANDO_</div>}>
      <Play params={params} />
    </Suspense>
  );
}
