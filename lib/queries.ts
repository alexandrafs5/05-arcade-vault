// Server-side data access. Imports lib/supabase/server.ts, which reads cookies()
// (request-time), so every caller must sit inside a <Suspense> boundary.
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Game = Tables<"games">;

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`getGames failed: ${error.message}`);
  return data;
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getGame failed: ${error.message}`);
  return data;
}
