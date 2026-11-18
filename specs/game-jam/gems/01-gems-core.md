# SPEC JAM-gems-01 — Gem Swap game (GEM SWAP) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-18
> **Objective:** Add GEM SWAP as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/gems/jugar`.

## Why this spec exists

There is no reference game folder. GEM SWAP is a match-3 written from scratch for the `gems` pick in `references/game-suggestions-todo.md`. The setting is a gem-cutter's workshop: six mineral kinds, each with its own color and its own shape (so it is readable without color), an 8×8 bench, a move budget and a score target per level. No art, name or level from an existing match-3 is used; everything is drawn with canvas primitives, so there are no assets.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This is the first puzzle game driven only by the mouse. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

This spec is a jam draft. It is not numbered yet; the migration timestamp and `sort_order` below are re-checked when it is promoted to `specs/NN-gems-game.md`.

## Scope

**In:**

- Engine in `lib/games/gems/` (`constants.ts`, `board.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure. `board.ts` holds pure helpers (no canvas, no closure): `generateBoard`, `findMatches`, `hasValidMove`, `reshuffle`, `applyGravity`.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; listeners attached in `start`, removed in `stop`; input (selection and drag) cleared on pause, on `blur` and on `stop`. The game has no scroll keys, so there is no `preventDefault` on keys.
- The canvas draws only the world: a 60 px top strip with the level goal bar, and the 8×8 board. Score, moves, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Mouse input: pointer coordinates are converted with `getBoundingClientRect` and the logic size, because CSS scales the canvas.
- Entry in `lib/games/registry.ts` with `id: "gems"`, logic size 480×540, HUD fields `moves` and `level`.
- Migration `supabase/migrations/20261118000900_add_gems_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-gems` in `app/globals.css`, designed with `/frontend-design`.
- Rules:
  - Board 8 columns × 8 rows, `CELL = 60` px, board origin `(0, 60)`, logic canvas 480×540. Cell `(col, row)` draws at `(col × 60, 60 + row × 60)`.
  - Six gem kinds, ids 0 to 5: `amber` (hexagon, `#ffb000`), `rose` (circle, `#ff2bd6`), `jade` (diamond, `#2bff88`), `azure` (triangle, `#19e3ff`), `violet` (square, `#9b6bff`), `coral` (five-point star, `#ff7a1a`).
  - A new level starts with a generated board: random kinds, no line of 3 or more in any row or column, and at least one valid move (regenerate up to 100 times, then accept the last board and run the reshuffle rule).
  - A swap is two orthogonally adjacent cells. It is valid only if, after swapping, at least one of the two cells is part of a line of 3 or more of the same kind. An invalid swap animates there and back in `SWAP_S × 2`, costs nothing and changes nothing.
  - A valid swap costs 1 move (`moves − 1`), then the board resolves in steps. Step `k` (1-based) finds every horizontal and vertical line of 3 or more equal kinds, clears the union of those cells (a gem in two lines is cleared once; L and T shapes clear all their cells), then gravity makes gems fall and new random gems drop from above the board, then step `k + 1` runs, until a step finds no line.
  - Step points: `(10 × gemsCleared + sum of line bonuses) × k`. Line bonus: 0 for a line of 3, 20 for a line of 4, 50 for a line of 5 or more. Examples: one simple line of 3 is 30; a line of 4 is 60; a line of 5 is 100; an L of 5 gems made of two lines of 3 is 50; the same line of 3 as step 2 is 60.
  - Level goal: `levelGoal(n) = 1000 + 300 × (n − 1)` points scored during that level. Moves per level: 25. The goal is checked when the board is stable (no pending steps). If `levelScore ≥ levelGoal`, the level is complete: each leftover move adds 100 points (`LEFTOVER_MOVE_BONUS`), the level number goes up by 1, moves reset to 25, and a new generated board appears after `LEVELUP_S = 1.0`.
  - Game over: the board is stable, `moves = 0` and `levelScore < levelGoal`. Then `state = "gameover"` and `onGameOver(score)` fires once. There is no win state: the game is endless until the player fails a goal.
  - Reshuffle rule: every time the board becomes stable (after a swap, after a level start), `hasValidMove` runs. If no valid swap exists, the board is reshuffled without costing a move: the existing 64 gems are permuted (Fisher-Yates) until the board has no line of 3 and at least one valid move (up to 50 attempts); if none works, a fresh board is generated. The reshuffle animation lasts `RESHUFFLE_S = 0.6` (gems flash and slide to the new cells); it adds no points and may happen several times.
  - Score is clamped to 10,000,000.
- Input (mouse only):
  - Click a gem to select it (highlight ring). Click an orthogonally adjacent gem to try the swap. Click a non-adjacent gem to move the selection there. Click the selected gem again to deselect.
  - Drag: `mousedown` on a gem, then `mouseup` on an adjacent cell, or the pointer leaving the gem's cell into an adjacent one while pressed (threshold 24 px), tries that swap.
  - Input is ignored while the board is animating (swap, clear, fall, level-up, reshuffle) and while paused.
- Drawing: dark bench background, 8×8 grid of slightly lighter cells, gems drawn from primitives with a lighter inner facet. Exact shapes and finish are a detail for `/spec-impl`; the shape and color per kind above are fixed.
- `CLAUDE.md` update: the `games` table row for `gems`.

**Out of scope (for future specs):**

- Special gems, blasts and rainbow gems (feature spec `JAM-gems-02`).
- Sound and music.
- Hints (idle highlight of a valid move), undo, shuffle button, time mode.
- Keyboard play, touch gestures beyond what the browser maps to mouse events, gamepad.
- Skins (`neon`, `retro`): done later by `@skin-designer`. Touch pad mapping: done later by `@mobile-porter`.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'gems'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'gems',
  'GEM SWAP',
  'Intercambia gemas y encadena combos.',
  'Cambia de lugar dos gemas contiguas para formar líneas de tres o más. Las gemas caen, se encadenan y cada combo vale más que el anterior. Alcanza la meta de cada nivel antes de quedarte sin movimientos.',
  'PUZZLE',
  'cover-gems',
  'yellow',
  6
);
```

The migration file name and `sort_order` 6 are the values free at the time of writing (last migration `20261116000800_add_frogger_game.sql`, `frogger` holds 5). Both are re-checked when the spec is promoted. The jam drafts `climber` (7) and `scramble` (8) reserve the next two values; if they are promoted in another order, renumber.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "moves", label: "Jugadas", format: "number", initial: 25 },
  { key: "level", label: "Nivel", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { moves, level } }
```

```ts
// lib/games/gems/constants.ts
const COLS = 8, ROWS = 8, CELL = 60;
const BOARD_Y = 60; // top strip with the goal bar
const W = COLS * CELL; // 480
const H = BOARD_Y + ROWS * CELL; // 540
const KINDS = 6;
const MOVES_PER_LEVEL = 25;
const GOAL_BASE = 1000, GOAL_STEP = 300;
const GEM_POINTS = 10, LINE_BONUS_4 = 20, LINE_BONUS_5 = 50;
const LEFTOVER_MOVE_BONUS = 100;
const SWAP_S = 0.18, CLEAR_S = 0.22, FALL_SPEED = 800; // px/s
const LEVELUP_S = 1.0, RESHUFFLE_S = 0.6, DRAG_THRESHOLD = 24;
const MAX_SCORE = 10_000_000;
// board: number[][] of kind ids 0..5, board[row][col]; -1 while a cell is empty
```

Conventions:

- Logic canvas is 480×540, units in pixels, origin top-left. Time in the engine is in seconds.
- Engine phases (internal, not in the snapshot): `idle`, `swapping`, `swapBack`, `clearing`, `falling`, `levelUp`, `reshuffling`, `over`. The snapshot `state` is `playing` in every phase except `over`.
- Falling gems move at `FALL_SPEED` px/s (no acceleration), so the animation is frame-rate independent.
- `moves` in the HUD is the moves left. The goal bar in the top strip shows `min(1, levelScore / levelGoal)`; it is a world element, not a HUD duplicate, because the shell HUD has no goal field.

## Implementation plan

1. Create `lib/games/gems/constants.ts` with the constants above, the kind table (id, name, color, shape) and `levelGoal(n)`. Manual check: `npm run lint` passes.
2. Create `lib/games/gems/board.ts` with the pure helpers. Manual check: `npx tsc --noEmit` passes; a temporary console call shows `generateBoard()` has no line of 3 and `hasValidMove` is true (remove it before committing).
3. Create `lib/games/gems/engine.ts`, first part: closure state, `reset`, phase machine (swap, clear, fall, refill, resolve steps, scoring, goal check, level-up, reshuffle, game over), snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: mouse input (click, drag, `getBoundingClientRect` conversion), selection ring, input lock during animations, clearing on pause, blur and stop. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (bench, cells, gem shapes, selection ring, goal bar, clear and reshuffle effects), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/gems/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS, ARKANOID, SNAKE and FROGGER still play.
7. Add `.cover-gems` to `app/globals.css`. Use `/frontend-design` (project rule for any UI). Manual check: it renders on `/biblioteca` after step 8.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `gems` row; `/biblioteca` shows the card with the `.cover-gems` art; `/juegos/gems/jugar` plays.
9. Update `CLAUDE.md` (Games table row).
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `gems` with title `GEM SWAP`, the copy above, category `PUZZLE`, cover `cover-gems`, color `yellow` and `sort_order` 6 (or the value re-checked at promotion).
- [ ] `/juegos/gems/jugar` shows a 480×540 canvas; the game starts with an 8×8 board of 6 kinds, no line of 3 or more, at least one valid move, HUD score 0, moves 25 and level 01.
- [ ] Each of the 6 kinds has a different shape and color as listed in this spec.
- [ ] Clicking a gem shows a selection ring; clicking an adjacent gem swaps them; clicking a non-adjacent gem moves the ring; clicking the selected gem removes the ring.
- [ ] Dragging from a gem to an adjacent cell (pointer moved 24 px or released there) tries the same swap.
- [ ] An invalid swap returns both gems in 0.36 s and leaves moves, score and board unchanged.
- [ ] A valid swap reduces the HUD moves by exactly 1.
- [ ] A simple line of 3 adds 30 points; a line of 4 adds 60; a line of 5 adds 100; an L or T of 5 gems adds 50.
- [ ] A cascade multiplies the points of step 2 by 2 and step 3 by 3 (a line of 3 on step 2 adds 60).
- [ ] After a clear, gems above fall and new gems drop in; the board is full (64 gems) again before input is accepted.
- [ ] Mouse input is ignored while the board animates and while paused.
- [ ] When no valid swap exists on a stable board, the board reshuffles in 0.6 s with the same 64 gems, no line of 3, at least one valid move, moves unchanged and no points added.
- [ ] Reaching 1000 points in level 1 completes it: leftover moves add 100 each, the HUD level becomes 02, moves become 25 and a new board appears.
- [ ] The level 2 goal is 1300 points and the goal bar fills from 0 at the start of each level.
- [ ] With moves at 0, a stable board and level score under the goal, the game-over modal opens once with the final score; a last move that reaches the goal does not end the game.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'gems'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=gems`, on `/juegos/gems` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/gems` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list the new game; `/salon` has one more tab.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; pressing again resumes with no jump and no selection kept.
- [ ] Clicks are read correctly when the canvas is scaled by CSS: at 375 px width the gem under the pointer is the one selected.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD (moves 25, level 01), board, score and selection; no duplicate loops run (swap time stays 0.18 s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/gems/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with original shapes and setting. **No:** reusing the look, names or levels of an existing match-3.
- **Yes:** `id` `gems` (the pick in `game-suggestions-todo.md`), title `GEM SWAP`.
- **Yes:** 8×8 board, 6 kinds, 60 px cells (480×540). **No:** larger boards: they need a larger canvas and more cascades per move.
- **Yes:** each kind has its own shape as well as its color. **No:** color-only kinds: unreadable for color-blind players.
- **Yes:** an invalid swap costs no move and goes back. **No:** punishing mistakes: frustrating with a mouse.
- **Yes:** cascade multiplier `k` per step. **No:** a flat score: cascades are the reward the pick asked for.
- **Yes:** goal and moves per level (1000 + 300 per level, 25 moves) with a leftover-move bonus. **No:** a timer: the HUD has no time field and moves are the HUD number the pick asked for.
- **Yes:** endless levels, game over only on a failed goal. **No:** a final level or win screen: the shell only knows `gameover`.
- **Yes:** reshuffle without cost when no valid move exists, checked on every stable board. **No:** ending the game: it would feel like a bug.
- **Yes:** the goal bar is drawn in the canvas top strip. **No:** a new HUD format: the shell must not change.
- **Yes:** mouse only, drag and click both work. **No:** keyboard play: out of scope and not needed for a mouse game.
- **Yes:** primitives only, no assets. **No:** loading images: there are none and nothing needs them.
- **Yes:** a new `.cover-gems`, designed with `/frontend-design`. **No:** reusing `.cover-glot`, `.cover-invaders` or `.cover-duelo`: they belong to other pending picks.
- **Yes:** color `yellow` and category `PUZZLE` as the pick asked. Only `asteroids` is yellow today and only `tetris` is PUZZLE; the other two jam drafts also use yellow (`scramble`) and green (`climber`): flagged for review.
- **Yes:** `sort_order` 6, re-checked at promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks swap time after restarts.   |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                |
| Long cascades make the game feel stuck                                    | Fixed times (`CLEAR_S`, `FALL_SPEED`); input is locked only while the board moves.                              |
| Board with no valid move after refill                                     | `hasValidMove` after every stable board; reshuffle with a retry limit and a fresh-board fallback.               |
| Reshuffle loops forever                                                   | 50 permutation attempts, then `generateBoard`; `generateBoard` itself accepts its last attempt after 100 tries. |
| Goal curve too hard or too easy (25 moves for 1000 points)                | Constants are in `constants.ts`; check by hand that a casual player passes level 1 and fails by level 6 to 10.  |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size; criterion checks at 375 px width.                      |
| `mouseup` outside the canvas leaves a drag stuck                          | Listen for `mouseup` on `window` while attached; clear drag on `blur`, pause and `stop`.                        |
| Touch devices show the d-pad that this game does not use                  | Taps map to mouse events; the pad mapping is a later `@mobile-porter` run, not a shell change.                  |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game; fixing it needs its own change.                                      |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- Special gems, blasts and rainbow gems.
- Sound and music.
- Hints, undo, shuffle button and time mode.
- Keyboard play, touch gestures and gamepad.
- Skins and the mobile touch mapping.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
