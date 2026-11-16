# SPEC 06 — Games table and real leaderboards in Supabase

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-11-16
> **Revised:** 2026-11-16 — after steps 1–5 were implemented, the scope changed: no fake data anywhere, so the catalog keeps only ROCAS (the one real game). Steps 6–13 below are the remaining work.
> **Objective:** Keep only the real game (ROCAS) in a Supabase `games` table and persist its scores in a Supabase `scores` table, so `/salon`, the home page, and the game pages show real, fresh rankings and no mock data.

## Why this spec exists

SPEC 04 connected the app to Supabase and deliberately created no tables. Until now, the catalog lives in `lib/data.ts` and scores live in `localStorage` (`av_scores`), so no ranking is shared between players. This spec creates the first two tables and replaces the mock catalog stats, the seeded leaderboards, and the home page mock rankings with real queries.

**Scope change (decided during implementation):** the app must show no fake data. Only ROCAS has a real engine (SPEC 05); the other 7 games only had a mock arena that produced random scores. They are removed from the catalog, the mock arena is removed from the player, and every number shown on boards, cards, and the home page comes from the database.

The catalog table and the scores table are delivered in one spec, against the recommendation to split them (see Decisions). Steps are ordered so each one is committable on its own.

## Scope

**In:**

- Migration creating `games`, `scores`, and the `game_stats` view, with RLS policies and indexes (see Data model). **Done in steps 1 and 5.**
- Seed of the catalog from `lib/data.ts`. **Done in step 1 with 8 rows; a new migration (step 6) deletes the 7 mock games so only `rocas` remains.**
- Generated TypeScript types in `lib/supabase/database.types.ts`, used by both Supabase client factories.
- Data access helpers in `lib/queries.ts`: `getGames`, `getGame`, `getTopScores`, `getRecentScores`, `getGameStats`, `getHomeStats`.
- Replace `GAMES` / `getGame` usage in the home page, library, game card, `/juegos/[id]`, and `/juegos/[id]/jugar` with `games` rows. **Done in step 4.** Remove `GAMES`, `getGame`, `seededScores`, `RECENT_SCORES`, `TOP_PLAYERS`, `HOME_STATS`, and the `best` / `plays` mock fields from `lib/data.ts`.
- Per-game `best` and `plays` derived from `scores` through `game_stats` (`best = max(score)`, `plays = count(*)` of saved scores, not of started games).
- Remove the mock arena from `components/game-player.tsx` (the random-score timer, the `game-arena` markup, and the `isRocas` branching). The player renders only the ROCAS canvas.
- `/salon`: top 20 scores for the selected game, game tabs driven by the `?game=<id>` search param, default is the first game by `sort_order`. The page becomes a Server Component; tabs are links. With one game there is one tab; the code stays generic so a future game appears without a rewrite.
- `/juegos/[id]`: top 10 scores for that game.
- Home page: "recent scores" (last 7 by `created_at`, with game title and color) and "top scores" (5 highest single scores across all games, each shown with its game name). Both replace the mock lists.
- Home stats block (`HOME_STATS`): replaced by three real values from the database: number of games, number of saved scores, and highest saved score (`—` when there are none). The invented claims ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING") are removed.
- Empty states in Spanish on every board and on the home lists when there are no scores.
- `saveScore` in `lib/session.tsx` inserts into `scores` through the browser client and no longer touches `localStorage`. The `av_scores` key and `SavedScore` type are removed. `av_user` is unchanged.
- Guests and logged-in mock users can both save. The name comes from the existing name input in the game-over modal.
- Fresh data on every request: queries run inside `<Suspense>` boundaries with no caching.
- Update `CLAUDE.md` about the tables, the query helpers, the removal of `av_scores`, and the removal of the mock arena (the "other 7 games keep the mock arena" note is no longer true).

**Out of scope (for future specs):**

- Realtime updates on open pages. Boards are fresh whenever a page is loaded; pushing live updates to a page already open needs a Realtime subscription and its own RLS and reconnect handling.
- Real authentication, `profiles`, and linking scores to a user id. Scores carry only a typed name.
- Anti-cheat or server-side score verification beyond the DB `CHECK` constraints. Anonymous inserts are spoofable by design.
- Rate limiting or abuse protection on inserts.
- Migrating existing local `av_scores` values to the database. They are ignored.
- Pagination, "my best scores", per-player pages, or filters by date range.
- A global per-player ranking (summing or merging scores across games). Names are not unique and score scales differ per game.
- Adding any other game. Each future game gets its own spec with its engine and its own `games` row; nothing here keeps a placeholder for it.
- Marketing copy that is not a data claim (hero text, FEATURES, FAQ, pricing). It stays as is.
- Admin UI to edit `games`.
- Tests.

## Data model

Migration `create_games` (step 1, applied) and `create_scores` (step 5, applied) created the tables. Migration `remove_mock_games` (step 6) trims the catalog. All applied with the Supabase MCP `apply_migration`; each SQL is also saved as a file under `supabase/migrations/`.

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

Step 6 migration `remove_mock_games`:

```sql
delete from public.games where id <> 'rocas';
update public.games set sort_order = 1 where id = 'rocas';
```

This is safe because `scores` is empty at that point (no score has been saved yet) and the foreign key would block the delete otherwise. The seed SQL for the removed games stays in `supabase/migrations/20261116000000_create_games.sql` as history.

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
export type HomeStats = {
  games: number;
  scores: number;
  topScore: number | null;
};
```

Conventions:

- `games.id` stays the URL slug, so `/juegos/rocas` and `/juegos/rocas/jugar` do not change.
- After step 6, `games` has one row (`rocas`, `sort_order` 1). `sort_order` stays unique and is the order future games will use.
- Games with no scores have no row in `game_stats`; the helpers return `best: null` and `plays: 0`, and the UI shows `—` for a null best.
- Rank is the row position in the query result (`order by score desc, created_at asc`); ties keep the earlier score first.
- Dates are stored as `timestamptz` and shown as `DD/MM/YYYY` (boards) or `hace N min/h/d` (home recent list) using `es-ES` formatting.
- `plays` is shown as a plain integer with `es-ES` thousands separators, not as `12.4K`.
- Server queries use `createClient()` from `lib/supabase/server.ts` inside a `<Suspense>` boundary; the browser client is used only for `saveScore`.

## Implementation plan

Steps 1–5 are implemented and verified before this revision (kept here for the record).

1. ✅ Apply the `games` part of the migration (table, RLS, seed of the 8 games), save the SQL under `supabase/migrations/`. Check: `list_tables` shows `games` with RLS on.
2. ✅ Generate types into `lib/supabase/database.types.ts` and pass `Database` to both `createClient()` factories. Check: `npx tsc --noEmit` passes.
3. ✅ Read the Next.js 16 guides on `cacheComponents`, `generateStaticParams`, dynamic params, and `searchParams`. Create `lib/queries.ts` with `getGames` and `getGame`.
4. ✅ Switch the home games preview, library, `/juegos/[id]`, and `/juegos/[id]/jugar` to `getGames` / `getGame` inside `<Suspense>`; `notFound()` for an unknown id; remove `generateStaticParams`. `best` / `plays` temporarily `—` / `0`.
5. ✅ Apply the `scores` part of the migration (table, indexes, `game_stats` view, RLS). Check: `get_advisors` reports no missing-RLS finding; invalid `anon` inserts are rejected.

Remaining work:

6. Apply migration `remove_mock_games` (see Data model) with `apply_migration` and save the SQL under `supabase/migrations/`. Manual check: `execute_sql` shows `games` has exactly one row, `rocas`, with `sort_order` 1; `/biblioteca` shows one card; `/juegos/caida` shows the not-found page.
7. Regenerate types. Add `getGameStats`, `getTopScores(gameId, limit)`, `getRecentScores(limit)`, and `getHomeStats()` to `lib/queries.ts`; feed `best` / `plays` into `GameCard` and `/juegos/[id]`. Manual check: ROCAS shows `—` and `0` while `scores` is empty.
8. Change `saveScore` in `lib/session.tsx` to an async insert through the browser client and remove the `av_scores` code. In `components/game-player.tsx`: remove the mock arena (random-score `useEffect`, the `game-arena` block, the `isRocas` and `POINTS_PER_LEVEL` branching) so it renders only `AsteroidsCanvas`; await `saveScore`, show a Spanish error if the insert fails, and keep the modal open for a retry. Remove the CSS rules for the mock arena if nothing else uses them. Manual check: play ROCAS, save a score, and see the row in the DB with `execute_sql`; the HUD, pause, and game over behave as in SPEC 05.
9. Rewrite `/salon` as a Server Component: read `searchParams.game`, query the top 20, and render tabs as `<Link href="/salon?game=<id>">`. Replace `components/hall-of-fame.tsx` (client, seeded) with a server component. Manual check: the single tab is selected; an invalid `game` param falls back to the first game.
10. Add the top-10 board to `/juegos/[id]` with an empty state. Manual check: a saved score appears on reload.
11. Replace home `RECENT_SCORES`, `TOP_PLAYERS`, and `HOME_STATS` with `getRecentScores(7)`, `getTopScores(null, 5)` (global, each row with game name), and `getHomeStats()`, with empty states. Manual check: a newly saved score appears at the top of "recent" and the stats update on reload.
12. Delete the dead mock data and types from `lib/data.ts` (`GAMES`, `Game`, `getGame`, `seededScores`, `ScoreRow` if unused, `RECENT_SCORES`, `TOP_PLAYERS`, `HOME_STATS`, and their types), then update `CLAUDE.md`. Manual check: `grep` finds no `seededScores`, `av_scores`, `RECENT_SCORES`, `TOP_PLAYERS`, `HOME_STATS`, or `game-arena`.
13. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has exactly 1 row: `rocas`, with the same title, copy, category, cover, and color as the old `GAMES` entry, and `sort_order` 1.
- [ ] RLS is enabled on `games` and `scores`; `get_advisors` (security) reports no missing-RLS finding for either table.
- [ ] An `anon` insert into `scores` with `score = -1`, `score = 10000001`, an empty name, a 13-character name, or an unknown `game_id` is rejected by the database.
- [ ] An `anon` `update` or `delete` on `scores` and any `anon` write to `games` affect 0 rows or error.
- [ ] No secret or service-role key appears in the repo or in the client bundle.
- [ ] Saving a score from `/juegos/rocas/jugar` inserts one row in `scores` with `game_id = 'rocas'`, the typed name, and the final score.
- [ ] A guest (no `av_user`) can save a score; a logged-in mock user can save a score.
- [ ] If the insert fails (for example the network is offline), the modal shows an error and lets the player retry; no score is stored in `localStorage`.
- [ ] `localStorage` has no `av_scores` key after saving, and no code reads or writes it.
- [ ] `components/game-player.tsx` has no random-score timer and no mock arena; every score it shows or saves comes from the ROCAS engine.
- [ ] `/salon` shows at most 20 rows for the selected game ordered by score descending, with rank, name, score, and `DD/MM/YYYY` date.
- [ ] `/salon?game=rocas` selects the ROCAS tab; `/salon?game=xyz` falls back to the first game by `sort_order`.
- [ ] `/salon` with no scores shows a Spanish empty state, not an empty table.
- [ ] `/juegos/rocas` shows at most 10 rows, plus an empty state when there are none.
- [ ] `best` and `plays` on the game card and on `/juegos/rocas` equal `max(score)` and `count(*)` from `scores`; with no scores they show `—` and `0`.
- [ ] After saving a score and reloading `/salon`, the new row is visible with no manual cache clearing (no stale cache).
- [ ] The home page "recent scores" shows the last 7 saved scores newest first with game title; "top scores" shows the 5 highest single scores with game name; both show an empty state when `scores` is empty.
- [ ] The home stats block shows the real number of games, the real number of saved scores, and the real highest score (`—` when there are none); the text "12+", "MILES", and "GLOBAL" claims are gone.
- [ ] `/biblioteca` and the home games rail show only ROCAS.
- [ ] `lib/data.ts` no longer exports `GAMES`, `Game`, `getGame`, `seededScores`, `RECENT_SCORES`, `TOP_PLAYERS`, or `HOME_STATS`.
- [ ] `/`, `/biblioteca`, `/salon`, `/acceso`, `/acerca`, `/juegos/rocas`, and `/juegos/rocas/jugar` render with no console errors.
- [ ] `/juegos/does-not-exist` and `/juegos/caida` return the not-found page.
- [ ] The ROCAS game still plays and shows HUD, pause, and game over exactly as in SPEC 05.

## Decisions

- **Yes:** no fake data anywhere; only ROCAS stays in the catalog. The user changed their mind after step 5: a board with random scores from games that cannot be played is misleading. **No:** keeping the 7 games as "coming soon" cards or hidden rows with a flag; both keep placeholder data around for features that do not exist.
- **Yes:** delete the 7 rows with a new migration (`remove_mock_games`) instead of editing the applied migration. The migration history stays honest and the file can be replayed. **No:** editing `create_games`, which is already applied.
- **Yes:** remove the mock arena from `game-player.tsx`. With one real game it only produced fake scores that `saveScore` would persist. **No:** keeping it as unreachable code.
- **Yes:** replace `HOME_STATS` with three real numbers (games, saved scores, highest score). The old values were invented claims. **No:** leaving them, because they contradict the no-fake-data rule; **No:** deleting the block, because the home page keeps its stats strip. Marketing copy that is not a number claim stays.
- **Yes:** `/salon` keeps the `?game=` tabs even with one game. Adding a game later needs no rewrite. **No:** dropping the tabs now and rebuilding them when game 2 lands.
- **Yes:** one spec for `games` and `scores`, as the user chose. **No:** splitting into SPEC 06 (games) and SPEC 07 (scores), the recommendation. Accepted risk: a longer plan. Mitigation: steps 1–4 delivered `games` alone and steps 5–12 deliver `scores`, each committable.
- **Yes:** Supabase `scores` table as the single source of truth. A shared ranking needs a shared store. **No:** keeping `localStorage`, which cannot rank different players.
- **Yes:** anonymous insert through RLS with `CHECK` constraints and a typed name. It matches the current guest and name-input flow and needs no auth spec. **No:** waiting for real auth. **No:** a Server Action with extra checks; it would not stop a forged request either, since the publishable key allows direct inserts anyway.
- **Yes:** `score` limited to 0–10,000,000 and `name` to 1–12 characters in the database. A cheap upper bound against absurd values. **No:** per-game score limits now.
- **Yes:** `games` table with all catalog fields, so there is one source for catalog data. **No:** only `id`, `title`, `cat`, which would split the data between the DB and code.
- **Yes:** `games.id` is a text slug, not a uuid. URLs and `game-player` already use the slug (`rocas`).
- **Yes:** `best` and `plays` derived from `scores` through the `game_stats` view with `security_invoker`. No duplicated counters to keep in sync. **No:** stored columns updated by trigger. **No:** keeping mock values. Note: `plays` counts saved scores, not started games.
- **Yes:** global "top scores" is the 5 highest single scores with game name. No cross-game math. **No:** summing best scores per name (names are not unique, scales differ per game).
- **Yes:** fresh data on every request in `<Suspense>`. **No:** short caching, since a just-saved score might not show. **No:** Realtime now; reload-fresh covers the stated need.
- **Yes:** `/salon` tabs through the `?game=` search param and links, so a tab is shareable and server-rendered. **No:** client state with `useState`.
- **Yes:** top 20 on `/salon`, top 10 on `/juegos/[id]`. **No:** pagination now.
- **Yes:** drop old `av_scores` values without migration. Client-forged local data would pollute a shared board.
- **Yes:** keep `av_user` mock session untouched. Auth is a later spec.
- **Yes:** save the migration SQL in `supabase/migrations/` and commit generated types.
- **Yes:** code, identifiers, and this spec in English; UI strings (empty states, error messages) in Spanish, per project convention.

## Risks

| Risk                                                                                         | Mitigation                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Anyone can insert fake scores with the publishable key                                       | Accepted for this spec (no auth). `CHECK` limits bound the damage. Real auth and score linking go in a later spec. |
| Anonymous inserts can be spammed, filling the table                                          | Accepted for now; rate limiting is out of scope. Revisit with auth or an Edge Function.                            |
| `cacheComponents` rejects request-time access (`cookies()`, `searchParams`) outside Suspense | Every query component sits inside `<Suspense>` with a fallback (already applied in step 4).                        |
| Removing `generateStaticParams` for game routes changes prerendering                         | Verify with `npm run build`; game pages render dynamically inside `<Suspense>`.                                    |
| `game_stats` view exposes data the caller should not see                                     | `security_invoker = true` so the view obeys the caller's RLS on `scores`; checked with `get_advisors`.             |
| The delete in `remove_mock_games` fails if a score for a removed game exists                 | Run it first, while `scores` is empty (step 6, right after step 5). Check `count(*)` on `scores` before applying.  |
| Library, home, and `/salon` look sparse with one game                                        | Accepted: honest empty is better than fake content. Layouts already handle short lists.                            |
| Supabase insert fails mid-game-over and the score is lost                                    | Show a Spanish error, keep the modal open, allow retry; no silent fallback to `localStorage`.                      |
| Tie ordering looks random                                                                    | Order by `score desc, created_at asc` everywhere.                                                                  |

## What is **not** in this spec

- Realtime or any push update to an already-open page.
- Real authentication, profiles, or scores linked to a user.
- Anti-cheat, score verification, or rate limiting.
- Migrating local `av_scores` data.
- Pagination, personal bests, per-player pages, or a cross-game player ranking.
- Any other game (engine or catalog row).
- Changes to non-data marketing copy.
- An admin UI for `games`.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
