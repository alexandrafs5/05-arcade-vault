# SPEC 09 — Snake game (SNAKE) playable in the platform

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06, SPEC 08
> **Date:** 2026-11-16
> **Objective:** Add SNAKE as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/snake/jugar`.

## Why this spec exists

There is no reference game folder. The game is the classic Google Snake, written from scratch: the user dictated the rules in Phase 2 and this spec records them exactly. The only source material is `references/source-assets/snake-assets/` (`fruits.png`, a 3790×442 transparent sprite sheet from The Spriters Resource, and `sprites.js`, an atlas of source rectangles).

SPEC 05 set the engine pattern, SPEC 06 put games and scores in Supabase, SPEC 08 added the pattern for engines that load image assets from `public/games/<id>/` inside `start()`. This is the fourth real game. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

**Atlas warning.** The labels in `sprites.js` do not match the image. The atlas names the first pixel-art fruit `banana` (`x: 34, y: 136, w: 110, h: 160`), but that rectangle holds the red pixel-art apple (first item of the middle row of `fruits.png`). The entry labelled `apple` (`x: 2786`) holds an orange. This spec uses the rectangle `x: 34, y: 136, w: 110, h: 160` as the apple. `/spec-impl` must confirm it by looking at the drawn sprite.

## Scope

**In:**

- Engine in `lib/games/snake/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: checkerboard board, apple and snake. Score, length, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "snake"`, logic size 612×540, HUD field `length`.
- Migration `supabase/migrations/20261116000700_add_snake_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-snake` (`app/globals.css`). No new cover CSS.
- Asset: copy `references/source-assets/snake-assets/fruits.png` to `public/games/snake/fruits.png`. The engine loads it inside `start()` with `new Image()`, never at module level. `sprites.js` is not copied (it is a `window` global); the one rectangle in use goes into `constants.ts` as `APPLE_SPRITE`.
- Rules (classic Google Snake):
  - Board 17 columns × 15 rows, `CELL = 36` px, logic canvas 612×540. Origin top-left, cell `(col, row)` draws at `(col × 36, row × 36)`.
  - Start: length 3, row 7, head at col 5, body at cols 4 and 3, direction right. The first apple is at col 12, row 7.
  - The snake does not move until the first valid direction key is pressed. Pressing left at start is ignored (it is a 180° turn).
  - Fixed step `STEP_MS = 130`: the snake advances one cell per step. No speed change, no levels.
  - Keys: `←` `↑` `→` `↓` and `A` `W` `D` `S` set the direction.
  - A 180° reversal is ignored. Direction input is a queue of at most 2 pending turns, validated against the last queued direction, so two quick key presses inside one step both apply on consecutive steps.
  - Eating the apple: score +1, length +1 (the tail stays for that step), a new apple appears in a uniformly random free cell (a cell not occupied by the snake).
  - Dying: the head moves out of the board, or into a body cell. The cell the tail leaves in the same step is not an obstacle. Then `state = "gameover"` and `onGameOver(score)` fires once.
  - Winning: the snake fills all 255 cells (length 255). Then `state = "gameover"` and `onGameOver(score)` fires once. No bonus points.
  - Score equals apples eaten; length equals `3 + score`.
- Drawing (Google look, no neon recolor): board cells alternate `#aad751` and `#a2d149`; snake body `#4a75e8` with rounded joints and a head with two eyes looking in the move direction; apple drawn from `APPLE_SPRITE` inside its cell, keeping the sprite aspect ratio (110×160), centered. Exact shapes are a detail for `/spec-impl`.
- Sprite loading: the engine does not advance the snake until the image is ready. If the image fails to load, it logs `console.error` once and draws a flat red circle in the apple cell, so the game stays playable. The `onload` / `onerror` callback is ignored after `stop()`.
- `CLAUDE.md` update: the `games` rows (now `asteroids`, `tetris`, `arkanoid`, `snake`).

**Out of scope (for future specs):**

- Sound and music.
- Other fruits from the atlas (the 21 other sprites stay unused) and random fruit per spawn.
- Speed increase, levels, game modes, board-size options, walls or obstacles.
- Touch or swipe controls, on-screen d-pad, gamepad.
- Neon recolor of the in-canvas world.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'snake'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'snake',
  'SNAKE',
  'Come manzanas y crece sin chocar.',
  'Guía a la serpiente por el tablero, come manzanas y crece con cada una. Si chocas con una pared o con tu propio cuerpo, se acaba. Llena todo el tablero para ganar.',
  'ARCADE',
  'cover-snake',
  'green',
  4
);
```

`sort_order` 4 is the next unique value: `asteroids` holds 1, `tetris` 2 and `arkanoid` 3.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "length", label: "Longitud", format: "number", initial: 3 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { length } }
```

```ts
// lib/games/snake/constants.ts
const COLS = 17,
  ROWS = 15,
  CELL = 36;
const W = COLS * CELL; // 612
const H = ROWS * CELL; // 540
const STEP_MS = 130;
const START_LENGTH = 3;
const APPLE_SPRITE = { x: 34, y: 136, w: 110, h: 160 }; // atlas label says "banana"; it is the apple
```

Conventions:

- Logic canvas is 612×540, units in pixels. The snake is a list of cells `{ col, row }` from head to tail. Time inside the engine is in seconds; `STEP_MS` is converted when accumulating `dt`.
- The step timer accumulates `dt` (already capped at 0.05 s) and runs at most one step per frame, so a long frame never skips cells. The timer resets on pause resume and on restart.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.
- No frame-rate dependence: movement is one cell per fixed step, not per frame.

## Implementation plan

1. Create `lib/games/snake/constants.ts` with the constants above, the direction vectors and the board colors. Manual check: `npm run lint` passes.
2. Create `lib/games/snake/engine.ts`, first part: closure state (snake, direction queue, apple, score, state), `reset`, `spawnApple`, one `step` (move, eat, grow, collide, win) and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: key handling (arrows and WASD), direction queue with the 180° rule, `preventDefault` on arrows, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Copy `fruits.png` to `public/games/snake/fruits.png`. Manual check: `http://localhost:3000/games/snake/fruits.png` serves the image.
5. Extend `engine.ts`: draw (checkerboard, snake, apple sprite, flat-circle fallback), sprite loading in `start()` with error fallback, rAF loop with `dt` cap and step accumulator, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/snake/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS and ARKANOID still play.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `snake` row; `/biblioteca` shows the card with the `.cover-snake` art; `/juegos/snake/jugar` plays; length and score update.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

No UI is designed or created in this spec (the cover is reused and the shell is unchanged), so `/frontend-design` is not required. If `/spec-impl` finds the 612×540 canvas needs shell CSS changes, or the cover needs rework, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `snake` with title `SNAKE`, the copy above, category `ARCADE`, cover `cover-snake`, color `green` and `sort_order` 4.
- [ ] `/juegos/snake/jugar` shows a 612×540 canvas; the game starts with a 3-cell snake (head col 5, row 7, facing right), the apple at col 12, row 7, and HUD score 0 and length 3.
- [ ] The snake does not move until the first valid direction key is pressed.
- [ ] `←` `↑` `→` `↓` and `A` `W` `D` `S` turn the snake; the snake moves one cell every 130 ms.
- [ ] A 180° reversal is ignored, also at start (left while facing right).
- [ ] Two quick perpendicular key presses inside one step both apply, on consecutive steps.
- [ ] The apple is drawn from the sprite rectangle `x: 34, y: 136, w: 110, h: 160` and shows a red apple, not a banana or an orange.
- [ ] Eating the apple adds exactly 1 to the score and 1 to the HUD length, and spawns a new apple in a cell the snake does not occupy.
- [ ] Leaving the board through any of the four walls opens the game-over modal with the final score once.
- [ ] Running into the snake's own body opens the game-over modal once; moving into the cell the tail leaves in the same step does not.
- [ ] Filling all 255 cells opens the game-over modal with the final score once; no bonus points are added.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'snake'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=snake`, on `/juegos/snake` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/snake` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list ASTEROIDS, TETRIS, ARKANOID and SNAKE; `/salon` has four tabs.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; pressing again resumes with no jump (the snake does not advance an extra cell).
- [ ] While the game is mounted, the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, snake, apple and score; no duplicate loops run (step rate stays 130 ms after 3 restarts).
- [ ] Blocking `/games/snake/fruits.png` makes the game draw a flat red circle as the apple, stay playable and log one `console.error`.
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar` and `/juegos/arkanoid/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/snake/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with the classic Google Snake rules the user dictated. **No:** inventing modes or extra rules.
- **Yes:** `id` `snake`, English slug, same convention as the other games. Title `SNAKE`.
- **Yes:** board 17×15 cells of 36 px (612×540), the Google grid. **No:** 20×20: it is not the Google proportion.
- **Yes:** only the apple. **No:** random fruit per spawn: it is not the classic and the user chose the literal game.
- **Yes:** use the sprite rectangle `x: 34, y: 136` for the apple, because the atlas labels are wrong. **No:** trusting `apple` in `sprites.js`: it is an orange.
- **Yes:** copy only `fruits.png`, load it inside `start()`. **No:** copying `sprites.js` (a `window` global), loading at module level.
- **Yes:** flat red circle fallback if the image fails. **No:** a blank apple cell, because the game would look broken.
- **Yes:** fixed step of 130 ms, no levels. Google has no speed ramp. **No:** speed increase: new rule, own spec.
- **Yes:** HUD field `length` (`number`, 3). Score is shown by the shell. **No:** a `level` field: there are no levels.
- **Yes:** the snake waits for the first key. Matches Google and gives the player time to read the board. **No:** auto-start: the player could die before reacting.
- **Yes:** queue of at most 2 turns with a 180° check against the last queued direction. Avoids lost inputs and self-reversal on fast key presses. **No:** a single pending direction.
- **Yes:** moving into the cell the tail leaves is safe. **No:** treating it as a collision: Google does not.
- **Yes:** filling the board ends the game as a win and saves the score. The shell only knows `gameover`. **No:** a separate win screen.
- **Yes:** score +1 per apple. **No:** points per step or per length.
- **Yes:** Google colors for the board and snake. **No:** neon recolor: out of scope, same as the other games.
- **Yes:** reuse `.cover-snake` (exists, unused, green snake and magenta dot). **No:** a new cover.
- **Yes:** color `green`, matching the cover. Colors `yellow`, `magenta` and `cyan` are taken by the other games.
- **Yes:** `sort_order` 4 (next unique value).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks step rate after restarts.  |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                               |
| Sprite load finishes after `stop()` (unmount or Strict Mode remount)      | Ignore the `onload` / `onerror` callback when the engine is stopped; never start a loop from a stale callback. |
| Atlas labels in `sprites.js` are wrong, the wrong fruit shows             | Use the verified rectangle; a criterion checks the drawn sprite is a red apple.                                |
| `fruits.png` is a large sheet (3790×442) loaded for one sprite            | Acceptable for one request; cropping the apple into its own file is a later optimization, not needed now.      |
| Input stuck after pause or blur                                           | Clear the direction queue on `setPaused`, on `window` blur and on `stop`.                                      |
| Fast key presses reverse the snake into itself                            | Queue of 2 turns validated against the last queued direction.                                                  |
| Apple spawn loops forever when the board is almost full                   | Pick uniformly from the list of free cells instead of retrying random cells; win is checked before spawning.   |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                         |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for SNAKE (no touch controls); fixing it needs its own change.                     |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.         |

## What is **not** in this spec

- Sound and music.
- Other fruits and random fruit per spawn.
- Speed increase, levels, modes, board-size options, obstacles.
- Touch or swipe controls and gamepad.
- Neon recolor.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
