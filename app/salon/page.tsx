import { Suspense } from "react";
import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames, getTopScores } from "@/lib/queries";

export const metadata: Metadata = { title: "Salón de la Fama · Arcade Vault" };

async function Hall({
  searchParams,
}: {
  searchParams: PageProps<"/salon">["searchParams"];
}) {
  const { game } = await searchParams;
  const games = await getGames();
  // An unknown or repeated `game` param falls back to the first game by sort_order.
  const selected = games.find((g) => g.id === game) ?? games[0];
  const rows = selected ? await getTopScores(selected.id, 20) : [];

  if (!selected) return null;
  return <HallOfFame games={games} selected={selected} rows={rows} />;
}

export default function SalonPage({ searchParams }: PageProps<"/salon">) {
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
      <Hall searchParams={searchParams} />
    </Suspense>
  );
}
