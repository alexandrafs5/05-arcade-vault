// Server-side data access. Imports lib/supabase/server.ts, which reads cookies()
// (request-time), so every caller must sit inside a <Suspense> boundary.
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Game = Tables<"games">;
export type GameWithStats = Game & { best: number | null; plays: number };
export type ScoreWithGame = {
  id: string;
  name: string;
  score: number;
  created_at: string;
  game: Pick<Game, "id" | "title" | "color">;
};
export type HomeStats = {
  games: number;
  scores: number;
  topScore: number | null;
};

type GameStats = { best: number | null; plays: number };

// Games with no scores have no row in `game_stats`.
export async function getGameStats(): Promise<Map<string, GameStats>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("game_stats").select("*");

  if (error) throw new Error(`getGameStats failed: ${error.message}`);

  const stats = new Map<string, GameStats>();
  for (const row of data) {
    if (row.game_id) {
      stats.set(row.game_id, { best: row.best, plays: row.plays ?? 0 });
    }
  }
  return stats;
}

export async function getGames(): Promise<GameWithStats[]> {
  const supabase = await createClient();
  const [gamesRes, stats] = await Promise.all([
    supabase.from("games").select("*").order("sort_order", { ascending: true }),
    getGameStats(),
  ]);

  if (gamesRes.error) {
    throw new Error(`getGames failed: ${gamesRes.error.message}`);
  }
  return gamesRes.data.map((g) => ({
    ...g,
    best: stats.get(g.id)?.best ?? null,
    plays: stats.get(g.id)?.plays ?? 0,
  }));
}

export async function getGame(id: string): Promise<GameWithStats | null> {
  const supabase = await createClient();
  const [gameRes, statsRes] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_stats").select("*").eq("game_id", id).maybeSingle(),
  ]);

  if (gameRes.error) {
    throw new Error(`getGame failed: ${gameRes.error.message}`);
  }
  if (statsRes.error) {
    throw new Error(`getGame stats failed: ${statsRes.error.message}`);
  }
  if (!gameRes.data) return null;
  return {
    ...gameRes.data,
    best: statsRes.data?.best ?? null,
    plays: statsRes.data?.plays ?? 0,
  };
}

const SCORE_COLUMNS =
  "id, name, score, created_at, game:games(id, title, color)";

// `gameId = null` ranks across all games (single highest scores).
export async function getTopScores(
  gameId: string | null,
  limit: number,
): Promise<ScoreWithGame[]> {
  const supabase = await createClient();
  let query = supabase
    .from("scores")
    .select(SCORE_COLUMNS)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (gameId) query = query.eq("game_id", gameId);

  const { data, error } = await query;
  if (error) throw new Error(`getTopScores failed: ${error.message}`);
  return data;
}

export async function getRecentScores(limit: number): Promise<ScoreWithGame[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select(SCORE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentScores failed: ${error.message}`);
  return data;
}

export async function getHomeStats(): Promise<HomeStats> {
  const supabase = await createClient();
  const [gamesRes, scoresRes, topRes] = await Promise.all([
    supabase.from("games").select("id", { count: "exact", head: true }),
    supabase.from("scores").select("id", { count: "exact", head: true }),
    supabase
      .from("scores")
      .select("score")
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (gamesRes.error)
    throw new Error(`getHomeStats failed: ${gamesRes.error.message}`);
  if (scoresRes.error)
    throw new Error(`getHomeStats failed: ${scoresRes.error.message}`);
  if (topRes.error)
    throw new Error(`getHomeStats failed: ${topRes.error.message}`);

  return {
    games: gamesRes.count ?? 0,
    scores: scoresRes.count ?? 0,
    topScore: topRes.data?.score ?? null,
  };
}
