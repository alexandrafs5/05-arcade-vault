# SPEC JAM-duelo-01 — Neon Duel game (NEON DUEL) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-24
> **Objective:** Add NEON DUEL as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/duelo/jugar`.

## Why this spec exists

There is no reference game folder. NEON DUEL is written from scratch in the classic paddle-and-ball duel genre: the player holds the left paddle, a CPU holds the right one, and the ball speeds up with every return. The title avoids the genre's trademarked name; the game has its own rules (lives, an escalating rally score, a CPU that gets harder each time it misses) and no sprites.

It is the VERSUS entry of the "Neon Fairground" jam set (`bubbles`, `gallery`, `duelo`), taken from the `duelo` brief in `references/game-suggestions-todo.md`, which names two risks: no real multiplayer exists (VERSUS here is only a CPU opponent) and the score may feel weak for ranking. This spec answers the second one in the scoring: returns are worth more the longer the rally, and beating the CPU is worth `100 × level`, so scores spread widely between players. Real multiplayer stays out of scope.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-duelo-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

## Scope

**In:**

- Engine in `lib/games/duelo/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `ArrowUp` and `ArrowDown` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: court, dashed center line, both paddles, ball with a short trail, a serve countdown ring. Score, lives, rally, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Mouse input: `mousemove` on the window sets the paddle target y, converted with `getBoundingClientRect` and the logic size (the pointer may leave the canvas and the paddle keeps following the vertical position). Keyboard: `W` / `↑` move up, `S` / `↓` move down at 480 px/s. The last input device used owns the paddle.
- Entry in `lib/games/registry.ts` with `id: "duelo"`, logic size 640×480, HUD fields `lives`, `rally` and `level`.
- Migration `supabase/migrations/20261124000200_add_duelo_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-duelo` (`app/globals.css`: cyan paddle, magenta paddle, yellow ball). No new cover CSS.
- Rules:
  - Court 640×480, origin top-left, units in pixels. Paddles are `10 × 80`: the player's paddle center x is `30`, the CPU's is `610`. Ball radius `7`.
  - Player paddle: follows the pointer y at a maximum speed of `1400` px/s, clamped so it stays fully inside the court.
  - Ball: starts at `(320, 240)`. Speed starts at `BALL_SPEED_START = 360` px/s and grows by `BALL_SPEED_STEP = 24` on every paddle hit (either paddle) up to `BALL_SPEED_MAX = 760`. Movement uses sub-steps of at most 6 px.
  - Wall bounce: the ball reflects on the top and bottom edges.
  - Paddle hit: `offset = (ball.y − paddle.y) / 40` clamped to −1..1; the bounce angle is `offset × 60°` from the horizontal, the horizontal direction flips, speed is the new speed. A ball hitting the paddle face from the front only (not from behind the paddle line) is a hit.
  - Serve: the ball is placed at the center, waits `SERVE_DELAY = 0.8` s (countdown ring), then leaves toward the CPU at a random angle between −25° and 25°, at start speed. Every serve goes toward the CPU.
  - Player return: `rally += 1`, then `+10 × min(1 + floor(rally / 4), 6)` points. Returns 1–3 give 10, 4–7 give 20, 8–11 give 30, and so on up to 60 from the 20th return.
  - CPU miss (the ball leaves through the right edge): `+100 × level` points, `level += 1`, `rally = 0`, serve.
  - Player miss (the ball leaves through the left edge): `lives −= 1`, `rally = 0`; if lives reach 0, `state = "gameover"` and `onGameOver(score)` fires once; otherwise serve.
  - CPU: its target y is the ball y plus an error `err`, redrawn at every serve and every CPU return, uniformly in `±errMax`. It re-reads the ball every `CPU_REACTION = 0.12` s. It moves toward the target at `cpuSpeed` px/s only while the ball is moving toward it; otherwise it drifts to y 240 at half `cpuSpeed`.
  - CPU difficulty by level: `cpuSpeed = min(220 + 30 × (level − 1), 480)`; `errMax = max(36 − 4 × (level − 1), 8)`.
  - Start: 3 lives, rally 0, level 1, score 0.
- Scores through the existing `saveScore` (`lib/session.tsx`) into `scores`. Nothing new in the shell. The game shows on `/salon?game=duelo`, `/juegos/duelo` (top 10), the home lists and the game card stats with no extra code.
- `CLAUDE.md` update: the `games` table row list.

**Out of scope (for future specs):**

- Orbs (wide paddle, slow ball, shield) and CPU styles: JAM-duelo-02.
- Real multiplayer, local two-player on one keyboard.
- Sound and music.
- Touch or on-screen controls, gamepad.
- Neon recolor skins (`classic`, `neon`, `retro`).
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'duelo'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'duelo',
  'NEON DUEL',
  'Devuelve la bola y aguanta el peloteo.',
  'Una paleta contra la CPU en una pista de neón. Cada devolución suma y la bola se acelera, pero la CPU también mejora. Si la bola pasa por tu lado, pierdes una vida.',
  'VERSUS',
  'cover-duelo',
  'cyan',
  9
);
```

`sort_order` 9 is the next free value at this moment: `asteroids` 1 to `frogger` 5, `scramble` (jam) reserves 6, `bubbles` (jam) 7, `gallery` (jam) 8. `color` must be one of `cyan`, `magenta`, `green`, `yellow` (check constraint); `cyan` matches the paddle on the existing cover. Both the migration timestamp (later than `20261118050845`, the last file today) and `sort_order` are re-checked when the spec is promoted. The `id` `duelo` is free: the early mock row `duelo-pixel` was removed by `20261116000200_remove_mock_games.sql`, and `/spec-impl` confirms it with `execute_sql` before applying.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "rally", label: "Peloteo", format: "number", initial: 0 },
  { key: "level", label: "Nivel", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { lives, rally, level } }
```

```ts
// lib/games/duelo/constants.ts
const W = 640, H = 480;
const PADDLE_W = 10, PADDLE_H = 80, PLAYER_X = 30, CPU_X = 610;
const BALL_R = 7, BALL_SPEED_START = 360, BALL_SPEED_STEP = 24, BALL_SPEED_MAX = 760;
const BOUNCE_MAX_DEG = 60, SERVE_DELAY = 0.8, SERVE_SPREAD_DEG = 25, SUBSTEP = 6;
const MOUSE_PADDLE_MAX = 1400, KEY_PADDLE_SPEED = 480;
const RETURN_POINTS = 10, RALLY_STEP = 4, RALLY_MULT_MAX = 6, CPU_MISS_POINTS = 100;
const CPU_REACTION = 0.12, START_LIVES = 3;
const CPU_SPEED_START = 220, CPU_SPEED_STEP = 30, CPU_SPEED_MAX = 480;
const CPU_ERR_START = 36, CPU_ERR_STEP = 4, CPU_ERR_MIN = 8;
```

Conventions:

- Logic canvas is 640×480, units in pixels, time inside the engine in seconds. Speeds are px/s, so play is frame-rate independent.
- Ball speed is a scalar; direction comes from the bounce angle.
- The engine uses `Math.random` for serves and CPU error; there is no seed.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.
- No new tables, no new `localStorage` keys.

## Implementation plan

1. Create `lib/games/duelo/constants.ts` with the constants above. Manual check: `npm run lint` passes.
2. Create `lib/games/duelo/engine.ts`, first part: closure state (paddles, ball, rally, level, lives, score, serve timer), ball movement with sub-steps, wall and paddle bounce, serve, miss handling, scoring, and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: player input (window `mousemove` converted with `getBoundingClientRect`, `W` `S` `↑` `↓`), `preventDefault` on arrows, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Extend `engine.ts`: CPU (reaction timer, error, speed by level, drift). Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (court, center line, paddles, ball trail, serve ring), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/duelo/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `duelo` row; `/biblioteca` shows the card with the existing `.cover-duelo` art; `/juegos/duelo/jugar` plays.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

No UI is designed or created in this spec (the cover is reused and the shell is unchanged), so `/frontend-design` is not required. If `/spec-impl` finds the cover needs rework, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `duelo` with title `NEON DUEL`, the copy above, category `VERSUS`, cover `cover-duelo`, color `cyan` and `sort_order` 9.
- [ ] `/juegos/duelo/jugar` shows a 640×480 canvas; the game starts with HUD lives 3, peloteo 0, level 01, score 0, the ball at the center and a 0.8 s serve countdown.
- [ ] Paddles are 10×80 px, centered at x 30 (player) and x 610 (CPU); both stay fully inside the court.
- [ ] The player paddle follows the mouse y (also with the pointer outside the canvas); `W` / `↑` and `S` / `↓` move it at 480 px/s; at 375 px width the paddle follows the visible pointer (coordinates converted with `getBoundingClientRect`).
- [ ] The first serve leaves toward the CPU at 360 px/s within ±25° of the horizontal.
- [ ] The ball reflects on the top and bottom edges with no speed change.
- [ ] A paddle hit at the paddle center returns the ball horizontally; a hit at the paddle edge returns it at 60°.
- [ ] Ball speed rises 24 px/s on every paddle hit and never exceeds 760 px/s.
- [ ] The 1st, 2nd and 3rd player returns add 10 each; the 4th adds 20; the 8th adds 30; the 20th and later add 60.
- [ ] HUD peloteo equals the player returns since the last serve and resets to 0 on a miss by either side.
- [ ] When the ball leaves through the right edge, the score adds exactly `100 × level`, the level goes up by 1 and a new serve starts.
- [ ] When the ball leaves through the left edge, one heart is removed, the rally resets and a new serve starts.
- [ ] CPU speed is 220 px/s at level 1, 250 at level 2, 480 at level 10 and never above 480; its error range is ±36 at level 1 and never below ±8.
- [ ] The CPU is beatable at level 1: an edge hit (60°) at the 6th paddle hit (504 px/s) gives a vertical speed of about 436 px/s, above the level 1 CPU speed of 220 px/s.
- [ ] Losing the third life opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'duelo'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=duelo`, on `/juegos/duelo` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/duelo` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas (ball, serve timer and CPU); pressing again resumes with no jump.
- [ ] While the game is mounted, `↑` and `↓` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, ball, paddles, rally, level and score; no duplicate loops run (the first serve speed stays 360 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners (including `mousemove`) are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/duelo/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch, title `NEON DUEL`. **No:** using the genre's trademarked name or copying the look of an existing game.
- **Yes:** `id` `duelo`, as in the planner brief and the existing unused `.cover-duelo`. Title in English like `SNAKE` and `TETRIS`.
- **Yes:** category `VERSUS` with a CPU opponent only. It fills the empty VERSUS category; real multiplayer needs infrastructure that does not exist. **No:** local two-player: the score is for one player.
- **Yes:** score = rally points as briefed, with an escalating return value and a `100 × level` bonus per CPU miss. **No:** `+1` per return: it would give a thin, easily tied ranking, which is the brief's risk.
- **Yes:** lives (`hearts`), rally (`number`) and level (`pad2`) in the HUD, so the player sees what drives the score. The brief did not fix the HUD: flagged for review.
- **Yes:** every serve goes toward the CPU. **No:** alternating serves: the player would face a surprise ball with no reaction time.
- **Yes:** the CPU is beaten by speed and angle (a capped `cpuSpeed` against a ball that accelerates to 760 px/s), and it improves on each miss. **No:** a random "CPU fails" chance: the skill is the player's.
- **Yes:** the game is lost only by lives; there is no match point or set. **No:** winning a match at N points: runs would cap the score.
- **Yes:** mouse first with a keyboard fallback. **No:** touch controls: out of scope.
- **Yes:** no sprites, everything drawn with canvas primitives. **No:** assets: no `public/games/duelo/` and no SPEC 08 dependency.
- **Yes:** reuse `.cover-duelo` (exists, unused, cyan and magenta paddles with a yellow ball). **No:** a new cover.
- **Yes:** color `cyan`, matching the cover; `sort_order` 9 (next free value, re-checked on promotion).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The score feels weak for ranking (named in the brief)                     | Escalating return points (10 to 60) and `100 × level` per CPU miss; a good run reaches thousands of points.     |
| The CPU is unbeatable or too easy                                         | Capped `cpuSpeed` and `errMax` formulas in `constants.ts`; tune only those numbers if play testing disagrees.   |
| Fast ball tunnels through a paddle                                        | Move in sub-steps of at most 6 px; test the paddle face after each sub-step.                                    |
| Ball stuck bouncing inside a paddle edge                                  | A hit only counts when the ball moves toward that paddle; after a hit it is placed outside the paddle face.     |
| Mouse follows only inside the canvas, paddle freezes at the edges         | Listen to `mousemove` on `window` and use only the vertical position.                                           |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the 640×480 logic size; a criterion checks it at 375 px width.         |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks serve speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                |
| Input stuck after pause or blur                                           | Clear keys on `setPaused`, on `window` blur and on `stop`.                                                      |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                          |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for NEON DUEL (no touch controls); fixing it needs its own change.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- Orbs and CPU styles (JAM-duelo-02).
- Real multiplayer and local two-player.
- Sound and music.
- Touch or on-screen controls and gamepad.
- Neon recolor skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
