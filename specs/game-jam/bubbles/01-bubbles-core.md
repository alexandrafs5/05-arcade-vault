# SPEC JAM-bubbles-01 — Bubble Burst game (BUBBLE BURST) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-24
> **Objective:** Add BUBBLE BURST as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/bubbles/jugar`.

## Why this spec exists

There is no reference game folder. BUBBLE BURST is written from scratch in the classic "aim and match" genre: a cannon at the bottom fires colored bubbles into a hex-packed field hanging from the ceiling, and groups of three or more of one color burst. It is an original game with its own look (a neon fairground cannon, six glossy primitive-drawn bubble colors), no sprites and no licensed names or art.

It is the PUZZLE entry of the "Neon Fairground" jam set (`bubbles`, `gallery`, `duelo`), taken from the `bubbles` brief in `references/game-suggestions-todo.md`. The risk named there (cluster flood fill and floating-bubble drop) is isolated in a pure module `lib/games/bubbles/grid.ts` so it can be checked on its own.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-bubbles-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

## Scope

**In:**

- Engine in `lib/games/bubbles/` (`constants.ts`, `grid.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `ArrowLeft`, `ArrowRight`, `ArrowUp` and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: ceiling bar, bubble field, danger line, cannon, aim guide, loaded and next bubble, shot counter pips, falling bubbles. Score, lives, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Mouse input: the canvas listens to `mousemove` and `mousedown` on the canvas element; pointer coordinates are converted with `getBoundingClientRect` and the logic size.
- Entry in `lib/games/registry.ts` with `id: "bubbles"`, logic size 480×640, HUD fields `lives` and `level`.
- Migration `supabase/migrations/20261124000000_add_bubbles_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-bubbles` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none fits bubbles, and `.cover-duelo` is reserved for the `duelo` jam game.
- Rules:
  - Field: hex packing, bubble radius `R = 20`, 12 columns on even rows (center x `20 + col × 40`) and 11 columns on offset rows (center x `40 + col × 40`), row height `ROW_H = 35`, row `r` center y `20 + r × 35`. Origin top-left, units in pixels.
  - Which rows are offset is stored in `topParity` (0 or 1): row `r` is offset when `(r + topParity) % 2 === 1`. At game start and at each new level `topParity = 0`.
  - Neighbors (6): same row `col ± 1`; rows `r ± 1` at `col` and `col + 1` when row `r` is offset, at `col − 1` and `col` when it is not; cells outside the row length do not exist.
  - Colors: indices 0–5 = magenta, cyan, yellow, green, orange, violet (hex values are a `/spec-impl` detail, drawn as glossy discs with a highlight).
  - Level parameters: `rows = min(4 + level, 9)`; `colors = min(4 + floor((level − 1) / 3), 6)`; `dropEvery = max(8 − floor((level − 1) / 2), 4)`. Level 1 = 5 rows (58 bubbles), 4 colors, drop every 8 shots. Initial rows are full, each cell a uniformly random color among the first `colors` indices.
  - Cannon at `(240, 600)`. Aim angle measured from the horizontal, clamped to 15°–165° (never flatter than 15°). Mouse: angle points to the pointer. Keyboard: `←` / `→` rotate at 90°/s. The default angle at start is 90° (straight up).
  - Fire: mouse click on the canvas, or `Space`, or `↑`. Ignored while a shot is in flight. The loaded bubble flies at `SHOT_SPEED = 900` px/s in 8 px sub-steps (no tunneling), bounces on the left and right walls (`x = 20` and `x = 460`), and stops when its center is within `38` px of any field bubble center or its center `y ≤ 20`.
  - Landing: the stopped bubble snaps to the nearest empty field cell to its center (an occupied nearest cell falls back to the nearest empty cell among its neighbors).
  - Burst: after landing, flood fill over the 6 neighbors collects the connected bubbles of the landed color. If the group has 3 or more, all burst (+10 each).
  - Drop: after a burst, every bubble that is no longer connected to row 0 through any chain of neighbors (any color) falls (+20 each). Falling bubbles are cosmetic particles with gravity 1400 px/s² and never block input.
  - Next bubble: the loaded bubble color is shown at the cannon, the next one at `(60, 600)`. A new color is drawn uniformly from colors still present in the field. If the loaded or next color no longer exists in the field, it is replaced by a random present color.
  - Ceiling pressure: `missCount` counts consecutive shots that burst nothing. It resets to 0 on any burst. When `missCount` reaches `dropEvery`, a full new row 0 is inserted (all rows shift down by one, `topParity` flips, `missCount = 0`). Next to the cannon, `dropEvery` pips show how many shots remain: `missCount` filled pips.
  - Danger: after resolving a landing or a ceiling drop, if any bubble sits in row `13` or below (`LOSE_ROW = 13`, danger line drawn at y = 455) the player loses one life. Then every bubble in rows `9` and below is removed (`RESCUE_FROM_ROW = 9`, no points), `missCount = 0`. If lives reach 0, `state = "gameover"` and `onGameOver(score)` fires once.
  - Level clear: when the field has no bubbles, +500 × level, `level += 1`, a new field is built from the new level parameters, `missCount = 0`. Lives are kept. There is no last level.
  - Scoring: burst +10 per bubble, drop +20 per bubble, level clear +500 × level.
  - Start: 3 lives, level 1, score 0.
- Scores through the existing `saveScore` (`lib/session.tsx`) into `scores`. Nothing new in the shell. The game shows on `/salon?game=bubbles`, `/juegos/bubbles` (top 10), the home lists and the game card stats with no extra code.
- `CLAUDE.md` update: the `games` table row list.

**Out of scope (for future specs):**

- Hand-made level patterns, special bubbles (bomb, rainbow), swapping the loaded bubble and score combos: JAM-bubbles-02.
- Sound and music.
- Touch or on-screen controls, gamepad.
- Neon recolor skins (`classic`, `neon`, `retro`).
- Colorblind patterns on the bubbles.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'bubbles'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'bubbles',
  'BUBBLE BURST',
  'Apunta, une tres y revienta el techo.',
  'Dispara burbujas de colores desde el cañón de la feria y une tres o más del mismo color para reventarlas. Las que quedan colgando caen solas. Si el techo te aplasta, pierdes una vida.',
  'PUZZLE',
  'cover-bubbles',
  'magenta',
  7
);
```

`sort_order` 7 is the next free value at this moment: `asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4, `frogger` 5, and `scramble` (jam) reserves 6. The jam siblings take 8 (`gallery`) and 9 (`duelo`). `color` must be one of `cyan`, `magenta`, `green`, `yellow` (check constraint). Both the migration timestamp (later than `20261118050845`, the last file today) and `sort_order` are re-checked when the spec is promoted.

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
// lib/games/bubbles/constants.ts
const W = 480, H = 640;
const R = 20, COLS_EVEN = 12, COLS_ODD = 11, ROW_H = 35;
const CANNON = { x: 240, y: 600 };
const NEXT_POS = { x: 60, y: 600 };
const SHOT_SPEED = 900, SHOT_STEP = 8, STICK_DIST = 38;
const AIM_MIN_DEG = 15, AIM_MAX_DEG = 165, AIM_KEY_DEG_PER_S = 90;
const LOSE_ROW = 13, RESCUE_FROM_ROW = 9;
const POINTS_BURST = 10, POINTS_DROP = 20, LEVEL_BONUS = 500;
const START_LIVES = 3, MIN_GROUP = 3, FALL_GRAVITY = 1400;
```

```ts
// lib/games/bubbles/grid.ts (data shape; -1 = empty cell, 0-5 = color index)
type Grid = { cells: number[][]; topParity: 0 | 1 };
// pure helpers: isOffset, cellCenter, nearestEmptyCell, neighbors, findGroup, findFloating
```

Conventions:

- Logic canvas is 480×640, units in pixels, time inside the engine in seconds.
- `grid.ts` has no canvas, no `Math.random` and no closure state: random values are passed in, so the flood fill and the floating search are checkable from the console.
- Shot speed is in px/s, so play is frame-rate independent.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.
- No new tables, no new `localStorage` keys.

## Implementation plan

1. Create `lib/games/bubbles/constants.ts` with the constants above, the color table and the level-parameter formulas. Manual check: `npm run lint` passes.
2. Create `lib/games/bubbles/grid.ts`: `isOffset`, `cellCenter`, `neighbors`, `nearestEmptyCell`, `findGroup` (flood fill), `findFloating` (search from row 0). Manual check: `npx tsc --noEmit` passes; from a scratch call, a hand-built grid with a 3-bubble group returns 3 cells and an island with no link to row 0 is returned as floating.
3. Create `lib/games/bubbles/engine.ts`, first part: closure state (grid, loaded and next color, aim, shot, missCount, lives, level, score, falling particles), `buildLevel`, snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: input (mouse move and click converted with `getBoundingClientRect`, `←` `→` `Space` `↑`), `preventDefault` on those keys, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
5. Extend `engine.ts`: shot flight with sub-steps and wall bounce, snap, burst, drop, ceiling pressure, danger and rescue, level clear, scoring. Manual check: lint and tsc pass.
6. Extend `engine.ts`: draw (ceiling, field, danger line, cannon, aim guide with the first wall bounce, loaded and next bubble, pips, falling bubbles), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/bubbles/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS, ARKANOID, SNAKE and FROGGER still play.
8. Add the `.cover-bubbles` rule to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview and does not change other covers.
9. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `bubbles` row; `/biblioteca` shows the card with the new cover; `/juegos/bubbles/jugar` plays.
10. Update `CLAUDE.md`.
11. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `bubbles` with title `BUBBLE BURST`, the copy above, category `PUZZLE`, cover `cover-bubbles`, color `magenta` and `sort_order` 7.
- [ ] `/juegos/bubbles/jugar` shows a 480×640 canvas; the game starts with 5 full rows (58 bubbles, 4 colors), HUD lives 3, level 01, score 0.
- [ ] The aim angle follows the pointer and never goes below 15° from the horizontal; `←` / `→` rotate it at 90°/s.
- [ ] A click on the canvas, `Space` or `↑` fires the loaded bubble; a second fire while a shot is in flight does nothing.
- [ ] The shot bounces on the left and right walls and sticks on the ceiling or on the first bubble within 38 px.
- [ ] A landed bubble sits exactly on a grid cell (its center equals the cell center).
- [ ] Landing a bubble that makes a connected group of 3 adds exactly 30 to the score; a group of 5 adds 50; a group of 2 adds 0.
- [ ] Bubbles no longer connected to row 0 fall and add 20 each (4 fallen bubbles add 80).
- [ ] After a shot that bursts nothing, one more pip is filled; at 8 empty shots (level 1) a new full row appears at the top, all rows shift one row down, and the pips reset.
- [ ] Any burst resets the pips to 0.
- [ ] A bubble resting in row 13 or below removes one heart, clears rows 9 and below, and keeps the game running while lives remain.
- [ ] Losing the third life opens the game-over modal with the final score once.
- [ ] Emptying the field adds 500 × level, raises the HUD level by 1, builds a new field with the new level parameters, and keeps the hearts.
- [ ] Level 4 starts with 8 rows and 5 colors; level 7 starts with 9 rows and 6 colors and drops every 5 shots.
- [ ] The loaded and next bubble colors are always among colors still present in the field.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'bubbles'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=bubbles`, on `/juegos/bubbles` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/bubbles` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas (including a shot in flight); pressing again resumes with no jump.
- [ ] While the game is mounted, `←`, `→`, `↑` and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll, and the aim still points at the pointer (coordinates converted with `getBoundingClientRect`).
- [ ] JUGAR DE NUEVO resets the HUD, field, aim, pips and score; no duplicate loops run (shot speed stays 900 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/bubbles/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with the classic aim-and-match rules. **No:** copying the look, characters, levels or music of any existing bubble shooter.
- **Yes:** `id` `bubbles`, English slug, title `BUBBLE BURST`, same convention as the other games.
- **Yes:** category `PUZZLE`, color `magenta` (as in the planner brief). **No:** `cyan` or `yellow`: they are not asked for; the catalog already has `tetris` in magenta, which is flagged for review.
- **Yes:** a pure `grid.ts` for flood fill and floating search. **No:** mixing grid logic with drawing: it is the named risk of the game.
- **Yes:** the game never "wins": levels keep going until the lives run out, and the score is the ranking. **No:** a final level with a win screen.
- **Yes:** lives (`hearts`) and level (`pad2`) in the HUD, as briefed. The pips for the ceiling drop are drawn in the world because the HUD contract has no such field.
- **Yes:** on losing a life, rows 9 and below are cleared so the game continues. **No:** restarting the level: it would punish the player twice.
- **Yes:** the next color is drawn only from colors present in the field, so no level can become unclearable.
- **Yes:** mouse and keyboard both aim and fire. **No:** touch controls: out of scope.
- **Yes:** no sprites, everything drawn with canvas primitives. **No:** assets: no `public/games/bubbles/` and no SPEC 08 dependency.
- **Yes:** new cover `.cover-bubbles` designed with `/frontend-design`. **No:** reusing `.cover-duelo` (reserved for `duelo`), `.cover-invaders` or `.cover-glot`.
- **Yes:** `sort_order` 7 (next free value, re-checked on promotion).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Floating-bubble search leaves hanging bubbles or drops connected ones     | Search starts from every occupied cell of row 0 through all 6 neighbors; criterion with 4 fallen bubbles.      |
| Neighbor table wrong on offset rows, bubbles snap to the wrong cell       | Offset is derived only from `topParity` in one `isOffset` helper; a criterion checks snapping to cell centers. |
| Fast shot tunnels through bubbles                                         | Move in 8 px sub-steps and test the 38 px stick distance after every sub-step.                                 |
| `topParity` flips on ceiling drop and the rows shift visually             | Insert the new row with the parity of the new row 0; draw positions always from `cellCenter`.                  |
| Six colors are hard to tell apart for colorblind players                  | Accepted for this spec; patterns on bubbles are out of scope and listed below.                                 |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks shot speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                               |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the 480×640 logic size.                                               |
| Input stuck after pause or blur                                           | Clear keys on `setPaused`, on `window` blur and on `stop`.                                                     |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                         |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for BUBBLE BURST (no touch controls); fixing it needs its own change.              |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.         |

## What is **not** in this spec

- Hand-made level patterns, special bubbles, swap and combos (JAM-bubbles-02).
- Sound and music.
- Touch or on-screen controls and gamepad.
- Neon recolor skins.
- Colorblind patterns on the bubbles.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
