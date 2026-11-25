# SPEC JAM-minesweeper-01 — Mine Sweep game (MINESWEEPER) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-25
> **Objective:** Add MINE SWEEP as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/minesweeper/jugar`.

## Why this spec exists

The game is the classic mine-clearing logic puzzle (a generic genre with public rules), written from scratch with original art drawn by canvas primitives. It fills the PUZZLE category (today only the pending `merge` suggestion) with a mouse-only game and the first one scored by time. It comes from the `minesweeper` entry of `references/game-suggestions-todo.md`.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the board, and the shell shows the HUD and the game-over modal.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-minesweeper-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/minesweeper/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window and canvas listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`. The game has no physics, so `dt` is used only for the timer (see Conventions).
- The canvas draws only the board: cells, numbers, flags, mines and the hover highlight. Score, time, mine counter, pause menu and game-over overlay are not drawn; the shell shows them.
- Mouse input and `contextmenu`:
  - `mousedown`, `mousemove` and `mouseleave` listeners and a `contextmenu` listener are attached to the canvas element only, in `start()`, and removed in `stop()`.
  - The `contextmenu` listener calls `preventDefault()`. It is never attached to `window` or `document`, so right-click outside the canvas keeps the browser menu.
  - `mousedown` with `button === 1` (middle) also calls `preventDefault()` to stop autoscroll.
  - Pointer coordinates are converted with `getBoundingClientRect` and the logic size 512×512.
  - The canvas gets `style.cursor = "pointer"` in `start()`; the previous value is restored in `stop()`.
- Entry in `lib/games/registry.ts` with `id: "minesweeper"`, logic size 512×512, HUD fields `mines` and `time`. No `touch` entry: the game needs left and right mouse buttons.
- Migration `supabase/migrations/20261125000200_add_minesweeper_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-minesweeper` in `app/globals.css`, designed with `/frontend-design`: green palette, a small grid of revealed and hidden tiles, a flag and a mine. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none fits a grid puzzle.
- Rules:
  - Board 16 columns × 16 rows, `CELL = 32` px, 40 mines. Cell `(col, row)` draws at `(col × 32, row × 32)`.
  - Mines are placed on the first reveal, never in the clicked cell or its 8 neighbors, uniformly among the remaining cells. The first reveal is always safe and it always opens a zero cell.
  - Left click on a hidden, unflagged cell reveals it. A cell with 0 adjacent mines flood-reveals its neighbors (iterative, no recursion). A mine ends the game.
  - Right click on a hidden cell toggles a flag. A flagged cell cannot be revealed by left click. No question-mark state.
  - Chording: left click or middle click on a revealed number whose count of adjacent flags equals the number reveals every hidden, unflagged neighbor at once. A wrong flag can make that reveal a mine and end the game.
  - Timer: starts on the first reveal (flags before it do not start it), stops on win or loss, and pauses while the game is paused. It counts whole seconds, capped at 999.
  - Win: all 216 safe cells are revealed. Then `state = "gameover"` and `onGameOver(score)` fires once.
  - Loss: a mine is revealed. All mines are shown, wrong flags are crossed, and `state = "gameover"` and `onGameOver(score)` fires once.
- Scoring (integer, always between 0 and 10,000,000):
  - While playing: score is `10 × revealed safe cells`.
  - Win: score is `5000 + 10 × (999 − t)` where `t` is the elapsed whole seconds (capped at 999). A 90 s win gives 5000 + 9090 = 14,090; the minimum win is 5000.
  - Loss: score stays `10 × revealed safe cells` (maximum 2150, always below any win).
- HUD `mines` is `max(0, 40 − flags placed)`; HUD `time` is the elapsed whole seconds (0 before the first reveal).
- `CLAUDE.md` update: the `games` table row for `minesweeper` and a note that the game scopes `contextmenu` to its canvas.

**Out of scope (for future specs):**

- Streak boards and progression (see `02-minesweeper-streak.md`).
- Difficulty selector, custom board sizes, question marks, hints and undo.
- Touch controls (no right click or long press), gamepad, sound and music.
- Neon recolor and skins, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'minesweeper'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'minesweeper',
  'MINE SWEEP',
  'Despeja el campo sin pisar una mina.',
  'Descubre todas las casillas seguras de un campo con 40 minas. Los números indican cuántas minas hay alrededor; marca las minas con clic derecho. Cuanto más rápido ganes, más puntos.',
  'PUZZLE',
  'cover-minesweeper',
  'green',
  8
);
```

`color` is one of `cyan`, `magenta`, `green`, `yellow` (check constraint). Today `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green; `green` is the planner's pick. `sort_order` 8 is the next free value after the `arena` jam game (7); the live maximum is 5 and the `scramble` jam draft reserves 6. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`) and than the `arena` migration. Both are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "mines", label: "Minas", format: "number", initial: 40 },
  { key: "time", label: "Tiempo", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { mines, time } }
```

```ts
// lib/games/minesweeper/constants.ts
const COLS = 16, ROWS = 16, CELL = 32;
const W = COLS * CELL; // 512
const H = ROWS * CELL; // 512
const MINES = 40;
const SAFE_CELLS = COLS * ROWS - MINES; // 216
const TIME_CAP = 999;
const REVEAL_POINTS = 10, WIN_BASE = 5000, WIN_TIME_FACTOR = 10;
// cell state: { mine: boolean; adj: number; revealed: boolean; flagged: boolean }
```

Conventions:

- Logic canvas is 512×512, origin top-left, units in pixels. The board is a flat array of `COLS × ROWS` cells.
- The timer accumulates the raw frame delta (not the 0.05 s capped one, which would undercount on slow frames) while the state is `playing`, the first reveal has happened and the game is not paused. The first frame after resume adds 0. The HUD `time` is `min(floor(elapsed), 999)`.
- The loop redraws only when something changed (hover cell, reveal, flag) or the timer second changed; paused and game-over frames are skipped.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.

## Implementation plan

1. Create `lib/games/minesweeper/constants.ts` with the constants above, the number colors and the board colors. Manual check: `npm run lint` passes.
2. Create `lib/games/minesweeper/engine.ts`, first part: closure state, `reset`, mine placement on first reveal with the 3×3 safe zone, adjacency counts, iterative flood reveal, flag toggle, chording, win and loss detection, scoring and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: canvas-scoped mouse listeners, `contextmenu` and middle-button `preventDefault`, coordinate conversion, hover cell, cursor, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Extend `engine.ts`: timer, draw (hidden and revealed cells, numbers 1 to 8, flags, mines, wrong-flag crosses, hover), idle-frame skip, rAF loop, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/minesweeper/jugar` is still the not-found page because the DB row does not exist yet; the existing games still play.
6. Add `.cover-minesweeper` to `app/globals.css` with `/frontend-design`. Manual check: the class renders in a card preview with no layout change to other covers.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `minesweeper` row; `/biblioteca` shows the card with the new cover; `/juegos/minesweeper/jugar` plays.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `minesweeper` with title `MINE SWEEP`, the copy above, category `PUZZLE`, cover `cover-minesweeper`, color `green` and `sort_order` 8 (or the value re-checked on promotion).
- [ ] `/juegos/minesweeper/jugar` shows a 512×512 canvas with a 16×16 board of hidden cells; HUD shows score 0, mines 40, time 0.
- [ ] The first left click never hits a mine and reveals a zero cell (its 8 neighbors have no mine); the timer starts on that click, not before.
- [ ] Exactly 40 mines are on the board after the first reveal.
- [ ] Clicking a zero cell reveals the connected zero area and its border numbers; no stack overflow on a mostly empty board.
- [ ] Right click on a hidden cell toggles a flag and changes HUD mines by 1 (40 → 39 → 40); the counter never shows below 0 even with more than 40 flags.
- [ ] A flagged cell does not reveal on left click.
- [ ] Left or middle click on a revealed number with a matching flag count reveals all its unflagged hidden neighbors; with a different flag count nothing happens.
- [ ] Right click on the canvas does not open the browser menu; right click anywhere outside the canvas still opens it.
- [ ] Middle click on the canvas does not start page autoscroll.
- [ ] While playing, score equals `10 × revealed safe cells`.
- [ ] Revealing all 216 safe cells opens the game-over modal once; final score is `5000 + 10 × (999 − t)` (for t = 90 s: 14,090).
- [ ] Revealing a mine opens the game-over modal once; the score equals `10 × revealed safe cells`, all mines show and wrong flags are crossed.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'minesweeper'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=minesweeper`, on `/juegos/minesweeper` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/minesweeper` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the timer and ignore clicks; pressing again resumes and the timer continues from the same second.
- [ ] The timer shows 999 at most and stops counting there.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll, and clicks hit the right cell (checked by clicking the four corner cells).
- [ ] JUGAR DE NUEVO resets the board, flags, HUD and timer; no duplicate loops or listeners run after 3 restarts (one click toggles exactly one flag).
- [ ] Leaving the page stops the loop, removes the canvas listeners and restores the cursor; no console errors; `contextmenu` on other pages is not prevented.
- [ ] The five existing games still play exactly as before.
- [ ] No console errors on `/juegos/minesweeper/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with the public rules of the genre and original flat art. **No:** copying the look or icons of any known version.
- **Yes:** `id` `minesweeper`, English slug, as the planner brief says; title `MINE SWEEP`.
- **Yes:** one fixed board of 16×16 with 40 mines, the usual intermediate density. **No:** a difficulty selector: it mixes incomparable scores in one leaderboard.
- **Yes:** score `5000 + 10 × (999 − t)` on win and `10 × revealed` on loss, so a win always beats a loss and faster is better. **No:** score equal to raw seconds: lower would be better and the leaderboard sorts high-first.
- **Yes:** first click safe with a 3×3 safe zone. **No:** pure random placement: it can end the game on the first click with no player decision.
- **Yes:** chording with left or middle click. **No:** omitting it: experienced players need it for fast times.
- **Yes:** no question-mark state. **No:** a third flag state: it adds clicks and no depth to the score.
- **Yes:** `contextmenu` prevented on the canvas only, with the listener removed in `stop()`. **No:** a global prevent: it would block the browser menu across the whole site.
- **Yes:** the win ends the game as `gameover` and saves the final score. The shell only knows `gameover`. **No:** a separate win screen.
- **Yes:** the timer uses the raw frame delta. **No:** the capped `dt`: slow frames would make times look faster than real.
- **Yes:** HUD `mines` (`number`, 40) and `time` (`number`, 0), as the planner brief says. **No:** `hearts` or `pad2`: there are no lives or levels.
- **Yes:** no `touch` entry in the registry: the pad cannot right click. **No:** a fake touch scheme.
- **Yes:** new cover `.cover-minesweeper`, designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games.
- **Yes:** color `green`, as the brief says. It repeats `snake` and `frogger`; it is accepted because the brief fixes it. **No:** changing the brief color silently.
- **Yes:** `sort_order` 8, re-checked on promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and duplicates listeners | `GameCanvas` cleanup calls `engine.stop()`, which removes the canvas listeners; criterion checks one toggle per click. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                            |
| `contextmenu` prevented too widely                                        | Listener only on the canvas element, removed in `stop()`; a criterion checks right click outside the canvas.|
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the 512×512 logic size.                                            |
| Timer drifts or runs while paused                                         | Accumulate raw frame delta only in `playing`, first frame after resume adds 0, display `floor`.             |
| Score shown while playing drops below an earlier loss score by mistake    | Loss uses the same `10 × revealed` formula as in-play score; win is at least 5000, always above 2150.      |
| Player cannot play on touch devices                                       | Out of scope and no `touch` entry; flag that the `TÁCTIL` tag is false for this game.                       |
| Flood reveal on a large empty area freezes the tab                        | Iterative stack, at most 256 cells.                                                                         |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                      |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.     |

## What is **not** in this spec

- Streak boards and progression.
- Difficulty selector, custom sizes, question marks, hints and undo.
- Touch controls, gamepad, sound and music.
- Neon recolor and skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
