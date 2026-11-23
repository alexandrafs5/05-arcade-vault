# SPEC JAM-bubbles-01 — Bubble Burst game (BUBBLES) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-23
> **Objective:** Add BUBBLES as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/bubbles/jugar`.

## Why this spec exists

There is no reference game folder and `references/started-games/` and `references/source-assets/` are empty. The game is a bubble-matching shooter on a hexagonal grid, written from scratch from the genre rules: aim a launcher, shoot a colored bubble, group three or more of the same color to burst them, and let anything left without support fall. The brief in `references/game-suggestions-todo.md` (`bubbles`, PUZZLE, magenta, effort M) names the risk: cluster flood fill and floating-bubble drop logic. This spec pins both down exactly (neighbor tables, a flood fill for the cluster and a ceiling-anchored search for the drop) so the implementation has no open questions. It fills the second PUZZLE slot next to TETRIS and is the only mouse-first game in the jam. Special bubbles are `JAM-bubbles-02`.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-bubbles-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/`, the live `games` table and the other jam specs (`scramble` holds 6 in its draft; `JAM-dragrush-01` uses 7 and `JAM-climber-01` uses 8).

The engine is written directly into the `createEngine` contract (SPEC 05): state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal. No assets are loaded (primitives only), so SPEC 08 is not a dependency.

## Scope

**In:**

- Engine in `lib/games/bubbles/` (`constants.ts`, `grid.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. `grid.ts` holds the pure grid helpers (cell position, neighbors, flood fill, floating search). No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- Mouse input: `pointermove` and `pointerdown` listeners on `window`, only for `pointerType === "mouse"`. Pointer coordinates are converted with `getBoundingClientRect` and the logic size (the canvas is scaled by CSS). A click counts only when its target is the canvas and `button === 0`.
- The canvas draws only the world: ceiling, bubbles, danger line, launcher, current and next bubble, the aim guide, the shot in flight, burst and fall effects, and the miss pips. Score, lives, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "bubbles"`, logic size 480×640, HUD fields `lives` and `level`.
- Migration `supabase/migrations/20261119000200_add_bubbles_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. Timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-bubbles` in `app/globals.css`, designed with `/frontend-design`. The covers unused today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows bubbles, and `.cover-invaders` and `.cover-duelo` are reserved for pending suggestions.
- Rules:
  - Hex grid of `COLS = 12` columns, bubble radius `R = 20` px (diameter 40). Row `r` has its center at `y = 20 + r × 34.64`. Row `r` is "offset" when `(r + parity) % 2 === 1`; an offset row has 11 cells and its cell `c` has center `x = 40 + 40 × c`; a normal row has 12 cells with `x = 20 + 40 × c`. The grid has at most 15 rows (0 to 14).
  - Neighbors (6): same row `c − 1` and `c + 1`; in rows `r − 1` and `r + 1`, columns `c` and `c + 1` when row `r` is offset, columns `c − 1` and `c` when row `r` is normal; cells outside the grid are ignored.
  - Start of level `n`: `rows(n) = min(5 + floor((n − 1) / 2), 9)` rows filled at random with the first `colors(n) = min(3 + ceil(n / 2), 6)` colors; `parity = 0`. Level 1 has 5 rows, so 12 + 11 + 12 + 11 + 12 = 58 bubbles and 4 colors.
  - Launcher at `(240, 590)`. Aim angle is measured from straight up and clamped to ±80°. Mouse: the angle points from the launcher to the pointer. Keyboard: `←` `→` (or `A` `D`) rotate at 90°/s. The latest input wins.
  - Shoot: left click on the canvas, `Space` or `↑`. Speed 900 px/s. Only one shot in flight at a time; a shot request while one flies is ignored.
  - Swap: `S` or `↓` swaps the current and the next bubble. Once per shot (the flag resets when the next shot is fired).
  - Flight: movement in sub-steps of at most 6 px. Bouncing off the side walls (`x = 20` and `x = 460` for the bubble center) mirrors `vx`. The shot sticks when its center reaches `y ≤ 20` or its center distance to any bubble is below 38 px.
  - Snap: the shot takes the free cell whose center is nearest to the shot position, among free cells that are in row 0 or have at least one occupied neighbor.
  - Burst: after snapping, flood fill the same-color connected cluster that includes the new bubble. If it has `n ≥ 3` bubbles, all are removed and the player gets `10 × n × (n − 2)` points (3 gives 30, 4 gives 80, 5 gives 150).
  - Drop: after a burst, a search starting from every occupied row-0 cell over occupied neighbors marks the supported bubbles. Every occupied cell not marked falls and is removed. For `k` dropped bubbles the player gets `20 × k × k` points (1 gives 20, 3 gives 180, 10 gives 2000).
  - Misses: a shot whose cluster has fewer than 3 bubbles is a miss. After `missesPerRow(n) = max(4, 8 − floor((n − 1) / 2))` consecutive misses a new row is added at the top: all rows move down one index, `parity` flips, and the new row is filled at random with the colors currently on the board; the miss counter resets. A burst also resets the miss counter. The remaining misses are drawn as small pips next to the launcher.
  - Shot colors: the current and next bubbles are drawn at random from the colors currently on the board, so a shot is never dead.
  - Danger: if any bubble is in row index 13 or more (center `y ≥ 470.3`) after a snap or after a new row, the player loses 1 life, every bubble in rows 9 and below (index 9 to 14) is removed with no points, and the miss counter resets. The danger line is drawn at `y = 450`. With `lives = 0` the state becomes `gameover` and `onGameOver(score)` fires once.
  - Level clear: when the grid has no bubbles, level `n` ends: `+1000 × n` points, level `n + 1` begins (more rows, more colors, fewer misses). Clearing level 99 ends the game as a win (`gameover`, no bonus). Score is clamped to 10,000,000.
  - Start: 3 lives, level 1, score 0.
- `CLAUDE.md` update: the `games` rows (adds `bubbles`).

**Out of scope (for future specs):**

- Special bubbles (bomb, stone) and the aim guide upgrades: `JAM-bubbles-02`.
- Handmade level patterns (levels are random fills).
- Sound and music.
- Touch input and on-screen controls, gamepad. Touch pointers are ignored.
- Skins (`classic`, `neon`, `retro`): owned by `@skin-designer` after the game lands.
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
  'Apunta, une burbujas del mismo color y despeja el techo.',
  'Dispara burbujas desde el cañón y forma grupos de tres o más del mismo color para reventarlos. Las burbujas que quedan sin apoyo caen. Si el techo llega hasta la línea roja, pierdes una vida.',
  'PUZZLE',
  'cover-bubbles',
  'magenta',
  9
);
```

`color` is `magenta` as requested by the brief (a CHECK allows `cyan`, `magenta`, `green`, `yellow`); `tetris` is also magenta. `sort_order` 9 is the next free value after `JAM-dragrush-01` (7) and `JAM-climber-01` (8); live games use 1 to 5 and the `scramble` draft reserves 6. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

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
const R = 20, COLS = 12, MAX_ROWS = 15;
const ROW_H = 34.64;                 // R * sqrt(3)
const LAUNCHER = { x: 240, y: 590 };
const AIM_MAX_DEG = 80, AIM_KEY_DEG_PER_S = 90;
const SHOT_SPEED = 900, SHOT_STEP_MAX = 6, STICK_DIST = 38;
const DANGER_ROW = 13, DANGER_LINE_Y = 450, PURGE_FROM_ROW = 9;
const MIN_CLUSTER = 3;
const COLORS = ["#00f5ff", "#ff006e", "#f5ff00", "#00ff88", "#ff7700", "#aa00ff"]; // cyan, magenta, yellow, green, orange, violet
const rowsFor = (n: number) => Math.min(5 + Math.floor((n - 1) / 2), 9);
const colorsFor = (n: number) => Math.min(3 + Math.ceil(n / 2), 6);
const missesPerRow = (n: number) => Math.max(4, 8 - Math.floor((n - 1) / 2));
const popPoints = (n: number) => 10 * n * (n - 2);
const dropPoints = (k: number) => 20 * k * k;
const LEVEL_POINTS = 1000, LAST_LEVEL = 99, SCORE_MAX = 10_000_000, START_LIVES = 3;
```

```ts
// lib/games/bubbles/grid.ts
type Cell = number | null;      // color index or empty
type Grid = { rows: Cell[][]; parity: 0 | 1 };
```

Conventions:

- Logic canvas is 480×640, origin top-left, units in pixels; time in seconds. Mouse coordinates are scaled by `W / rect.width` and `H / rect.height`.
- Row `i` of `rows` has 12 cells when `(i + parity) % 2 === 0` and 11 cells otherwise. When a row is added at the top, `parity` flips so every existing bubble keeps its x position.
- Each color also has its own shape (circle, diamond, triangle, square, star, hexagon) drawn inside the bubble so the game does not rely on color alone; exact shapes are a detail for `/spec-impl`.
- Burst and drop effects are visual only (0.15 s fade, 0.5 s fall); the grid is updated at the moment of the snap and a new shot may be fired during the effects.
- State `dead` is unused: losing the last life goes from `playing` to `gameover` directly.

## Implementation plan

1. Create `lib/games/bubbles/constants.ts` with the block above and the colors used by the drawing. Manual check: `npm run lint` passes.
2. Create `lib/games/bubbles/grid.ts` with the pure helpers: `isOffset`, `cellCenter`, `neighbors`, `cellsInRow`, `floodSameColor`, `findFloating`, `lowestRow`, `addRowOnTop`. Manual check: `npx tsc --noEmit` passes; a temporary log with a hand-built grid (a cluster of 3 plus one bubble hanging from it) shows flood fill returns 3 and `findFloating` returns the hanging one; remove the log.
3. Create `lib/games/bubbles/engine.ts`, first part: closure state (grid, current, next, shot, aim, misses, lives, level, score), `loadLevel`, color picking from the board, the snap, burst, drop, miss, new row, danger, level clear and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
4. Extend `engine.ts`: shot flight with sub-steps and wall bounces, input (`pointermove`, `pointerdown` with coordinate conversion, keyboard aim, shoot, swap), `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (ceiling, bubbles with shapes, danger line, launcher, next bubble, guide with one bounce, effects, miss pips), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/bubbles/jugar` is still the not-found page because the DB row does not exist yet; the five live games still play.
7. Add `.cover-bubbles` to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview with no change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `bubbles` row; `/biblioteca` shows the card; `/juegos/bubbles/jugar` plays.
9. Update `CLAUDE.md` (the `games` table).
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `bubbles` with title `BUBBLE BURST`, the copy above, category `PUZZLE`, cover `cover-bubbles`, color `magenta` and `sort_order` 9.
- [ ] `/juegos/bubbles/jugar` shows a 480×640 canvas; the game starts on level 1 with 58 bubbles in 5 rows (12, 11, 12, 11, 12), exactly 4 colors, HUD score 0, 3 hearts and level 01.
- [ ] Moving the mouse over the canvas aims the launcher at the pointer; the angle never exceeds 80° left or right of vertical, also when the page is scaled by CSS (checked at 375 px width).
- [ ] `←` `→` and `A` `D` rotate the aim at 90°/s; the latest input (mouse or key) wins.
- [ ] Left click on the canvas, `Space` or `↑` fires a shot at 900 px/s; a click outside the canvas does not fire; a second request while a shot flies is ignored.
- [ ] A shot bounces off both side walls and sticks on the ceiling or on the first bubble it touches (center distance below 38 px).
- [ ] The stuck bubble takes the nearest free cell that is in row 0 or touches an occupied cell.
- [ ] A same-color cluster of 3 or more including the new bubble is removed and adds `10 × n × (n − 2)` points: 30 for 3, 80 for 4, 150 for 5.
- [ ] Bubbles with no path of occupied neighbors to row 0 fall after a burst and add `20 × k × k` points: 20 for 1, 180 for 3.
- [ ] A cluster of 2 is not removed and counts as a miss.
- [ ] After 8 consecutive misses on level 1 a new row appears at the top and everything moves down one row with no horizontal shift; at level 7 it takes 5 misses; it never takes fewer than 4. A burst resets the count.
- [ ] The current and next bubble colors always exist on the board.
- [ ] `S` or `↓` swaps the current and next bubble once per shot.
- [ ] A bubble in row 13 or lower costs 1 life, removes rows 9 to 14 with no points and resets the miss count; the HUD shows one heart less.
- [ ] Clearing the board adds `1000 × n` points, shows level `n + 1` in the HUD, and starts a board with `min(5 + floor((n) / 2), 9)` rows and `min(3 + ceil((n + 1) / 2), 6)` colors; level 3 has 6 rows and 5 colors, level 5 has 7 rows and 6 colors.
- [ ] `lives = 0` opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'bubbles'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=bubbles`, on `/juegos/bubbles` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/bubbles` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and the shot; pressing again resumes with no jump; clicks while paused do not fire.
- [ ] While the game is mounted, `Space` and the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] Touch pointers (`pointerType` `touch` or `pen`) do not aim or fire.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, grid, level, miss count and score; no duplicate loops run (shot speed stays 900 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] The five live games still play exactly as before.
- [ ] No console errors on `/juegos/bubbles/jugar` during a full session through level 3.

## Decisions

- **Yes:** write the game from scratch with the standard bubble-matching rules of the genre. **No:** copying a specific commercial game's look, characters or levels.
- **Yes:** `id` `bubbles`, taken from the planner's entry in `references/game-suggestions-todo.md`, English slug. Title `BUBBLE BURST`.
- **Yes:** lives from the brief's HUD, spent when the ceiling reaches the danger line, with a purge of the lower rows so play continues. **No:** instant game over: the HUD would show hearts that never change.
- **Yes:** ceiling advance driven by consecutive misses. **No:** a timer: it punishes slow aiming, which is the core of the game.
- **Yes:** `20 × k²` for drops, larger than pops, to reward planning hanging clusters. **No:** equal points: there would be no reason to aim for the drop.
- **Yes:** random fills per level, a growing number of rows and colors. **No:** handmade patterns: not needed for replay value, can come later.
- **Yes:** mouse aims and clicks; keyboard aims, shoots and swaps. Both always work. **No:** a mode switch.
- **Yes:** mouse events filtered to `pointerType === "mouse"`. **No:** touch: out of scope and touch screens use the shell's gamepad later.
- **Yes:** colors plus shapes inside the bubbles. **No:** color only: not readable for color-blind players.
- **Yes:** shot colors are drawn only from colors on the board. **No:** fully random: dead shots would feel like bugs.
- **Yes:** clearing level 99 ends the game as a win and saves the score. The shell only knows `gameover`. **No:** a win screen.
- **Yes:** pure grid helpers in `grid.ts` kept separate from the engine. **No:** one large file: the flood fill and floating logic are the stated risk and must be checkable alone.
- **Yes:** primitives only, no assets. **No:** sprites: none exist in `references/`.
- **Yes:** new cover `.cover-bubbles` designed with `/frontend-design`, `sort_order` 9, color `magenta` (brief). **No:** reusing a reserved cover.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Cluster flood fill and floating drop logic have off-by-one bugs on hex rows | Neighbor table is explicit; pure helpers in `grid.ts` with a manual check in step 2 before any drawing exists. |
| Parity flip on a new row shifts bubbles sideways                          | `parity` flips whenever a row is added; criterion checks no horizontal shift.                                    |
| Fast shot tunnels through a bubble                                        | Movement in sub-steps of at most 6 px; stick distance 38 px is larger than a step.                               |
| Snap picks a cell that floats in mid-air                                  | Candidate cells must be in row 0 or touch an occupied neighbor.                                                  |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size; criterion checks at 375 px width.                       |
| Random boards can start with an unwinnable or trivial pattern             | Next bubble colors come from the board and every level starts with at least 5 rows; acceptable for a score game. |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks shot speed after restarts.   |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                 |
| Input stuck after pause or blur                                           | Clear aim keys on `setPaused`, on `window` blur and on `stop`.                                                   |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                           |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.           |

## What is **not** in this spec

- Special bubbles and aim guide upgrades (`JAM-bubbles-02`).
- Handmade level patterns.
- Sound and music.
- Touch input, on-screen controls and gamepad.
- Skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
