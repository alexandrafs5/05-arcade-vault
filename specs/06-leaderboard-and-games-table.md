# SPEC 06 — Games table and real leaderboards in Supabase

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-11-16
> **Objective:** Move the game catalog into a Supabase `games` table and persist scores in a Supabase `scores` table, so `/salon`, the home page, and the game pages show real, fresh rankings instead of mock data.

## Why this spec exists

SPEC 04 connected the app to Supabase and deliberately created no tables. Until now, the catalog lives in `lib/data.ts` and scores live in `localStorage` (`av_scores`), so no ranking is shared between players. This spec creates the first two tables and replaces the mock catalog stats, the seeded leaderboards, and the home page mock rankings with real queries.

The user chose to deliver the catalog table and the scores table in one spec, against the recommendation to split them (see Decisions). Steps are ordered so each one is committable on its own: first the `games` table and catalog, then scores.

## Scope

**In:**

- Migration creating `games`, `scores`, and the `game_stats` view, with RLS policies and indexes (see Data model).
- Seed the 8 current games into `games` from `lib/data.ts` (same ids, titles, copy, categories, covers, colors).
- Generated TypeScript types in `lib/supabase/database.types.ts`, used by both Supabase client factories.
- Data access helpers in `lib/queries.ts` (server-only): `getGames`, `getGame`, `getTopScores`, `getRecentScores`, `getGameStats`.
- Replace `GAMES` / `getGame` usage in the home page, library, game card, `/juegos/[id]`, and `/juegos/[id]/jugar` with `games` rows. Remove `GAMES`, `getGame`, `seededScores`, `RECENT_SCORES`, `TOP_PLAYERS`, and the `best` / `plays` mock fields from `lib/data.ts`.
- Per-game `best` and `plays` derived from `scores` through `game_stats` (`best = max(score)`, `plays = count(*)` of saved scores, not of started games).
- `/salon`: top 20 scores for the selected game, game tabs driven by the `?game=<id>` search param, default is the first game by `sort_order`. The page becomes a Server Component; tabs are links.
- `/juegos/[id]`: top 10 scores for that game.
- Home page: "recent scores" (last 7 by `created_at`, with game title and color) and "top scores" (5 highest single scores across all games, each shown with its game name). Both replace the mock lists.
- Empty states in Spanish on every board and on the home lists when there are no scores.
- `saveScore` in `lib/session.tsx` inserts into `scores` through the browser client and no longer touches `localStorage`. The `av_scores` key and `SavedScore` type are removed. `av_user` is unchanged.
- Guests and logged-in mock users can both save. The name comes from the existing name input in the game-over modal.
- Fresh data on every request: queries run inside `<Suspense>` boundaries with no caching.
- Short update to `CLAUDE.md` about the tables, the query helpers, and the removal of `av_scores`.

**Out of scope (for future specs):**

- Realtime updates on open pages. Boards are fresh whenever a page is loaded; pushing live updates to a page already open needs a Realtime subscription and its own RLS and reconnect handling.
- Real authentication, `profiles`, and linking scores to a user id. Scores carry only a typed name.
- Anti-cheat or server-side score verification beyond the DB `CHECK` constraints. Anonymous inserts are spoofable by design.
- Rate limiting or abuse protection on inserts.
- Migrating existing local `av_scores` values to the database. They are ignored.
- Pagination, "my best scores", per-player pages, or filters by date range.
- A global per-player ranking (summing or merging scores across games). Names are not unique and score scales differ per game.
- Real players for the 7 games that still use the mock arena.
- Admin UI to edit `games`.
- Tests.

## Data model

Migration `create_games_and_scores` (applied with the Supabase MCP `apply_migration`; the SQL is also saved as a file under `supabase/migrations/`).

```sql
create table public.games (
  id         text primary key,          -- slug, e.g. 'rocas'; same ids as today
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,             -- CSS class, e.g. 'cover-rocas'
  color      text not null check (color in ('cyan','magenta','green','yellow')),
  sort_order int  not null unique,
  created_at timestamptz not null default now()
);

create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games(id),
  name       text not null check (char_length(name) between 1 and 12),
  score      integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_created_idx    on public.scores (created_at desc);

create view public.game_stats with (security_invoker = true) as
  select game_id, max(score) as best, count(*)::int as plays
  from public.scores
  group by game_id;
```

RLS (enabled on both tables):

- `games`: `select` for `anon` and `authenticated`. No insert, update, or delete policies.
- `scores`: `select` for `anon` and `authenticated`; `insert` for `anon` and `authenticated` (the `CHECK` constraints enforce the limits). No update or delete policies.

TypeScript shapes used by the app (from the generated types):

```ts
// lib/queries.ts
export type Game = Tables<"games">; // replaces the old Game type
export type GameWithStats = Game & { best: number | null; plays: number };
export type ScoreWithGame = {
  id: string;
  name: string;
  score: number;
  created_at: string;
  game: Pick<Game, "id" | "title" | "color">;
};
```

Conventions:

- `games.id` stays the URL slug, so `/juegos/rocas` and `/juegos/rocas/jugar` do not change.
- `sort_order` follows the current array order in `lib/data.ts` (1 to 8).
- Games with no scores have no row in `game_stats`; the helpers return `best: null` and `plays: 0`, and the UI shows `—` for a null best.
- Rank is the row position in the query result (`order by score desc, created_at asc`); ties keep the earlier score first.
- Dates are stored as `timestamptz` and shown as `DD/MM/YYYY` (boards) or `hace N min/h/d` (home recent list) using `es-ES` formatting.
- `plays` is shown as a plain integer with `es-ES` thousands separators, not as `12.4K`.
- Server queries use `createClient()` from `lib/supabase/server.ts` inside a `<Suspense>` boundary; the browser client is used only for `saveScore`.

## Implementation plan

1. Apply the `games` part of the migration (table, RLS, seed of the 8 games) with `apply_migration`, then save the SQL under `supabase/migrations/`. Manual check: `list_tables` shows `games` with RLS on and 8 rows.
2. Generate types with `generate_typescript_types` into `lib/supabase/database.types.ts` and pass `Database` to both `createClient()` factories. Manual check: `npx tsc --noEmit` passes.
3. Read the Next.js 16 guides in `node_modules/next/dist/docs/` on `cacheComponents`, `generateStaticParams`, dynamic params, and `searchParams`. Create `lib/queries.ts` with `getGames` and `getGame`. Manual check: `npm run lint` passes.
4. Switch the home games preview, library, `/juegos/[id]`, and `/juegos/[id]/jugar` to `getGames` / `getGame` inside `<Suspense>`; return `notFound()` for an unknown id; remove `generateStaticParams` if the docs say it conflicts. Keep `best` / `plays` temporarily as `—` / `0`. Manual check: all 8 games render and `/juegos/xyz` shows not found.
5. Apply the `scores` part of the migration (table, indexes, `game_stats` view, RLS). Manual check: `list_tables` shows `scores`; `get_advisors` (security) reports no missing-RLS finding; an `anon` insert with `score = -1` or a 13-character name is rejected.
6. Regenerate types. Add `getGameStats`, `getTopScores(gameId, limit)`, and `getRecentScores(limit)` to `lib/queries.ts`; feed `best` / `plays` into `GameCard` and `/juegos/[id]`. Manual check: games with no scores show `—` and `0`.
7. Change `saveScore` in `lib/session.tsx` to an async insert through the browser client and remove the `av_scores` code. Update `components/game-player.tsx` to await it, show an error message if the insert fails, and keep the modal open for a retry. Manual check: play ROCAS, save a score, and see the row in the DB with `execute_sql`.
8. Rewrite `/salon` as a Server Component: read `searchParams.game`, query the top 20, and render tabs as `<Link href="/salon?game=<id>">`. Replace `components/hall-of-fame.tsx` (client, seeded) with a server component. Manual check: switching tabs changes the rows; an invalid `game` param falls back to the first game.
9. Add the top-10 board to `/juegos/[id]` with an empty state. Manual check: a saved score appears on reload.
10. Replace home `RECENT_SCORES` and `TOP_PLAYERS` with `getRecentScores(7)` and `getTopScores(null, 5)` (global, each row with game name), with empty states. Manual check: a newly saved score appears at the top of "recent" on reload.
11. Delete the dead mock data and types from `lib/data.ts`, then add the `CLAUDE.md` note. Manual check: `grep` finds no `seededScores`, `av_scores`, `RECENT_SCORES`, or `TOP_PLAYERS`.
12. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has exactly 8 rows with the same ids, titles, categories, covers, and colors as the old `GAMES` array, and `sort_order` 1 to 8.
- [ ] RLS is enabled on `games` and `scores`; `get_advisors` (security) reports no missing-RLS finding for either table.
- [ ] An `anon` insert into `scores` with `score = -1`, `score = 10000001`, an empty name, a 13-character name, or an unknown `game_id` is rejected by the database.
- [ ] An `anon` `update` or `delete` on `scores` and any `anon` write to `games` affect 0 rows or error.
- [ ] No secret or service-role key appears in the repo or in the client bundle.
- [ ] Saving a score from `/juegos/rocas/jugar` inserts one row in `scores` with `game_id = 'rocas'`, the typed name, and the final score.
- [ ] A guest (no `av_user`) can save a score; a logged-in mock user can save a score.
- [ ] If the insert fails (for example the network is offline), the modal shows an error and lets the player retry; no score is stored in `localStorage`.
- [ ] `localStorage` has no `av_scores` key after saving, and no code reads or writes it.
- [ ] `/salon` shows at most 20 rows for the selected game ordered by score descending, with rank, name, score, and `DD/MM/YYYY` date.
- [ ] `/salon?game=rocas` selects the ROCAS tab; `/salon?game=xyz` falls back to the first game by `sort_order`.
- [ ] `/salon` for a game with no scores shows a Spanish empty state, not an empty table.
- [ ] `/juegos/[id]` shows at most 10 rows for that game, plus an empty state when there are none.
- [ ] `best` and `plays` on game cards and on `/juegos/[id]` equal `max(score)` and `count(*)` from `scores` for that game; games with no scores show `—` and `0`.
- [ ] After saving a score and reloading `/salon`, the new row is visible with no manual cache clearing (no stale cache).
- [ ] The home page "recent scores" shows the last 7 saved scores newest first with game title; "top scores" shows the 5 highest single scores with game name; both show an empty state when `scores` is empty.
- [ ] `lib/data.ts` no longer exports `GAMES`, `getGame`, `seededScores`, `RECENT_SCORES`, or `TOP_PLAYERS`.
- [ ] `/`, `/biblioteca`, `/salon`, `/acceso`, `/acerca`, `/juegos/caida`, `/juegos/caida/jugar`, and `/juegos/rocas/jugar` render with no console errors.
- [ ] `/juegos/does-not-exist` returns the not-found page.
- [ ] The ROCAS game still plays and shows HUD, pause, and game over exactly as in SPEC 05.

## Decisions

- **Yes:** one spec for `games` and `scores`, as the user chose. **No:** splitting into SPEC 06 (games) and SPEC 07 (scores), which was the recommendation because this touches the schema, the catalog, `/salon`, the home page, and the game pages. Accepted risk: a longer plan. Mitigation: steps 1–4 deliver `games` alone and steps 5–11 deliver `scores`, each committable.
- **Yes:** Supabase `scores` table as the single source of truth. A shared ranking needs a shared store. **No:** keeping `localStorage`, which cannot rank different players.
- **Yes:** anonymous insert through RLS with `CHECK` constraints and a typed name. It matches the current guest and name-input flow and needs no auth spec. **No:** waiting for real auth, which would block the leaderboard. **No:** a Server Action with extra checks; it would not stop a forged request either, since the publishable key allows direct inserts anyway.
- **Yes:** `score` limited to 0–10,000,000 and `name` to 1–12 characters in the database. A cheap upper bound against absurd values. **No:** per-game score limits now; they need real game tuning.
- **Yes:** `games` table with all catalog fields (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `sort_order`), seeded in the migration. One source for catalog data. **No:** only `id`, `title`, `cat`, which would split the data between the DB and code.
- **Yes:** `games.id` is a text slug, not a uuid. URLs and `game-player` dispatch already use the slug (`rocas`).
- **Yes:** `best` and `plays` derived from `scores` through the `game_stats` view with `security_invoker`. No duplicated counters to keep in sync. **No:** stored columns updated by trigger, which adds moving parts. **No:** keeping mock values, which would contradict the real boards. Note: `plays` counts saved scores, not started games.
- **Yes:** global "top scores" is the 5 highest single scores with game name. No cross-game math. **No:** summing best scores per name, because names are not unique and scales differ (DUELO PIXEL ~24 vs CAÍDA ~184K). **No:** dropping the home list, because the home page keeps its two-column layout.
- **Yes:** fresh data on every request in `<Suspense>`. This is the "synced whenever someone opens the leaderboard" behavior the user asked for. **No:** short caching, since a just-saved score might not show. **No:** Realtime now, since reload-fresh already covers the stated need; live push to an open page is a separate feature (see Out of scope).
- **Yes:** `/salon` tabs through the `?game=` search param and links, so a tab is shareable and server-rendered. **No:** client state with `useState` as today, which cannot fetch server data without extra client code.
- **Yes:** top 20 on `/salon`, top 10 on `/juegos/[id]`. **No:** pagination now.
- **Yes:** drop old `av_scores` values without migration. Client-forged local data would pollute a shared board. **No:** one-time upload.
- **Yes:** keep `av_user` mock session untouched. Auth is a later spec.
- **Yes:** save the migration SQL in `supabase/migrations/` and commit generated types, so the schema is reproducible and typed. SPEC 04 deferred types until tables existed.
- **Yes:** code, identifiers, and this spec in English; UI strings (empty states, error messages) in Spanish, per project convention.

## Risks

| Risk                                                                                         | Mitigation                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Anyone can insert fake scores with the publishable key                                       | Accepted for this spec (no auth). `CHECK` limits bound the damage. Real auth and score linking go in a later spec. |
| Anonymous inserts can be spammed, filling the table                                          | Accepted for now; rate limiting is out of scope. Revisit with auth or an Edge Function.                            |
| `cacheComponents` rejects request-time access (`cookies()`, `searchParams`) outside Suspense | Read the Next.js docs in step 3; every query component sits inside `<Suspense>` with a fallback.                   |
| Removing `generateStaticParams` for game routes changes prerendering                         | Verify with `npm run build`; game pages render dynamically inside `<Suspense>`.                                    |
| `game_stats` view exposes data the caller should not see                                     | `security_invoker = true` so the view obeys the caller's RLS on `scores`; check with `get_advisors`.               |
| Seed ids drift from the ids used in `components/game-player.tsx` (`rocas`)                   | Seed uses the exact ids from `lib/data.ts`; acceptance criteria check them.                                        |
| Supabase insert fails mid-game-over and the score is lost                                    | Show a Spanish error, keep the modal open, allow retry; no silent fallback to `localStorage`.                      |
| Tie ordering looks random                                                                    | Order by `score desc, created_at asc` everywhere.                                                                  |

## What is **not** in this spec

- Realtime or any push update to an already-open page.
- Real authentication, profiles, or scores linked to a user.
- Anti-cheat, score verification, or rate limiting.
- Migrating local `av_scores` data.
- Pagination, personal bests, per-player pages, or a cross-game player ranking.
- An admin UI for `games`.
- Real players for the other 7 games.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
