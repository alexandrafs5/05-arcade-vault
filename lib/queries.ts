// Server-side data access. Imports lib/supabase/server.ts, which reads cookies()
// (request-time), so every caller must sit inside a <Suspense> boundary.
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Game = Tables<"games">;
export type GameWithStats = Game & { best: number | null; plays: number };

// Temporary until step 6 wires `game_stats`: no scores yet, so best is null and plays is 0.
const noStats = { best: null, plays: 0 } as const;

export async function getGames(): Promise<GameWithStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`getGames failed: ${error.message}`);
  return data.map((g) => ({ ...g, ...noStats }));
}

export async function getGame(id: string): Promise<GameWithStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getGame failed: ${error.message}`);
  return data ? { ...data, ...noStats } : null;
}
