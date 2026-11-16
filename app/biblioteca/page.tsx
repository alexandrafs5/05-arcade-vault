import { Suspense } from "react";
import type { Metadata } from "next";
import { Library } from "@/components/library";
import { getGames } from "@/lib/queries";

export const metadata: Metadata = { title: "Biblioteca · Arcade Vault" };

async function LibraryLoader() {
  const games = await getGames();
  return <Library games={games} />;
}

export default function BibliotecaPage() {
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
      <LibraryLoader />
    </Suspense>
  );
}
