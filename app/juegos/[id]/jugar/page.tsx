import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { getGame } from "@/lib/queries";

async function Play({
  params,
}: {
  params: PageProps<"/juegos/[id]/jugar">["params"];
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer gameId={game.id} title={game.title} />;
}

export default function PlayPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense
      fallback={
        <div
          className="pixel neon-cyan"
          style={{ padding: "80px 32px", textAlign: "center" }}
        >
          CARGANDO_
        </div>
      }
    >
      <Play params={params} />
    </Suspense>
  );
}
