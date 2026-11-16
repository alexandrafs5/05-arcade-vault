# SPEC 07 — Tetris game (TETRIS) playable in the platform

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-16
> **Objective:** Add TETRIS as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/tetris/jugar`.

## Why this spec exists

The game comes from `references/started-games/03-tetris/` (vanilla JS, `game.js` ~330 lines, DOM globals). SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This is the second real game and the first one to use the registry with HUD fields beyond lives and level.

The port is a rewrite into the `createEngine` contract: DOM globals (`getElementById`, `document.addEventListener`, `localStorage`) leave module scope, the sidebar (`SCORE`, `LINES`, `LEVEL`, controls list), the overlay and the restart button move to the React shell, and state moves into the `createEngine` closure.

The reference README says 7 standard pieces, but `game.js` defines 8: an extra `N` piece (a 3×3 ring, gray). This spec keeps it, as the code does.

## Scope

**In:**

- Engine in `lib/games/tetris/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws the playfield (grid, locked blocks, ghost piece, current piece) and a side strip with the next-piece preview. Score, lines, level, pause menu and game-over overlay are removed from the canvas; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "tetris"`, logic size 450×600, HUD fields `lines` and `level`.
- Migration `supabase/migrations/20261116000500_add_tetris_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-tetro` (`app/globals.css`) for the card. No new cover CSS.
- Original rules kept exactly:
  - Board 10 × 20 cells, `BLOCK = 30` px.
  - 8 pieces (I, O, T, S, Z, J, L, N), each picked at random with equal chance (`1..8`); colors from the original `COLORS` array.
  - Spawn at `x = floor(COLS / 2) - floor(width / 2)`, `y = 0`. A spawn that collides ends the game.
  - Rotation clockwise (`rotateCW`) with wall kicks `[0, -1, 1, -2, 2]` columns; if all collide, no rotation.
  - Line scores `[0, 100, 300, 500, 800]` multiplied by the level before the level update.
  - Soft drop `+1` point per row; hard drop `+2` points per cell dropped. Soft drop on a blocked piece locks it.
  - `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 − (level − 1) × 90)` ms.
  - Gravity accumulator is reset to 0 on each automatic drop (as in the original), not decremented.
  - Ghost piece at alpha 0.2.
- Held-key repeat for `←`, `→` and `↓` (not in the original, where only OS key repeat applied): first repeat after 170 ms, then every 50 ms. `↑`/`X` and `Space` act once per press.
- Controls: `←` `→` move, `↑` or `X` rotate, `↓` soft drop, `Space` hard drop. `P` and `Esc` pause come from the shell.
- Game ends only by top-out. There is no win state.
- `CLAUDE.md` update: the `games` rows (now `asteroids` and `tetris`) and the registry note.

**Out of scope (for future specs):**

- Light/dark theme toggle and the `tetris-theme` key in `localStorage`.
- Sound and music.
- Touch or on-screen controls, gamepad.
- Neon recolor of the in-canvas world (piece colors stay as in the original).
- Hold piece, 7-bag randomizer, SRS rotation, T-spin scoring, lock delay.
- A separate "next piece" canvas outside the game canvas (would change the shared player).
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'tetris'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas y limpia líneas.',
  'Las piezas caen sin parar sobre un tablero de 10×20. Muévelas y rótalas para completar líneas antes de que la pila llegue arriba. Incluye una pieza extra en forma de tuerca.',
  'PUZZLE',
  'cover-tetro',
  'magenta',
  2
);
```

`sort_order` 2 is the next unique value: `asteroids` holds 1.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "lines", label: "Líneas", format: "number", initial: 0 },
  { key: "level", label: "Nivel", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { lines, level } }
```

Conventions:

- Logic canvas is 450×600: playfield `x ∈ [0, 300)` (10 cols × 30 px), preview strip `x ∈ [300, 450)`. Origin top-left, units in pixels; board coordinates are in cells (`x` column, `y` row).
- Constants keep the original names and values: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`. New constants: `W = 450`, `H = 600`, `PREVIEW_X = 300`, `REPEAT_DELAY = 0.17`, `REPEAT_INTERVAL = 0.05` (seconds).
- Time is in seconds inside the engine; `dropInterval` stays in the original ms values and is converted when compared.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.
- No frame-rate-dependent physics: gravity is time-based in the original.

## Implementation plan

1. Create `lib/games/tetris/constants.ts` with `COLS`, `ROWS`, `BLOCK`, `W`, `H`, `PREVIEW_X`, `COLORS`, `PIECES`, `LINE_SCORES`, repeat timings, and pure helpers `rotateCW`, `createBoard`. Manual check: `npm run lint` passes.
2. Create `lib/games/tetris/engine.ts` with `createEngine`, first part: closure state, `spawn`, `collide`, `tryRotate`, `merge`, `clearLines`, scoring, level and `dropInterval`, snapshot and `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: draw (grid, blocks, ghost, current piece, next-piece preview), rAF loop with `dt` cap, gravity accumulator, `start`, `stop`, `setPaused`, `restart`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
4. Extend `engine.ts`: key handling (move, rotate, soft drop, hard drop), held-key repeat, `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/tetris/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS still plays.
6. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `tetris` row; `/biblioteca` shows the card with the `.cover-tetro` art; `/juegos/tetris/jugar` plays; lines, level and score update.
7. Update `CLAUDE.md`.
8. Run `npm run lint` and `npm run build`.

No UI is designed or created in this spec (the cover is reused), so `/frontend-design` is not required. If `/spec-impl` finds the 450×600 canvas needs shell CSS changes, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `tetris` with title `TETRIS`, the copy above, category `PUZZLE`, cover `cover-tetro`, color `magenta` and `sort_order` 2.
- [ ] `/juegos/tetris/jugar` shows a 450×600 canvas; the game starts with an empty 10×20 board, one falling piece, a next-piece preview in the side strip, and HUD score 0, lines 0, level 01.
- [ ] `←` / `→` move the piece one column and stop at walls and blocks; holding them repeats after 170 ms every 50 ms.
- [ ] `↑` and `X` rotate clockwise once per press; a rotation that collides tries kicks `0, −1, +1, −2, +2` and is ignored if all collide.
- [ ] `↓` drops one row and adds exactly 1 point per row; on a blocked piece it locks it.
- [ ] `Space` drops the piece to the ghost position and adds exactly 2 points per row dropped, then locks.
- [ ] The ghost piece shows the landing position at alpha 0.2.
- [ ] Clearing 1 / 2 / 3 / 4 lines at once adds exactly 100 / 300 / 500 / 800 times the current level to the score.
- [ ] HUD lines equals total cleared lines; HUD level equals `floor(lines / 10) + 1`.
- [ ] Gravity interval is 1000 ms at level 1, 910 ms at level 2, and never below 100 ms.
- [ ] The N piece (3×3 ring, gray) appears in the random sequence.
- [ ] A new piece that collides on spawn opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'tetris'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=tetris`, on `/juegos/tetris` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/tetris` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas (no gravity, no input); pressing again resumes with no piece jump.
- [ ] While the game is mounted, `Space` and the arrow keys do not scroll the page.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, board and score; no duplicate loops run (fall speed stays constant after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/salon` and `/biblioteca` list both ASTEROIDS and TETRIS; `/salon` has two tabs.
- [ ] `/juegos/asteroids/jugar` still plays exactly as before.
- [ ] No console errors on `/juegos/tetris/jugar` during a full session.

## Decisions

- **Yes:** port from `references/started-games/03-tetris/`. It is complete and its rules are fully defined. **No:** writing rules from scratch.
- **Yes:** `id` `tetris`, English slug, same convention as `asteroids`. Title `TETRIS`.
- **Yes:** keep the N (nut) piece, because it is in `game.js` and is the reference's twist; the README omission is an oversight. **No:** drop it for standard Tetris.
- **Yes:** keep the original rules and constants exactly (scoring, speed curve, wall kicks, ghost, random piece). **No:** SRS, 7-bag, hold, lock delay: they change the game and deserve their own spec.
- **Yes:** next-piece preview drawn inside the main canvas as a side strip (450×600). Shell stays unchanged. **No:** a second canvas, since it forces a change in `game-player.tsx` (goal is only-add). **No:** dropping the preview, which hurts play.
- **Yes:** HUD fields `lines` (`number`) and `level` (`pad2`). Score is shown by the shell. **No:** lives, since the game has none.
- **Yes:** held-key repeat for `←` `→` `↓` (170 ms delay, 50 ms interval). The original relied on OS repeat, which varies by machine and stalls on the first repeat. **No:** one move per press, which feels broken on a 10-wide board.
- **Yes:** game ends only on top-out; no win state. Matches the original.
- **Yes:** drop the theme toggle and `tetris-theme` key. The platform has one theme and no new `localStorage` keys are allowed. **No:** keeping it.
- **Yes:** drop sound; the original has none. **Yes:** reuse `.cover-tetro` (unused, and already draws tetromino blocks). **No:** a new cover.
- **Yes:** color `magenta`, because `asteroids` is `yellow` in the catalog.
- **Yes:** `sort_order` 2 (next unique value).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                        | Mitigation                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops       | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                         | Engine is created only inside `useEffect` of a client component.                                          |
| Held-key repeat state stuck after pause or blur                             | Clear input on `setPaused`, on `window` blur and on `stop`.                                               |
| Game over fired twice (engine and FIN)                                      | The shell ignores `onGameOver` when the modal is open.                                                    |
| Tall 450×600 canvas overflows the CRT frame on short viewports              | `.game-canvas` already limits with `max-height`; check at 375 px width and a short desktop window.        |
| Reference uses `ts` from `requestAnimationFrame` in ms; engine uses seconds | Convert once in the loop; criterion checks 1000 ms and 910 ms intervals.                                  |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded   | Flag it if a claim is false for TETRIS (no touch controls); fixing it needs its own change.               |
| Pieces merging above the board (negative `y`) throw on `board[y][x]`        | Spawn is at `y = 0` and the spawn collision check ends the game first; keep that order in the port.       |
| Next.js 16 differs from training data                                       | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.    |

## What is **not** in this spec

- Theme toggle.
- Sound and music.
- Touch controls and gamepad.
- Neon recolor.
- Hold piece, 7-bag, SRS, T-spin scoring, lock delay.
- A second canvas for the next piece.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
