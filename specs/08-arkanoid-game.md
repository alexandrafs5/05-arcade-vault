# SPEC 08 — Arkanoid game (ARKANOID) playable in the platform

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-16
> **Objective:** Add ARKANOID as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/arkanoid/jugar`.

## Why this spec exists

The game comes from `references/started-games/04-arkanoid/` (vanilla JS: `game.js` ~270 lines, `levels.js`, `assets/spritesheet.js`, a spritesheet PNG and two mp3 files; DOM globals). SPEC 05 set the engine pattern, SPEC 06 put games and scores in Supabase and SPEC 07 added the second game. This is the third real game and the first one with image assets and mouse input.

The port is a rewrite into the `createEngine` contract: DOM globals (`getElementById`, `document.addEventListener`, `new Audio`, `new Image`, `document.createElement('canvas')`) leave module scope, the in-canvas HUD (`Score`, `Nivel`, life balls), the `GAME OVER` / `¡Completaste el juego!` overlays and the pause overlay with level buttons move out of the canvas (the React shell owns them), and state moves into the `createEngine` closure.

The reference has discrepancies between docs and code. This spec follows the code:

- README says the paddle is 162 px; `game.js` uses `w = 81` (sprite 162 px drawn at 81 px).
- The reference spec says level 4 has random gaps; `levels.js` has fixed gaps.

## Scope

**In:**

- Engine in `lib/games/arkanoid/` (`constants.ts`, `levels.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `ArrowLeft` and `ArrowRight` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: blocks, explosions, paddle and ball. Score, lives, level, pause overlay and game-over / win overlay are removed; the shell shows them.
- Mouse control: `mousemove` on the canvas moves the paddle. Pointer X is converted with `getBoundingClientRect` and the logic width (800), because the canvas is scaled by CSS. The listener is attached in `start` and removed in `stop`. Mouse input is ignored while paused.
- Entry in `lib/games/registry.ts` with `id: "arkanoid"`, logic size 800×600, HUD fields `lives` and `level`.
- Migration `supabase/migrations/20261116000600_add_arkanoid_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-bricks` (`app/globals.css`). No new cover CSS.
- Assets: copy `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` to `public/games/arkanoid/spritesheet-breakout.png`. The engine loads it inside `start()` with `new Image()`, never at module level.
- Original rules kept exactly:
  - Logic canvas 800×600, black background (`#000`).
  - Paddle `w = 81`, `h = 14`, `y = 560`, centered at start; keyboard speed `PADDLE_SPEED = 400` px/s; clamped to `[0, 800 − w]`.
  - Ball 16×16, base velocity `BASE_BALL_VX = 200`, `BASE_BALL_VY = −300` px/s, multiplied by the level `speed`.
  - Block grid `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`, `BLOCK_W = 64`, `BLOCK_H = 24`, origin `x = (800 − 10 × 64) / 2 = 80`, `y = 80`. The 80 px top band stays empty (it held the HUD in the original).
  - Wall bounces on left, right and top. Bottom is open.
  - Paddle bounce only when `vy > 0`, the ball overlaps the paddle in X, and `ball.y + ball.h` is within `[paddle.y, paddle.y + paddle.h + 8]`. Result: `ball.y = paddle.y − ball.h`, `vy = −|vy|`. `vx` does not change (no angle control).
  - Block collision is AABB; at most one block per frame; each hit sets `vy = −vy` (regardless of the side hit), adds 10 points and starts an explosion.
  - Explosion: 4 frames over `EXPLOSION_DURATION = 150` ms; `gray` blocks use the `red` frames (as in the original). Explosions freeze while paused.
  - Ball lost when `ball.y > 600`: `lives −= 1`. At 0 lives the game ends. Otherwise the ball is placed on the paddle and launches instantly with the current level speed (no serve step).
  - 3 lives at start. Score accumulates across levels; lives carry over between levels.
  - 5 levels from `levels.js`, speeds `1.00, 1.10, 1.21, 1.33, 1.46`. Clearing a level loads the next one: blocks rebuilt, explosions cleared, ball repositioned on the paddle with the new speed; the paddle is not moved.
  - Clearing level 5 ends the game (win): `state = "gameover"`, `onGameOver(score)`. No bonus points.
- Original features dropped: sound (`ball-bounce.mp3`, `break-sound.mp3`) and the `Audio` objects; the pause overlay with level buttons 1–5; the in-canvas HUD and overlays; the offscreen-canvas copy of the spritesheet.
- Sprite loading: the engine freezes `update` until the image is ready. If the image fails to load, it logs `console.error` once and draws flat colored rectangles (same positions and sizes) so the game stays playable.
- Controls: `←` `→` move the paddle, mouse moves the paddle. `P` and `Esc` pause come from the shell.
- `CLAUDE.md` update: the `games` rows (now `asteroids`, `tetris`, `arkanoid`) and a note that engines may load assets from `public/games/<id>/` inside `start()`.

**Out of scope (for future specs):**

- Sound and music.
- Level selector (pause buttons 1–5) or any way to pick a level.
- Serve step (ball sticks to the paddle until a key or click).
- Paddle bounce angle control, power-ups, multi-hit blocks.
- Touch or on-screen controls, gamepad.
- Neon recolor of the in-canvas world.
- Loop after level 5 or any endless mode.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'arkanoid'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe todos los bloques con la pelota.',
  'Mueve la paleta para que la pelota no caiga y destruye todos los bloques. Cinco niveles con patrones distintos y una pelota cada vez más rápida. Tienes tres vidas.',
  'ARCADE',
  'cover-bricks',
  'cyan',
  3
);
```

`sort_order` 3 is the next unique value: `asteroids` holds 1 and `tetris` holds 2.

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
// lib/games/arkanoid/levels.ts
type LevelBlock = { col: number; row: number; color: BlockColor };
type Level = { speed: number; blocks: LevelBlock[] };
```

Conventions:

- Logic canvas is 800×600. Origin top-left, units in pixels. Velocities are px/s; time is in seconds inside the engine; explosion `elapsed` is kept in ms as in the original.
- Constants keep the original names and values: `PADDLE_SPEED`, `BLOCK_COLS`, `BLOCK_ROWS`, `BLOCK_W`, `BLOCK_H`, `BLOCK_COLORS`, `BLOCKS_ORIGIN_X`, `BLOCKS_ORIGIN_Y`, `BASE_BALL_VX`, `BASE_BALL_VY`, `EXPLOSION_DURATION`. New constants: `W = 800`, `H = 600`.
- `levels.ts` ports `LEVELS` with identical patterns, colors (including the `gray` row in level 2) and speeds. Sprite source rectangles (`SPRITES`, `EXPLOSION_FRAMES`) move to `constants.ts` unchanged.
- State `dead` is unused: losing a life keeps `playing`; the game goes from `playing` to `gameover` directly.
- No new frame-rate dependence: movement is time-based (`× dt`). The `dt` cap of 0.05 s is new; at the fastest speed the ball moves about 22 px per capped frame, less than a block height (24 px).

## Implementation plan

1. Create `lib/games/arkanoid/constants.ts` with the constants above, `SPRITES`, `EXPLOSION_FRAMES`, `BlockColor` and `W`, `H`. Manual check: `npm run lint` passes.
2. Create `lib/games/arkanoid/levels.ts` porting the 5 levels exactly. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
3. Copy the spritesheet to `public/games/arkanoid/spritesheet-breakout.png`. Manual check: `http://localhost:3000/games/arkanoid/spritesheet-breakout.png` serves the image.
4. Create `lib/games/arkanoid/engine.ts`, first part: closure state, `loadLevel`, `initBall`, `update` (paddle, ball, walls, paddle bounce, block collision, explosions, lives, level advance, win), snapshot and `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
5. Extend `engine.ts`: sprite loading in `start()` with error fallback, draw (blocks, explosions, paddle, ball, flat-rect fallback), rAF loop with `dt` cap and freeze until loaded, `start`, `stop`, `setPaused`, `restart`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
6. Extend `engine.ts`: key handling (`←` `→`), mouse handling with `getBoundingClientRect` scaling, `preventDefault`, input cleared on pause, blur and stop, mouse ignored while paused. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/arkanoid/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS and TETRIS still play.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `arkanoid` row; `/biblioteca` shows the card with the `.cover-bricks` art; `/juegos/arkanoid/jugar` plays; lives, level and score update.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

No UI is designed or created in this spec (the cover is reused and the shell is unchanged), so `/frontend-design` is not required. If `/spec-impl` finds the 800×600 canvas needs shell CSS changes, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] `games` has a row `arkanoid` with title `ARKANOID`, the copy above, category `ARCADE`, cover `cover-bricks`, color `cyan` and `sort_order` 3.
- [x] `/juegos/arkanoid/jugar` shows an 800×600 canvas; the game starts with the level 1 grid (10×6 blocks, 60 total), the paddle centered at `y = 560`, the ball launching from the paddle, and HUD score 0, lives 3, level 01.
- [x] `←` / `→` move the paddle at 400 px/s and it stops at both walls; holding both keys does not jump.
- [x] Moving the mouse over the canvas centers the paddle on the pointer, clamped to the walls, also when the canvas is scaled by CSS (checked at two viewport widths).
- [x] Mouse movement while paused does not move the paddle.
- [x] The ball bounces on left, right and top walls; it bounces on the paddle only when falling onto it; `vx` is unchanged by the paddle.
- [x] Hitting a block removes it, reverses `vy`, adds exactly 10 points to the score and plays a 4-frame explosion of about 150 ms.
- [x] At most one block is removed per frame.
- [x] Ball speed is `(200, −300) × speed` with speed 1.00, 1.10, 1.21, 1.33, 1.46 for levels 1 to 5.
- [x] Clearing all blocks loads the next level with its pattern (full grid, pyramid, checkerboard, rows with gaps, frame + cross), HUD level +1, the score and lives kept, and the ball back on the paddle.
- [x] Block counts per level are 60, 40, 30, 39 and 39 (levels 1 to 5).
- [x] Letting the ball fall below `y = 600` reduces HUD lives by 1 and puts the ball back on the paddle with the current level speed; the score and blocks are unchanged.
- [x] Losing the third life opens the game-over modal with the final score once.
- [x] Clearing level 5 opens the game-over modal with the final score once; no bonus points are added.
- [x] FIN opens the game-over modal with the current score.
- [x] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'arkanoid'`, the typed name and the final score (check with `execute_sql`).
- [x] The saved score shows on `/salon?game=arkanoid`, on `/juegos/arkanoid` (top 10), and in the home "recent" list after a reload.
- [x] The card and `/juegos/arkanoid` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [x] `/salon` and `/biblioteca` list ASTEROIDS, TETRIS and ARKANOID; `/salon` has three tabs.
- [x] PAUSA, `P` and `Esc` freeze the canvas (ball, blocks, explosions and paddle stop); pressing again resumes with no jump.
- [x] While the game is mounted, `←` and `→` do not scroll the page.
- [x] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [x] JUGAR DE NUEVO resets the HUD, blocks, level, lives and score; no duplicate loops run (ball speed stays constant after 3 restarts).
- [x] Blocking `/games/arkanoid/spritesheet-breakout.png` makes the game draw flat colored rectangles, stay playable and log one `console.error`.
- [x] Leaving the page stops the loop: no console errors and window and canvas listeners are removed.
- [x] `/juegos/asteroids/jugar` and `/juegos/tetris/jugar` still play exactly as before.
- [x] No console errors on `/juegos/arkanoid/jugar` during a full session.

## Decisions

- **Yes:** port from `references/started-games/04-arkanoid/`. It is complete and its rules are fully defined. **No:** writing rules from scratch.
- **Yes:** `id` `arkanoid`, English slug, same convention as `asteroids` and `tetris`. Title `ARKANOID`.
- **Yes:** follow `game.js` where it differs from the README or the reference spec (paddle 81 px, fixed level 4 gaps). **No:** 162 px paddle: it is easier and not what the running reference plays.
- **Yes:** drop sound. Same as SPEC 05 and SPEC 07; sound is its own spec. **No:** copying the mp3 files and `Audio` objects.
- **Yes:** keep the spritesheet and the explosion animation, with the PNG in `public/games/arkanoid/` loaded inside `start()`. **No:** flat rectangles only, because it loses the reference look. **No:** dropping the explosion, because the reference has a dedicated spec for it.
- **Yes:** flat-rect fallback if the image fails. **No:** a blank frozen canvas, because the player would see a broken game.
- **Yes:** drop the pause level selector. The shell owns pause, and the selector lets players skip to fast levels. **No:** keeping it, since it needs changes in `game-player.tsx` (goal is only-add).
- **Yes:** clearing level 5 ends the game and saves the final score. The shell only knows `gameover`. **No:** looping back to level 1 at higher speed.
- **Yes:** keep instant ball launch, no serve step. Matches the original. **No:** serve on key or click: new rule, own spec.
- **Yes:** keep mouse and keyboard control. Mouse coordinates are scaled with `getBoundingClientRect`. **No:** keyboard only.
- **Yes:** keep the original physics exactly (always-flip `vy` on block hit, one block per frame, no paddle angle). **No:** angle control or per-side collision: it changes the game.
- **Yes:** `dt` cap 0.05 s, as the platform contract requires. The original had no cap.
- **Yes:** the 80 px band above the blocks stays empty. **No:** moving the grid up, since levels and ball starting positions depend on it.
- **Yes:** HUD fields `lives` (`hearts`, 3) and `level` (`pad2`, 1). Score is shown by the shell.
- **Yes:** reuse `.cover-bricks` (unused, and already draws colored bricks). **No:** a new cover.
- **Yes:** color `cyan`, because `asteroids` is `yellow` and `tetris` is `magenta`.
- **Yes:** `sort_order` 3 (next unique value).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts.      |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                               |
| Spritesheet load finishes after `stop()` (unmount or Strict Mode remount) | Ignore the `onload` / `onerror` callback when the engine is stopped; never start a loop from a stale callback. |
| `keys` stuck after pause or blur                                          | Clear input on `setPaused`, on `window` blur and on `stop`.                                                    |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic width; criterion checks two viewport widths.                |
| Mouse listener on the canvas stays after unmount                          | Attach in `start`, remove in `stop`; criterion checks no leaks after leaving the page.                         |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                         |
| Ball tunnels through a block at a long frame                              | `dt` cap of 0.05 s keeps per-frame movement under the 24 px block height at the fastest speed.                 |
| Frame-rate feel differs from the original (uncapped `dt`)                 | Movement stays time-based; only the cap is new. Note it in `constants.ts`; revisit only if 120/144 Hz differs. |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for ARKANOID (no touch controls); fixing it needs its own change.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.         |

## What is **not** in this spec

- Sound and music.
- Level selector in pause.
- Serve step.
- Paddle angle control, power-ups, multi-hit blocks.
- Touch controls and gamepad.
- Neon recolor.
- Loop or endless mode after level 5.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
