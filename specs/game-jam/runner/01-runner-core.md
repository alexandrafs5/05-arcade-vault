# SPEC JAM-runner-01 — Neon Runner game (NEON RUNNER) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-18
> **Objective:** Add NEON RUNNER as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/runner/jugar`.

## Why this spec exists

There is no reference game folder. NEON RUNNER is an endless runner written from scratch with one key: jump. To avoid the clone feel the brief warns about, the world is not a desert or a dinosaur. The player is a courier crossing the rooftops of a neon city: the "floor" is a chain of rooftop slabs with gaps between them, a glowing light trail follows the courier, and obstacles are rooftop machinery. A tap gives a short hop, holding the key gives a full jump, so one key still has two heights to master.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the player name, score, HUD, pause, game-over modal and score saving. A new game only adds files; the shell is not changed. No asset is loaded (primitives only), so SPEC 08 is not a dependency.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-runner-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/runner/` (`constants.ts`, `engine.ts`, `track.ts` for the segment generator) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and `ArrowUp` except while typing in an `INPUT` or `TEXTAREA`.
- Physics runs on a fixed step `PHYS_DT = 1 / 120` s over the capped `dt`.
- The canvas draws only the world: skyline, rooftops, runner with trail, obstacles. Score, distance, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "runner"`, logic size 720×360, HUD field `distance`.
- Migration `supabase/migrations/20261118060100_add_runner_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-runner` in `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows a skyline, and `.cover-invaders` / `.cover-duelo` are reserved for pending suggestions.
- Rules:
  - Logic canvas 720×360, origin top-left, `GROUND_Y = 290` is the top of the rooftops. The runner is drawn at a fixed screen `RUN_X = 140`; the world scrolls left.
  - Runner hitbox 22 px wide × 40 px tall, feet at the bottom. Obstacle hitboxes are shrunk by 2 px per side for fairness.
  - Scroll speed: `speed = min(SPEED_MAX, SPEED_START + SPEED_ADD × t)` px/s with `SPEED_START = 300`, `SPEED_ADD = 5`, `SPEED_MAX = 720`, `t` seconds since the run started (max speed after 84 s).
  - Jump: key down on `Space`, `↑` or `W` while grounded (or within `COYOTE = 0.08` s after leaving a rooftop edge, or within `JUMP_BUFFER = 0.10` s before landing) sets `vy = -JUMP_V` with `JUMP_V = 860` px/s. `GRAVITY = 2600` px/s². Releasing the key while rising faster than `CUT_V = 350` px/s sets `vy = -350`. A full-hold jump peaks at 142 px above the roof (`JUMP_V² / (2 × GRAVITY)`), and a jump held for one 1/120 s step peaks below 60 px.
  - Distance and score: `distancePx += speed × dt`; `score = floor(distancePx / 20)` (20 px = 1 m). The HUD `distance` equals the score.
  - Track: an endless list of rooftop slabs and gaps, generated ahead of the screen (at least 1,000 px beyond the right edge) and discarded behind. The first slab is 600 px long and empty, so the run starts with a free 600 px.
  - Challenges ("beats") are either a **gap** or an **obstacle**. Two beats are separated by a rest of at least `speed × REST_SEC` px with `REST_SEC = 0.85`, plus a random extra of 0 to `speed × 0.7` px, measured when the beat is generated.
  - Gap width = `speed × g` px with `g` uniform in `[0.18, 0.36]` s. Maximum safe width is below 55 % of the full-jump distance (`0.662 s × speed`), so every gap is crossable with a full jump at any speed.
  - Obstacles stand on a slab and are one of: `vent` (40 × 34 px) or `antenna` (22 × 72 px, needs a held jump), picked 60 % / 40 %. An obstacle is never within `speed × 0.5` px of a slab edge.
  - Death: the hitbox overlaps an obstacle, or the feet center is over a gap and the feet pass `GROUND_Y + 24`, or the runner leaves the bottom edge. Then `state = "gameover"` and `onGameOver(score)` fires once.
  - A run can never be won; it ends only by death.
- Controls: `Space`, `↑` or `W` jump (tap = hop, hold = full jump). No mouse. Touch, sound and gamepad are out of scope.
- Drawing (primitives only, yellow accent, no recolor per skin): dark navy sky with two parallax skyline layers (cyan and magenta window dots, 25 % and 50 % of the scroll speed); rooftop slabs with a yellow top edge; the runner as a yellow body with a cyan visor and two legs that alternate while running; a light trail of the last 14 runner positions fading from yellow to transparent; vents grey with a magenta glow, antennas grey with a blinking red tip. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: add the `runner` row to the Games table (spec number after promotion, `sort_order` 8, canvas notes, HUD distance (`number`)).

**Out of scope (for future specs):**

- Flying drones, ducking, collectible shards, background districts (spec `JAM-runner-02`).
- Power-ups, double jump, lives.
- Sound and music.
- Touch controls (done later by `@mobile-porter`), gamepad, mouse.
- Skins (done later by `@skin-designer`), bitmap sprites.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'runner'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'runner',
  'NEON RUNNER',
  'Corre por los tejados sin parar.',
  'Eres un mensajero que cruza los tejados de una ciudad de neón. Salta huecos y chimeneas, mantén la tecla para saltar más alto y recorre la mayor distancia posible antes de caer.',
  'ARCADE',
  'cover-runner',
  'yellow',
  8
);
```

`color` is one of `cyan`, `magenta`, `green`, `yellow`; `yellow` is the planner's pick (`asteroids` also uses it). `sort_order` 8 is the next free value for the jam: the table holds 1–5, `scramble` (jam) reserves 6 and `dragrush` (jam) reserves 7. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "distance", label: "Distancia", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { distance } }
```

```ts
// lib/games/runner/constants.ts
const W = 720, H = 360;
const GROUND_Y = 290;
const RUN_X = 140;
const RUN_W = 22, RUN_H = 40;
const PHYS_DT = 1 / 120;
const GRAVITY = 2600, JUMP_V = 860, CUT_V = 350;
const COYOTE = 0.08, JUMP_BUFFER = 0.1;
const SPEED_START = 300, SPEED_ADD = 5, SPEED_MAX = 720;
const PX_PER_M = 20;
const REST_SEC = 0.85;
const GAP_SEC_MIN = 0.18, GAP_SEC_MAX = 0.36;
const VENT = { w: 40, h: 34 }, ANTENNA = { w: 22, h: 72 };
const FIRST_SLAB = 600;
```

Conventions:

- Logic canvas is 720×360, units in pixels and seconds, `y` grows downward. The track is a list of slabs `{ x0, x1 }` in world px; obstacles hold `{ x, w, h }` on a slab.
- Generation is a pure function of the current speed and a random source, in `track.ts`, so the solvability rules can be checked on their own.
- Peak jump height with the cut: a key released at the first step of the jump gives about 24 px more of rise from `CUT_V`, which is why a tap stays below 60 px.
- The state `dead` is unused: the game goes from `playing` to `gameover` directly.

## Implementation plan

1. Create `lib/games/runner/constants.ts` with the constants above and the palette. Manual check: `npm run lint` passes.
2. Create `lib/games/runner/track.ts`: slab, gap and obstacle generation with the rest, gap-width and edge-margin rules. Manual check: `npx tsc --noEmit` passes; a temporary console run of 10,000 generated beats at speeds 300, 500 and 720 never gives a gap above `0.55 × 0.662 × speed` nor a rest below `0.85 × speed` (remove the log after).
3. Create `lib/games/runner/engine.ts`, first part: closure state (runner, track, speed, distance, score, state), fixed-step physics, jump with coyote, buffer and cut, collisions, death and the snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: key handling (`Space`, `↑`, `W`), `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (sky, skyline layers, slabs, runner, trail, obstacles), rAF loop with `dt` cap and accumulator, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/runner/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
7. Add `.cover-runner` to `app/globals.css`, designed with `/frontend-design`. Manual check: the class renders in a card preview with no layout change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `runner` row; `/biblioteca` shows the card with the `.cover-runner` art; `/juegos/runner/jugar` plays; the distance updates.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

The cover is new UI: `/spec-impl` must use `/frontend-design` for it. The shell is unchanged.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `runner` with title `NEON RUNNER`, the copy above, category `ARCADE`, cover `cover-runner`, color `yellow` and `sort_order` 8.
- [ ] `/juegos/runner/jugar` shows a 720×360 canvas; the runner stands on a 600 px empty slab, the HUD distance is 0 and the score is 0.
- [ ] The scroll speed is 300 px/s at the start, 305 px/s after 1 s, and stops growing at 720 px/s after 84 s.
- [ ] `Space`, `↑` and `W` each make the runner jump; holding for the whole rise reaches a peak of 142 px (±3 px) above the roof, and a one-frame tap reaches less than 60 px.
- [ ] A jump pressed up to 0.08 s after running off a slab edge still works; a press up to 0.10 s before landing triggers a jump on landing.
- [ ] Every generated gap is at most `0.55 × 0.662 × speed` px wide (at 300 px/s: 109 px; at 720 px/s: 262 px) and at least `0.18 × speed` px.
- [ ] Two consecutive beats are separated by at least `0.85 × speed` px.
- [ ] An antenna (22 × 72 px) can be cleared with a full-hold jump at speeds 300 px/s and 720 px/s; a vent (40 × 34 px) can be cleared with a hold of 0.1 s or more.
- [ ] Touching a vent or antenna ends the game; falling into a gap ends the game once the feet pass 24 px below the roof line.
- [ ] The score equals `floor(distance / 20)`: running 2,000 px gives score 100 and HUD distance 100.
- [ ] Death opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'runner'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=runner`, on `/juegos/runner` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/runner` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; pressing again resumes with no jump in position or speed.
- [ ] While the game is mounted, `Space` and `↑` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] Distance after 10 s of running is the same (±1 m) at 60 Hz and at 144 Hz.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets score, speed 300 px/s, the track and the trail; no duplicate loops run (speed after 1 s is still 305 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/runner/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with one key and two jump heights (tap and hold). **No:** a fixed-height jump: it is the dinosaur-runner formula and the brief asks for an original look.
- **Yes:** `id` `runner`, English slug, title `NEON RUNNER`.
- **Yes:** rooftop world with gaps and rooftop machinery, plus a light trail. **No:** desert, cacti, birds or any copy of a known runner.
- **Yes:** score is distance in metres (20 px per metre), an integer. **No:** time or points per obstacle: the brief and the HUD say distance.
- **Yes:** obstacle and gap generation limited by rest time and by 55 % of the full-jump distance, so every beat is solvable. **No:** pure random placement: unavoidable obstacles end runs unfairly.
- **Yes:** coyote time 0.08 s and jump buffer 0.10 s. **No:** strict ground-only input: it feels unresponsive in a game of one key.
- **Yes:** fixed physics step 1/120 s. **No:** per-frame integration: jump height would change with refresh rate.
- **Yes:** the speed ramp stops at 720 px/s. **No:** unbounded speed: beats would become unsolvable by reaction time.
- **Yes:** the run ends only by death, never by a win. **No:** a finish line: it is an endless runner.
- **Yes:** only the `distance` HUD field. **No:** lives or level: they do not exist.
- **Yes:** new cover `.cover-runner` designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games.
- **Yes:** color `yellow`, as requested in the brief.
- **Yes:** `sort_order` 8, re-checked on promotion (`scramble` reserves 6, `dragrush` reserves 7).
- **Yes:** primitives only, no assets. **No:** loading sprites: no SPEC 08 dependency.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Clone feel (the brief's main risk)                                        | Rooftop gaps, light trail, courier and tap / hold jump heights; no desert, dinosaur or cacti. `JAM-runner-02` adds drones, ducking and shards. |
| Generated beats become unsolvable at high speed                           | Rest of 0.85 s, gap width capped at 55 % of full-jump distance, speed capped at 720 px/s; step 2 checks 10,000 beats. |
| Jump height changes with refresh rate                                     | Fixed 1/120 s physics step; criterion compares 60 Hz and 144 Hz.                                                      |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts.            |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                     |
| Held jump key stuck after pause or blur                                   | Clear input on `setPaused`, on `window` blur and on `stop`.                                                          |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                               |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for NEON RUNNER (no touch controls yet); fixing it needs its own change.                 |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.               |

## What is **not** in this spec

- Flying drones, ducking, collectible shards and background districts.
- Power-ups, double jump, lives.
- Sound and music.
- Touch controls, gamepad and mouse.
- Skins and bitmap sprites.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
