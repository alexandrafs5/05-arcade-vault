# SPEC JAM-hoops-01 — Basket Shootout game (HOOPS) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-26
> **Objective:** Add HOOPS as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/hoops/jugar`.

## Why this spec exists

There is no reference folder: the game is written from scratch from the `hoops` entry in `references/game-suggestions-todo.md` (ARCADE, yellow, "timed basket shots, mouse/keyboard, score = baskets"). It is a side-view free-throw game: aim, charge, release, watch the ball fly under gravity. Everything is drawn with canvas primitives (no sprites, no assets).

The suggestion lists shot-physics tuning as the risk. This spec fixes every physics constant and requires a tuning check (plan step 5) proving that a scoring shot exists in a comfortable power window.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-hoops-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/hoops/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop` (a charge in progress is cancelled, no shot is fired); `preventDefault` on `ArrowUp`, `ArrowDown` and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: court, backboard, rim, net, ball, aim guide and power meter. Score, balls, time, pause menu and game-over overlay are not drawn; the shell shows them.
- Mouse input converts pointer coordinates with `getBoundingClientRect` and the logic size.
- Entry in `lib/games/registry.ts` with `id: "hoops"`, logic size 640×480, HUD fields `balls` and `time`.
- Migration `supabase/migrations/20261126000100_add_hoops_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-hoops` in `app/globals.css`, designed with `/frontend-design`. The unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`, and none shows a basketball hoop (`.cover-invaders` is taken by `invaders`, `.cover-duelo` is reserved for a pending game).
- Rules:
  - Fixed shooter spot at `(110, 380)`. One ball at a time. 15 balls and 60 seconds per game.
  - Aim: the pointer position sets the aim angle (vector from the shooter spot to the pointer, clamped to 20°–80° above the horizontal). `ArrowUp` / `ArrowDown` change the angle by 40°/s. The last input used wins. Default angle 55°.
  - Charge: hold the left mouse button on the canvas, or hold `Space`. Power goes `0 → 1 → 0 → ...` as a ping-pong at 1 unit per second. Releasing fires the ball with launch speed `350 + 500 × power` px/s.
  - Physics: gravity 900 px/s², ball radius 12, fixed sub-step 1/120 s.
  - Surfaces: floor at `y = 440` (restitution 0.6), backboard rectangle `x 548–556, y 130–250` (restitution 0.7), two rim points at `(484, 210)` and `(540, 210)` with radius 4 (restitution 0.55; circle-circle collision with the ball).
  - A basket counts when the ball center crosses `y = 210` moving downward while `x` is between 484 and 540, once per ball. A clean basket (no rim point, backboard or floor contact before it) gives 3 points; any other basket gives 2.
  - A ball ends on its second floor contact, when `x > 680`, when `y > 520`, or 5 s after launch. 0.4 s later the next ball is ready. A ball in flight when time reaches 0 is discarded.
  - The game ends when the time reaches 0 or when the 15th ball has ended. Score is the points total.
- Spanish UI strings: HUD labels `Balones`, `Tiempo`.
- `CLAUDE.md` update: the `games` table (row `hoops`) and the "Five games" sentence.

**Out of scope (for future specs):**

- Streak multiplier, time bonuses and the moving hoop (`JAM-hoops-02`).
- Sound and music.
- Touch controls, gamepad, multiplayer.
- Ball skins, court themes, shooter animation.
- Neon recolor of the in-canvas world.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'hoops'`). Maximum possible score in this spec is 45, far below 10,000,000.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'hoops',
  'BASKET SHOOTOUT',
  'Encesta antes de que se acabe el tiempo.',
  'Apunta con el ratón, mantén pulsado para cargar la fuerza y suelta para lanzar. Tienes 15 balones y 60 segundos: un tiro limpio vale 3 puntos y uno que toca aro o tablero vale 2.',
  'ARCADE',
  'cover-hoops',
  'yellow',
  7
);
```

`color` must be one of `cyan`, `magenta`, `green`, `yellow`. Today: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. `yellow` is the planner's pick. `sort_order` 7 is the next free value at this moment (`asteroids` 1 to `frogger` 5, and 6 is held by the draft `scramble`; the other jam games `gallery` and `invaders` take 8 and 9). The timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "balls", label: "Balones", format: "number", initial: 15 },
  { key: "time", label: "Tiempo", format: "number", initial: 60 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { balls, time } }
```

```ts
// lib/games/hoops/constants.ts
const W = 640, H = 480;
const SHOOTER = { x: 110, y: 380 };
const BALL_R = 12, GRAVITY = 900, SUBSTEP = 1 / 120;
const SPEED_MIN = 350, SPEED_RANGE = 500;       // launch speed = SPEED_MIN + SPEED_RANGE * power
const CHARGE_RATE = 1;                           // power units per second, ping-pong
const ANGLE_MIN = 20, ANGLE_MAX = 80, ANGLE_DEFAULT = 55, ANGLE_KEY_RATE = 40; // degrees
const FLOOR_Y = 440, REST_FLOOR = 0.6, REST_BOARD = 0.7, REST_RIM = 0.55;
const RIM = { left: { x: 484, y: 210 }, right: { x: 540, y: 210 }, r: 4 };
const BOARD = { x: 548, y: 130, w: 8, h: 120 };
const BALLS_START = 15, TIME_START = 60, BALL_MAX_LIFE = 5, NEXT_BALL_DELAY = 0.4;
const POINTS_CLEAN = 3, POINTS_DIRTY = 2;
```

Conventions:

- Logic canvas is 640×480, origin top-left, units in pixels and seconds. Physics runs in fixed 1/120 s sub-steps fed by the capped `dt`, so a 144 Hz display plays like 60 Hz.
- HUD `balls` is the number of balls not yet launched (a ball in flight is already counted out). HUD `time` is `ceil(secondsLeft)`.
- The engine state is `playing` until the end condition, then `gameover` directly. `dead` is unused.
- The game-over modal appears 0 s after the last ball ends or the time hits 0, so the shot that is still flying when the 15th ball ends can still score; only time-out discards it.

## Implementation plan

1. Create `lib/games/hoops/constants.ts` with the constants above. Manual check: `npm run lint` passes.
2. Create `lib/games/hoops/engine.ts`, first part: closure state (ball, balls left, time, score, per-ball flags `touched`, `scored`), `launch`, one fixed `substep` (gravity, floor, backboard, rim circles, basket detection, ball end) and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: input (pointer aim with `getBoundingClientRect`, arrow keys, mouse-hold and `Space` charge ping-pong, release to fire), `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Extend `engine.ts`: draw (court, board, rim, net, ball, dotted aim guide of the first 0.6 s of the trajectory, power meter beside the shooter), rAF loop with `dt` cap and sub-step accumulator, `start`, `stop`, `setPaused`, `restart`, skip idle redraws when paused. Manual check: lint and tsc pass.
5. Tuning check (no code change unless it fails): in the browser, find a scoring pair. A shot at 60° with launch speed 745 px/s must enter the hoop center (power 0.79). Adjust only `SPEED_MIN`, `SPEED_RANGE` and restitution constants if the scoring window is narrower than ±0.04 power at 60°. Manual check: at 60°, power between 0.75 and 0.83 scores at least 3 of 5 tries.
6. Add the `registry.ts` entry. Manual check: `/juegos/hoops/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
7. Add `.cover-hoops` to `app/globals.css` with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview with no layout change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `hoops` row; `/biblioteca` shows the card; `/juegos/hoops/jugar` plays.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `hoops` with title `BASKET SHOOTOUT`, the copy above, category `ARCADE`, cover `cover-hoops`, color `yellow` and `sort_order` 7 (or the next free value at promotion).
- [ ] `/juegos/hoops/jugar` shows a 640×480 canvas; the game starts with score 0, HUD balls 15, HUD time 60, the ball at `(110, 380)` and the angle at 55°.
- [ ] Moving the pointer changes the aim angle between 20° and 80°; `ArrowUp` / `ArrowDown` change it by 40° per second.
- [ ] Holding the left mouse button or `Space` fills the power meter from 0 to 1 in 1 s and back down; releasing fires with speed `350 + 500 × power` px/s.
- [ ] A ball cannot be fired while another is in flight; the next ball is ready 0.4 s after the previous one ends.
- [ ] Each launch lowers HUD balls by exactly 1; after 15 launches and the end of the 15th ball the game-over modal opens.
- [ ] A basket with no rim, backboard or floor contact adds 3 to the score; a basket after any contact adds 2.
- [ ] A ball crossing `y = 210` downward outside `x 484–540` adds 0, and one ball never scores twice.
- [ ] A shot at 60° with power between 0.75 and 0.83 scores at least 3 of 5 tries.
- [ ] HUD time counts down from 60 and the game-over modal opens when it reaches 0, once, with the current score.
- [ ] Releasing the pointer outside the canvas still fires the charged shot; pausing or window blur while charging cancels it without a shot and without losing a ball.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'hoops'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=hoops`, on `/juegos/hoops` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/hoops` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, the ball and the timer; pressing again resumes with no jump.
- [ ] While the game is mounted, `ArrowUp`, `ArrowDown` and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] With the canvas scaled by CSS, a click at the visual position of the ball sets an aim angle consistent with the logic coordinates (check at 375 px width and at 1280 px width).
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, ball, timer and score; no duplicate loops run (gravity fall time of a dropped ball stays the same after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/hoops/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch, side view, free-throw style. **No:** copying any existing basketball game's look or levels.
- **Yes:** `id` `hoops`, from the planner entry. Title `BASKET SHOOTOUT`.
- **Yes:** hold-and-release power with a ping-pong meter plus pointer aim: it makes the mouse the main input and keeps the skill in timing. **No:** drag-to-aim slingshot: it needs pointer capture outside the canvas.
- **Yes:** keyboard alternative (`ArrowUp` / `ArrowDown` and `Space`) so the game also works without a mouse. **No:** touch controls: out of scope.
- **Yes:** score is points (3 clean, 2 dirty), not raw basket count. It rewards accuracy and gives the leaderboard more spread. **No:** counting baskets only.
- **Yes:** fixed 1/120 s physics sub-step. **No:** per-frame physics: it would differ at 144 Hz.
- **Yes:** fixed shooter spot and fixed hoop in the core. Variety (moving hoop, streaks) comes in `JAM-hoops-02`.
- **Yes:** game ends on time or on the last ball, whichever comes first. **No:** unlimited balls: no pressure to be accurate.
- **Yes:** HUD fields `balls` (`number`, 15) and `time` (`number`, 60), as the brief says. **No:** `hearts` or `pad2`: no lives, no levels.
- **Yes:** new cover `.cover-hoops` with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to other games.
- **Yes:** color `yellow`, the planner's pick. **No:** picking by catalog count.
- **Yes:** `sort_order` 7 (next free value, re-checked on promotion).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Shot physics feel wrong or the scoring window is too narrow               | Plan step 5 is a mandatory tuning check with a numeric target (±0.04 power at 60°); constants are in one file. |
| Tunnelling: a fast ball skips through the rim points or backboard         | Fixed 1/120 s sub-step; max speed 850 px/s moves 7 px per sub-step, less than the 16 px collision radius.  |
| Release outside the canvas is lost                                        | `mouseup` is listened on `window`, `mousedown` on the canvas only.                                         |
| Charge stuck after pause or blur                                          | Clear input and cancel the charge on `setPaused`, on `window` blur and on `stop`.                          |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks fall time after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                          |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size; criterion checks two viewport widths.            |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                    |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for HOOPS (no touch controls); fixing it needs its own change.                |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.    |

## What is **not** in this spec

- Streak multiplier, time bonuses and the moving hoop.
- Sound and music.
- Touch controls, gamepad and multiplayer.
- Ball skins, court themes, shooter animation.
- Neon recolor.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
