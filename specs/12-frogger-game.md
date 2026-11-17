# SPEC 12 — Frogger game (FROGGER) playable in the platform

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 10
> **Date:** 2026-11-17
> **Objective:** Add FROGGER as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/frogger/jugar`.

## Why this spec exists

There is no reference game folder. FROGGER is the classic lane-crossing arcade game, written from scratch with primitive canvas shapes (no image assets). The design comes from the game-jam draft `specs/game-jam/frogger/01-frogger-core.md`, rewritten here to fit the platform's engine pattern.

SPEC 05 set the engine pattern, SPEC 06 put games and scores in Supabase, SPEC 10 added the on-screen gamepad. This is the fifth real game. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD, pause, game-over modal and score saving.

The old draft assumed a React component, a dedicated play-page and its own score modal. None of that exists in this repo and none of it is needed: a new game only adds files and does not change the shell.

## Scope

**In:**

- Engine in `lib/games/frogger/` (`constants.ts`, `levels.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: zones, lanes, entities, frog, bays and the round timer bar. Score, lives, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "frogger"`, logic size 640×560, HUD fields `lives` (`hearts`) and `level` (`pad2`).
- Migration `supabase/migrations/20261116000800_add_frogger_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-rana` (`app/globals.css`). No new cover CSS.
- Rules:
  - Board 16 columns × 14 rows, `CELL = 40` px, logic canvas 640×560. Origin top-left, cell `(col, row)` draws at `(col × 40, row × 40)`.
  - Rows (0 = top): row 0 goal bays, rows 1–6 river (6 lanes), row 7 safe median, rows 8–12 road (5 lanes), row 13 start.
  - Frog starts at row 13, col 7 (centre-left), facing up. The frog's `col` is a float, because a log or turtle group carries it sideways; rows are always integers.
  - Controls: `←` `↑` `→` `↓` and `A` `W` `D` `S`. One key press is one hop of one cell. Key auto-repeat is ignored. A hop takes 120 ms; one pending direction is buffered while hopping and applied when the hop ends. Hops that would leave the board (`col` < 0, `col` > 15, row > 13) are ignored.
  - Road: vehicles (cars 1 cell, trucks 2–3 cells) move horizontally in a loop; lane direction alternates. Touching a vehicle kills the frog.
  - River: logs (2–4 cells) and turtle groups (2–3 cells) move horizontally in a loop. The frog survives on the river only while its centre (`col + 0.5`) is over a log or a visible turtle of its lane. It is carried at the lane speed. Falling in the water kills the frog.
  - Turtles cycle per group: 3 s visible, 1.5 s submerged, with a blink during the last 0.5 s of the visible phase. A submerged group does not support the frog (death).
  - Carried off the left or right edge of the board (`col + 0.5` < 0 or > 16) kills the frog.
  - Bays: 5 bays of 2 cells each at cols 1–2, 4–5, 7–8, 10–11 and 13–14 on row 0; the cells between them are walls. Landing on row 0 with the centre over a free bay fills it. Landing on a wall, on a filled bay or outside any bay kills the frog.
  - A filled bay shows a frog silhouette. When a bay is filled, the next frog spawns at the start. When all 5 bays are filled the round is complete: bays clear, `level` + 1, lanes rebuilt faster, timer reset.
  - Round timer: 15 s at level 1, −1 s per level, minimum 8 s. At 0 the frog dies. The timer resets on respawn and on bay fill.
  - Lives: 3. Each death costs 1 life. At 0 lives, `state = "gameover"` and `onGameOver(score)` fires once. After a death (not game over) the engine freezes the world for 0.4 s showing a marker where the frog died, then respawns the frog.
  - Scoring: +10 for each row the frog reaches that is higher than any row reached since the last spawn-after-bay (so no farming by hopping back and forth); +50 for filling a bay; + `remaining seconds × 10` (rounded down) on filling a bay; +200 when the round completes.
  - Speed: lane speeds are in cells per second and grow ×1.15 per level, capped at ×2.5.
- Lane data in `levels.ts`: one table per zone with `row`, `dir`, `speed`, `kind`, `width` and `spacing` (start-to-start distance in cells). Each lane repeats its pattern around a loop of `ceil(20 / spacing) × spacing` cells, so entities wrap with no pop-in. Layout (speed in cells/s at level 1):

  | Row | Zone  | Dir | Speed | Entity      | Spacing |
  | --- | ----- | --- | ----- | ----------- | ------- |
  | 1   | river | →   | 2.0   | log × 4     | 8       |
  | 2   | river | ←   | 1.6   | turtles × 2 | 5       |
  | 3   | river | →   | 1.0   | log × 2     | 5       |
  | 4   | river | →   | 1.8   | log × 3     | 7       |
  | 5   | river | ←   | 1.4   | turtles × 3 | 6       |
  | 6   | river | →   | 1.2   | log × 3     | 6       |
  | 8   | road  | ←   | 1.4   | truck × 3   | 8       |
  | 9   | road  | →   | 2.4   | car × 1     | 5       |
  | 10  | road  | ←   | 1.8   | truck × 2   | 6       |
  | 11  | road  | →   | 3.2   | car × 1     | 6       |
  | 12  | road  | ←   | 2.4   | car × 1     | 4       |

  Every river lane leaves a gap of at least 1 cell between entities, and every road lane leaves a gap of at least 2 cells. The table is a starting point; `/spec-impl` may tune numbers if a lane is unfair, as long as the rules above hold.

- Drawing (primitives only, no image): road dark grey with lane dashes, river deep blue, safe rows dark green, bays bright green with a gold border; cars red / yellow / blue with wheels, trucks grey with a cab, logs brown with grain lines, visible turtles green shells, submerged turtles a faint outline; the frog is a bright green body with two eyes and legs spread during a hop; the timer bar is an 8 px strip along the bottom of the canvas, green → yellow → red as time runs out. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: add the `frogger` row to the Games table.

**Out of scope (for future specs):**

- Sound and music.
- Bitmap sprites.
- Skins (`classic` / `neon` / `retro`): run `@skin-designer frogger` afterwards.
- Mobile / touch mapping: arrow keys already work with the SPEC 10 d-pad; run `@mobile-porter frogger` afterwards.
- Death animations, particles, bonus fly in a bay, crocodile logs, snakes, lady-frog pickup.
- Two-player mode, levels with different maps.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'frogger'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana por una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-rana',
  'green',
  5
);
```

`color` must be one of `cyan`, `magenta`, `green`, `yellow` (check constraint); `green` matches the cover. `sort_order` 5 is the next unique value: `asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "level", label: "Nivel", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { lives, level } }
```

```ts
// lib/games/frogger/constants.ts
const COLS = 16,
  ROWS = 14,
  CELL = 40;
const W = COLS * CELL; // 640
const H = ROWS * CELL; // 560
const HOP_MS = 120;
const START_LIVES = 3;
const START_COL = 7;
const BAYS = [1, 4, 7, 10, 13]; // first col of each 2-cell bay on row 0
const ROW_GOALS = 0,
  ROW_RIVER_TOP = 1,
  ROW_RIVER_BOT = 6,
  ROW_MEDIAN = 7,
  ROW_ROAD_TOP = 8,
  ROW_ROAD_BOT = 12,
  ROW_START = 13;
```

Conventions:

- Logic canvas is 640×560, units in pixels; entity positions and speeds are in cells (speed in cells per second, converted when advancing with `dt`).
- Time inside the engine is in seconds; `HOP_MS` is converted. Movement uses `dt`, so it does not depend on frame rate.
- State `dead` is unused: the game goes from `playing` to `gameover`. The 0.4 s death pause is an internal engine flag.
- Hit tests use the frog centre for the river and bays, and a box shrunk by 0.15 cell on each side for vehicles.

## Implementation plan

1. Create `lib/games/frogger/constants.ts` with the constants above and the board colors, and `lib/games/frogger/levels.ts` with the lane table and a `buildLanes(level)` function. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
2. Create `lib/games/frogger/engine.ts`, first part: closure state (frog, lanes, bays, lives, level, score, timer, state), `reset`, lane advance with wrap, turtle phase and the snapshot with `onChange` / `onGameOver`. Manual check: tsc passes.
3. Extend `engine.ts`: hop input (arrows and WASD, buffer of one, auto-repeat ignored, `preventDefault` on arrows, input cleared on pause, blur and stop), hop animation, row-progress scoring. Manual check: lint and tsc pass.
4. Extend `engine.ts`: collisions and support (vehicle hit, river support and carrying, submerged turtles, edge death), bay landing, round complete, death and respawn, game over. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (zones, lanes, entities, frog, bays, timer bar), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/frogger/jugar` is still the not-found page because the DB row does not exist yet; the four existing games still play.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `frogger` row; `/biblioteca` shows the card with the `.cover-rana` art; `/juegos/frogger/jugar` plays; lives, level and score update.
8. Update `CLAUDE.md`.
9. Run `npm run lint`, `npx tsc --noEmit` and `npm run build`.

No UI is designed or created in this spec (the cover is reused and the shell is unchanged), so `/frontend-design` is not required. If `/spec-impl` finds the 640×560 canvas needs shell CSS changes, or the cover needs rework, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [x] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.
- [x] `games` has a row `frogger` with title `FROGGER`, the copy above, category `ARCADE`, cover `cover-rana`, color `green` and `sort_order` 5.
- [x] `/juegos/frogger/jugar` shows a 640×560 canvas with the road, river, median, start row and 5 bays visually distinct; the frog sits at row 13, col 7; HUD lives 3, level 01 and score 0.
- [x] Each arrow / WASD press hops exactly one cell in 120 ms; holding a key does not repeat; one extra press during a hop is buffered and applied after it.
- [x] The frog cannot leave the board through the left, right or bottom edge.
- [x] Vehicles and river entities move horizontally and re-enter from the opposite side with no visible pop-in.
- [x] Touching a vehicle costs a life and respawns the frog at the start after a 0.4 s pause.
- [x] Landing in the water costs a life.
- [x] Standing on a log carries the frog at the lane speed; being carried off either edge costs a life.
- [x] Turtle groups cycle 3 s visible / 1.5 s submerged and blink before sinking; the frog dies if its turtle group submerges under it.
- [x] Landing on a free bay fills it and shows a frog silhouette; landing on a wall, a filled bay or outside a bay costs a life.
- [x] Hopping up through new rows scores +10 per new row; hopping back and forth over the same rows does not score again.
- [x] Filling a bay adds +50 plus `remaining seconds × 10`; completing the 5th bay adds +200.
- [x] Completing the round clears the bays, increments the HUD level, speeds up the lanes ×1.15 and shortens the timer by 1 s.
- [x] The timer bar shrinks and changes color; at 0 the frog dies.
- [x] At 0 lives the game-over modal opens with the final score exactly once; the HUD shows 0 lives.
- [x] FIN opens the game-over modal with the current score.
- [x] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'frogger'`, the typed name and the final score (check with `execute_sql`).
- [x] The saved score shows on `/salon?game=frogger`, on `/juegos/frogger` (top 10), and in the home "recent" list after a reload.
- [x] The card and `/juegos/frogger` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [x] `/salon` and `/biblioteca` list ASTEROIDS, TETRIS, ARKANOID, SNAKE and FROGGER; `/salon` has five tabs.
- [x] PAUSA, `P` and `Esc` freeze the canvas, timers and turtle phases; pressing again resumes with no jump.
- [x] While the game is mounted, the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [x] The canvas scales with the viewport; at 375 px width the canvas fits (the 15 px page overflow comes from the shared nav hamburger, same as Snake).
- [x] JUGAR DE NUEVO resets HUD, score, lanes, bays and timer; no duplicate loops run (lane speed stays the same after 3 restarts).
- [x] Leaving the page stops the loop: no console errors and window listeners are removed.
- [x] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` and `/juegos/snake/jugar` still play exactly as before.
- [x] No console errors on `/juegos/frogger/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with canvas primitives. **No:** bitmap sprites: there are no Frogger assets in the repo and drawing by code needs no loading step.
- **Yes:** `id` `frogger`, English slug, same convention as the other games. Title `FROGGER`.
- **Yes:** board 16×14 cells of 40 px (640×560). **No:** the draft's 480×640: it contradicted its own grid.
- **Yes:** discrete hops of one cell in 120 ms, with a float `col` only for being carried. **No:** continuous movement: it needs free-space collisions for no extra fun.
- **Yes:** ignore key auto-repeat, buffer one pending hop. **No:** repeating hops while a key is held: too easy to overshoot into traffic.
- **Yes:** lane speeds in cells per second, ×1.15 per level, capped at ×2.5. **No:** px per frame: it depends on frame rate.
- **Yes:** lanes from a data table in `levels.ts`, patterns that repeat around a loop. **No:** random lane generation: unfair gaps are hard to verify.
- **Yes:** turtles cycle 3 s visible / 1.5 s submerged with a blink warning. **No:** silent sinking: the player would die with no cue.
- **Yes:** bays are 2 cells wide with walls between them, and a hit test on the frog centre. **No:** bays as single cells: too strict while being carried.
- **Yes:** row-progress points only for rows higher than any reached since the last spawn after a bay. **No:** points on every hop up: hop-farming.
- **Yes:** round timer 15 s, −1 s per level, minimum 8 s, drawn as a strip at the bottom of the canvas. **No:** a React HUD field for time: the shell has no clock format and the bar is enough.
- **Yes:** HUD fields `lives` (`hearts`, 3) and `level` (`pad2`, 1). Score is shown by the shell.
- **Yes:** 3 lives, 0.4 s pause after a death, internal flag only. **No:** `state = "dead"`: the shell does not need it.
- **Yes:** reuse `.cover-rana` (exists, unused: cyan lanes and a green frog dot). **No:** a new cover.
- **Yes:** color `green`, matching the cover; `lime` from the draft violates the check constraint.
- **Yes:** `sort_order` 5 (next unique value).
- **Yes:** the engine behind `createEngine` and the registry; React only mounts it. **No:** a dedicated play-page or a React component with its own score modal: the shell owns those.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** a manual INSERT in the SQL editor, and no editing of applied migrations.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** skins and mobile come afterwards from `@skin-designer` and `@mobile-porter`. **No:** doing either in this spec.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                          |
| Input stuck after pause or blur                                           | Clear the pending hop on `setPaused`, on `window` blur and on `stop`.                                     |
| Frog stands still on a log and is carried through a wall of entities      | Hit tests run every frame, not only on landing.                                                           |
| A lane layout is unfair or impossible at high levels                      | Gaps are at least 1 cell (river) and 2 cells (road); speed multiplier is capped at ×2.5.                  |
| Float `col` drifts so the frog lands between bays                         | Bay and support tests use the frog centre; no snapping, the lane speed decides.                           |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                    |
| Touch players cannot hop sideways precisely                               | Out of scope here; `@mobile-porter frogger` checks the SPEC 10 d-pad afterwards.                          |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for FROGGER; fixing it needs its own change.                                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.    |

## What is **not** in this spec

- Sound and music.
- Bitmap sprites and skins.
- Touch mapping (done later by `@mobile-porter`).
- Death animations, bonus fly, crocodiles, snakes, lady frog.
- Two-player mode and different maps per level.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
