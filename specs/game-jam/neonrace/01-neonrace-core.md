# SPEC JAM-neonrace-01 — Neon Racer core game (NEON RACER) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-19
> **Objective:** Add NEON RACER as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/neonrace/jugar`.

## Why this spec exists

There is no reference game folder. NEON RACER is an original top-down traffic-dodging racer written from scratch: a fixed camera looks straight down a neon highway, the player steers a car sideways between slower traffic and controls speed with the throttle. The score grows with speed, so going fast is the risk and the reward. It is not pseudo-3D: every object is a flat rectangle drawn from above, with primitives only (no assets).

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-neonrace-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/neonrace/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: verge, road, lane dashes, traffic and the player car. Score, speed, lives, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "neonrace"`, logic size 480×640, HUD fields `speed` and `lives`.
- Migration `supabase/migrations/20261119000000_add_neonrace_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-neonrace` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders`, `.cover-rana` and `.cover-duelo`; the last three are reserved for pending suggestions (`invaders`, `rana`, `duelo`) and `.cover-glot` shows a maze eater, so none fits a racer.
- Rules:
  - Road: 4 lanes of 80 px, road spans `x = 80` to `x = 400`; the 80 px strips left and right are the neon verge (not drivable). Lane centers are `x = 120, 200, 280, 360`.
  - Player car: 36×60 px, fixed at center `y = 520`, starts at `x = 200` (center of lane 2). Steering is continuous: `←` / `A` move left and `→` / `D` move right at `STEER_SPEED = 240` px/s; the car center is clamped to `x ∈ [98, 382]` so the car never leaves the road.
  - Throttle: `↑` / `W` hold to accelerate, `↓` / `S` hold to brake, no key to cruise. Speed is in km/h and moves toward a target speed: the target is `SPEED_MAX = 320` with `↑`, `SPEED_MIN = 60` with `↓`, otherwise the current pace. Pace starts at `PACE_START = 100` and rises `PACE_RAMP = 3` km/h per second up to `PACE_MAX = 220`. Rates: `ACCEL = 90` km/h per s when speeding up, `BRAKE = 160` km/h per s when `↓` is held, `COAST = 50` km/h per s when slowing down toward the pace with no key held.
  - Scroll: world scroll speed is `speed × PX_PER_KMH`, `PX_PER_KMH = 2` px/s per km/h (320 km/h = 640 px/s). Lane dashes (24 px long, 24 px gap) scroll with it.
  - Traffic: cars are 36×60 px and spawn above the screen at `y = -70` in rows. A row spawns every `ROW_GAP_PX = 240` px of accumulated scroll, so density is the same at any speed. Each row occupies 1 lane, or 2 lanes with probability `min(0.5, t / 120)` where `t` is seconds played; never 3 or more lanes, so a gap always exists. No row spawns during the first 2 s. Each car has its own speed picked uniformly from `[50, 90]` km/h and moves on screen at `(playerSpeed - carSpeed) × PX_PER_KMH` px/s (downward when positive); cars with `y > 720` or `y < -140` are removed.
  - Collision: axis-aligned boxes, hitboxes shrunk by 3 px on each side. A hit costs 1 life, removes that car, sets speed to `SPEED_MIN = 60` and starts `INVULN_S = 1.5` s of invulnerability (the car blinks, hits are ignored). Lives start at 3; at 0 lives `state = "gameover"` and `onGameOver(score)` fires once.
  - Scoring: `speed / 10` points per second (a fractional accumulator; the integer score is its floor), so cruising at 150 km/h gives 15 points per second and 320 km/h gives 32. Overtaking a car (its center `y` passes below the player car center `y`, once per car) adds 25 points. Score keeps growing while the car blinks.
  - No win state: the game is endless and ends only by losing the last life.
- Drawing (primitives only): background `#0a0a18`, verge with a faint grid in `#1b0f2e`, road `#14142b` with edge lines `#ff2bd6`, lane dashes `#00e5ff`, player car magenta `#ff2bd6` with a cyan windshield, traffic cars colored from `#00e5ff`, `#ffd400`, `#00ff88`. No `shadowBlur` in the loop (it is the main frame cost, see `references/game-performance.md`).
- `CLAUDE.md` update: add the `neonrace` row to the Games table (spec number assigned at promotion, `sort_order` 7, canvas notes "480×640, primitives only, keyboard", HUD "speed (`number`), lives (`hearts`)").

**Out of scope (for future specs):**

- Near-miss combo and nitro pads (JAM-neonrace-02).
- Sound and music.
- Touch controls, on-screen gamepad, gamepad support.
- Skins (`classic` / `neon` / `retro`).
- Pseudo-3D camera, curves, hills, road hazards (oil, cones), weather.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'neonrace'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'neonrace',
  'NEON RACER',
  'Esquiva el tráfico a toda velocidad.',
  'Conduce por una autopista de neón entre coches más lentos. Cuanto más rápido vas, más puntos ganas, pero un choque te cuesta una vida. Tienes tres: aguanta el máximo tiempo posible.',
  'ARCADE',
  'cover-neonrace',
  'magenta',
  7
);
```

Today the catalog colors are: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. `magenta` matches the cover. `sort_order` 7 is the next free value in the committed migrations (`asteroids` 1 to `frogger` 5; 6 is held by the jam spec `scramble`). The other two jam games of this batch propose 8 and 9. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "speed", label: "Velocidad", format: "number", initial: 100 },
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { speed, lives } }
```

```ts
// lib/games/neonrace/constants.ts
const W = 480, H = 640;
const ROAD_X = 80, LANES = 4, LANE_W = 80;
const CAR_W = 36, CAR_H = 60, PLAYER_Y = 520;
const STEER_SPEED = 240;                 // px/s
const SPEED_MIN = 60, SPEED_MAX = 320;   // km/h
const PACE_START = 100, PACE_RAMP = 3, PACE_MAX = 220;
const ACCEL = 90, BRAKE = 160, COAST = 50; // km/h per s
const PX_PER_KMH = 2;
const ROW_GAP_PX = 240;
const INVULN_S = 1.5, START_LIVES = 3;
const OVERTAKE_POINTS = 25;
```

Conventions:

- Logic canvas is 480×640, origin top-left, units in pixels; time in seconds; speeds in km/h and converted to px/s with `PX_PER_KMH`.
- The HUD `speed` is the speed rounded down to a multiple of 5 km/h, so `onChange` does not fire every frame during acceleration. The snapshot `score` is the floor of the accumulator.
- Traffic is a list `{ x, y, speed, color, passed }`. Spawning is driven by accumulated scroll distance, not by time.
- Physics is `dt`-based; nothing depends on the frame rate.

## Implementation plan

1. Create `lib/games/neonrace/constants.ts` with the constants above, lane centers and colors. Manual check: `npm run lint` passes.
2. Create `lib/games/neonrace/engine.ts`, first part: closure state, `reset`, speed model (target, pace, approach), scroll accumulator and snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: traffic rows (spawn by scroll distance, lane rules, speeds), overtaking, collision, lives, invulnerability and scoring. Manual check: lint and tsc pass.
4. Extend `engine.ts`: key handling (arrows and WASD), `preventDefault` on arrows, input cleared on pause, blur and stop; draw (verge, road, dashes, traffic, player, blink); rAF loop with `dt` cap; `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/neonrace/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS, ARKANOID, SNAKE and FROGGER still play.
6. Add the `.cover-neonrace` rule to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview and no other cover changes.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `neonrace` row; `/biblioteca` shows the card with the new cover; `/juegos/neonrace/jugar` plays; speed, lives and score update.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

The cover is new UI: `/spec-impl` must use `/frontend-design` for it. The in-canvas drawing is primitives and follows the colors above.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `neonrace` with title `NEON RACER`, the copy above, category `ARCADE`, cover `cover-neonrace`, color `magenta` and `sort_order` 7 (or the value re-checked at promotion).
- [ ] `/juegos/neonrace/jugar` shows a 480×640 canvas; the game starts with the player car at `x = 200`, `y = 520`, HUD speed 100, 3 hearts and score 0; no traffic appears during the first 2 s.
- [ ] `←` / `A` and `→` / `D` steer at 240 px/s; the car center never goes outside `x ∈ [98, 382]`.
- [ ] Holding `↑` / `W` raises the speed to 320 km/h at 90 km/h per s; holding `↓` / `S` lowers it to 60 km/h at 160 km/h per s; with no key the speed follows the pace (100 km/h at 0 s, +3 km/h per s, capped at 220).
- [ ] The HUD speed changes in steps of 5 km/h.
- [ ] Score grows by `speed / 10` per second: holding 320 km/h for 10 s adds 320 ± 5 points (excluding overtakes).
- [ ] Overtaking a car adds exactly 25 points once per car.
- [ ] A row never contains 3 or more cars; a row has 2 cars only after the first 2 s, with probability `min(0.5, t / 120)`.
- [ ] Rows are 240 px of scroll apart at 100 and at 300 km/h (same density per meter).
- [ ] A collision removes 1 heart, sets the speed to 60 km/h and makes the car blink for 1.5 s, during which collisions do nothing.
- [ ] Losing the third heart opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'neonrace'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=neonrace`, on `/juegos/neonrace` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/neonrace` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; pressing again resumes with no jump (no extra scroll or points).
- [ ] While the game is mounted, the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, traffic, speed and score; no duplicate loops run (scroll speed at 100 km/h stays 200 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/neonrace/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch as a generic top-down traffic dodger. **No:** copying any specific racing game's cars, tracks, names or look.
- **Yes:** `id` `neonrace` (the planner's id), title `NEON RACER`.
- **Yes:** strict top-down flat view. **No:** pseudo-3D road: it is a different engine and the planner flagged it as a risk.
- **Yes:** continuous steering with a clamped car. **No:** snapping between lanes: continuous steering gives the near-miss skill used by the feature spec.
- **Yes:** score from speed (`speed / 10` per second) plus 25 per overtake, so high speed is the reward. **No:** distance-only score: speed would not matter.
- **Yes:** three lives and 1.5 s invulnerability. **No:** one-hit death: sessions would be too short for the score to matter.
- **Yes:** HUD `speed` snapped to multiples of 5. **No:** raw speed: it would fire `onChange` on almost every frame.
- **Yes:** spawn rows by scroll distance and cap rows at 2 cars. **No:** random time-based spawns: they could produce a full wall of cars.
- **Yes:** endless game, no win state. **No:** a finish line: the leaderboard rewards survival.
- **Yes:** primitives only, no assets. **No:** sprites: not needed, so no SPEC 08 dependency.
- **Yes:** new cover `.cover-neonrace` with `/frontend-design`. **No:** reusing `.cover-rana`, `.cover-invaders` or `.cover-duelo`: they belong to pending suggestions.
- **Yes:** color `magenta` as the planner's pick. **No:** another color: a magenta road matches the cover.
- **Yes:** `sort_order` 7 (next free value), re-checked on promotion.
- **Yes:** keyboard only; touch, sound and gamepad are out of scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks scroll speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                 |
| Input stuck after pause or blur                                           | Clear held keys on `setPaused`, on `window` blur and on `stop`.                                                  |
| Unfair walls of traffic at high speed                                     | Rows hold at most 2 cars of 4 lanes; a lane is always open; 2 s of empty road at start.                          |
| Score runaway for long sessions                                           | The top rate is 32 points per second; 10,000,000 needs about 87 hours of play, so no cap is needed.              |
| Players can hold `↑` all game and ignore risk                             | At 320 km/h the reaction window is short; the feature spec adds near-miss combos for risk takers.                |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                           |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for NEON RACER (no touch controls); fixing it needs its own change.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.           |

## What is **not** in this spec

- Near-miss combo and nitro pads.
- Sound and music.
- Touch controls, on-screen gamepad and gamepad support.
- Skins.
- Pseudo-3D camera, curves, hills, hazards and weather.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
