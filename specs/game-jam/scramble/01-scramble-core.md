# SPEC JAM-scramble-01 — Amber Canyon game (AMBER CANYON) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-18
> **Objective:** Add AMBER CANYON as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/scramble/jugar`.

## Why this spec exists

There is no reference game folder. AMBER CANYON is a side-scrolling shooter written from scratch for the `scramble` pick in `references/game-suggestions-todo.md`. A scout skiff flies through an endless canyon on a dying planet: the walls are generated at run time, the skiff burns fuel for every pixel it travels, floating amber cells refuel it, and drones try to stop it. The id `scramble` is the pick's id and the URL slug; the title and the setting are original (no ship, enemy, level or name from an existing game). Everything is drawn with canvas primitives, so there are no assets.

The pick warned that the idea may exceed one spec. The core is therefore cut to: procedural canyon, one weapon, one enemy type, fuel cells and lives. Boost and ground turrets go in `JAM-scramble-02`. There is no authored level data.

This spec is a jam draft. It is not numbered yet; the migration timestamp and `sort_order` below are re-checked when it is promoted to `specs/NN-scramble-game.md`.

## Scope

**In:**

- Engine in `lib/games/scramble/` (`constants.ts`, `terrain.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure. `terrain.ts` holds the canyon generator and height queries.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: starfield, canyon walls, ship, shots, drones, fuel cells. Score, fuel, lives, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "scramble"`, logic size 640×400, HUD fields `fuel` and `lives`.
- Migration `supabase/migrations/20261118001100_add_scramble_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-scramble` in `app/globals.css`, designed with `/frontend-design`.
- World and scrolling:
  - Logic canvas 640×400, origin top-left, units in px and px/s. The world scrolls right to left at `scrollSpeed = min(SCROLL_MAX, SCROLL_BASE + SCROLL_GAIN × distance)` with `SCROLL_BASE = 120`, `SCROLL_GAIN = 0.02`, `SCROLL_MAX = 200`, where `distance` is the total px scrolled since the run started.
  - Canyon: floor and ceiling are stored per column of `TERRAIN_STEP = 8` px. `floorH` is in `[30, 120]` px from the bottom and `ceilH` in `[30, 100]` px from the top, so the open gap is at least `400 − 120 − 100 = 180` px. Each of the two edges is a sequence of segments of random length in `[200, 320]` px; each segment target is the previous target changed by at most 60 px and clamped to its range; between targets the height follows a cosine ease, so the steepest slope is about 0.47 (3.8 px per column). Columns are generated ahead of the right edge and dropped after they leave the left edge.
- Ship: box 36×14 px, starts at `(120, 200)`. Controls: `←` `→` `↑` `↓` or `A` `D` `W` `S` move at `SHIP_SPEED = 220` px/s (both axes, diagonal speed normalized), `Space` fires. Horizontal range is `[32, 320]`; the vertical range is the open gap. Touching the floor or ceiling kills the ship (checked at the ship's left, center and right x).
- Weapon: a pulse is a 12×3 px shot moving right at `SHOT_SPEED = 520` px/s on screen. At most `SHOT_MAX = 3` pulses on screen and `SHOT_COOLDOWN = 0.18` s between shots; holding `Space` repeats. A pulse is removed when it touches the canyon or leaves the screen. Shots cost no fuel.
- Fuel: `FUEL_MAX = 100`. Fuel is spent by distance: `FUEL_PER_PX = 0.025` per px scrolled (3.0 per second at the base scroll speed, 5.0 at the maximum). The HUD shows `floor(fuel)`. At 0 fuel the engine stalls: the controls stop working, the ship falls at `STALL_GRAVITY = 300` px/s² and the scroll continues, so it crashes into the canyon floor and loses a life.
- Fuel cells: a 24 px amber cell (radius `CELL_R = 12`) floats at a random y inside the open gap with a 24 px margin from both walls. The next cell spawns beyond the right edge every `min(900 + distance / 20, 1200) ± 150` px of scroll. Touching a cell with the ship adds `FUEL_CELL = 30` fuel (cap 100) and `CELL_POINTS = 50` points. A pulse that hits a cell destroys it with no fuel and no points. A cell that leaves the left edge is lost.
- Drones: a 24 px enemy (radius `DRONE_R = 12`) enters from the right every `400` to `700` px of scroll, moving left at `scrollSpeed + 60` px/s relative to the screen and bobbing ±40 px (sine, period 1.6 s) around a base y chosen inside the gap; its y is clamped to the gap at its current x with a 4 px margin. One pulse kills it: `DRONE_POINTS = 100`. Touching the ship kills the ship. Drones do not shoot in this spec.
- Distance score: the score gains `floor(distance / 10)` in total, that is 1 point per 10 px scrolled, added as the distance grows. Score is clamped to 10,000,000.
- Lives: 3 at start. A death (canyon, drone or crash after the stall) costs 1 life, freezes the world for `DEATH_S = 0.8` s with an explosion, then the ship respawns at `(120, y)` where `y` is the middle of the open gap at that x, with `INVULN_S = 1.5` s of invulnerability (blinking; canyon and drones do not kill it, and `y` is kept inside the gap). Fuel after a respawn is `max(fuel, FUEL_RESPAWN)` with `FUEL_RESPAWN = 60`. At 0 lives, `state = "gameover"` and `onGameOver(score)` fires once. There is no win state.
- `CLAUDE.md` update: the `games` table row for `scramble`.

**Out of scope (for future specs):**

- Boost, ground turrets and enemy shots (feature spec `JAM-scramble-02`).
- Bombs, bosses, power-ups, zones with different palettes, ground targets.
- Sound and music.
- Touch controls (the d-pad and A button mapping is a later `@mobile-porter` run), mouse, gamepad, skins (later `@skin-designer` run).
- Authored levels or a level select.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'scramble'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'scramble',
  'AMBER CANYON',
  'Vuela el cañón, dispara y no te quedes sin combustible.',
  'Pilota una nave a través de un cañón sin fin. Cada metro cuesta combustible: recoge las celdas ámbar, esquiva las paredes y derriba los drones que te cierran el paso. Tres vidas y una sola regla: no te detengas.',
  'SHOOTER',
  'cover-scramble',
  'yellow',
  8
);
```

The migration file name and `sort_order` 8 are the values reserved at the time of writing (last migration `20261116000800_add_frogger_game.sql`, `frogger` holds 5; the jam drafts `gems` and `climber` reserve 6 and 7). Both are re-checked when the spec is promoted; renumber if the drafts are promoted in a different order.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "fuel", label: "Combustible", format: "number", initial: 100 },
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { fuel, lives } }
```

```ts
// lib/games/scramble/constants.ts
const W = 640, H = 400;
const SCROLL_BASE = 120, SCROLL_GAIN = 0.02, SCROLL_MAX = 200;
const TERRAIN_STEP = 8, FLOOR_MIN = 30, FLOOR_MAX = 120, CEIL_MIN = 30, CEIL_MAX = 100;
const SEG_MIN = 200, SEG_MAX = 320, DELTA_MAX = 60;
const SHIP_W = 36, SHIP_H = 14, SHIP_SPEED = 220, SHIP_MIN_X = 32, SHIP_MAX_X = 320, SHIP_START_X = 120;
const SHOT_W = 12, SHOT_H = 3, SHOT_SPEED = 520, SHOT_MAX = 3, SHOT_COOLDOWN = 0.18;
const FUEL_MAX = 100, FUEL_PER_PX = 0.025, FUEL_CELL = 30, FUEL_RESPAWN = 60, STALL_GRAVITY = 300;
const CELL_R = 12, CELL_POINTS = 50, CELL_SPACING_BASE = 900, CELL_SPACING_MAX = 1200, CELL_SPACING_JITTER = 150;
const DRONE_R = 12, DRONE_POINTS = 100, DRONE_SPACING_MIN = 400, DRONE_SPACING_MAX = 700;
const DRONE_REL_SPEED = 60, DRONE_BOB = 40, DRONE_BOB_PERIOD = 1.6;
const LIVES = 3, DEATH_S = 0.8, INVULN_S = 1.5;
const MAX_SCORE = 10_000_000;
```

Conventions:

- Logic canvas is 640×400, origin top-left, units in pixels; time inside the engine is in seconds. All motion is `px/s × dt`, so it is frame-rate independent.
- The canyon has no seed: it is generated with `Math.random` inside `createEngine` for each run (never at module level).
- `fuel` is a float inside the engine; the snapshot holds `floor(fuel)`, so `onChange` fires about 3 to 5 times per second, not per frame.
- Break-even design: the fuel for the cell spacing is `FUEL_PER_PX × spacing`, which is 22.5 at 900 px and 30 at 1200 px; a cell gives 30. A player who takes every cell never starves; a player who misses cells drains the tank. State `dead` is unused: the game goes from `playing` to `gameover` directly.

## Implementation plan

1. Create `lib/games/scramble/constants.ts` with the constants above. Manual check: `npm run lint` passes.
2. Create `lib/games/scramble/terrain.ts` with the canyon generator (segments, cosine ease, ranges), column buffer (generate ahead, drop behind) and `floorYAt(x)` / `ceilYAt(x)` queries. Manual check: `npx tsc --noEmit` passes; a temporary console call generates 5000 px and confirms the gap is always at least 180 px and no column differs from its neighbor by more than 4 px (remove it before committing).
3. Create `lib/games/scramble/engine.ts`, first part: closure state, scrolling and distance, ship movement and canyon collision, lives, death, respawn with invulnerability, snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: fuel (distance cost, stall and crash), fuel cells (spawn spacing, pickup, shot destroys). Manual check: lint and tsc pass.
5. Extend `engine.ts`: pulses (cooldown, max 3, canyon hit) and drones (spawn, bob, clamp, kill, points). Manual check: lint and tsc pass.
6. Extend `engine.ts`: key handling (`preventDefault`, cleared on pause, blur and stop), draw (starfield, canyon, ship, shots, drones, cells, explosion, blink), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/scramble/jugar` is still the not-found page because the DB row does not exist yet; the other five games still play.
8. Add `.cover-scramble` to `app/globals.css`. Use `/frontend-design` (project rule for any UI). Manual check: it renders on `/biblioteca` after step 9.
9. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `scramble` row; `/biblioteca` shows the card with the `.cover-scramble` art; `/juegos/scramble/jugar` plays.
10. Update `CLAUDE.md` (Games table row).
11. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `scramble` with title `AMBER CANYON`, the copy above, category `SHOOTER`, cover `cover-scramble`, color `yellow` and `sort_order` 8 (or the value re-checked at promotion).
- [ ] `/juegos/scramble/jugar` shows a 640×400 canvas; the game starts with the ship at x 120, y 200, HUD score 0, fuel 100 and 3 hearts.
- [ ] The canyon scrolls right to left at 120 px/s at the start; at distance 4000 px and beyond the speed is 200 px/s.
- [ ] The open gap between the ceiling and the floor is never under 180 px over a full session.
- [ ] Arrows and `W` `A` `S` `D` move the ship at 220 px/s; diagonal speed is not faster than 220 px/s; the ship cannot go left of x 32 or right of x 320.
- [ ] Touching the floor or the ceiling costs exactly 1 life.
- [ ] `Space` fires a 12×3 px pulse at 520 px/s; no more than 3 pulses exist at once; two shots are at least 0.18 s apart; a pulse that touches the canyon disappears.
- [ ] The HUD fuel drops about 3 per second at the start and about 5 per second at the maximum scroll speed.
- [ ] Touching a fuel cell adds 30 to the HUD fuel (never above 100) and exactly 50 to the score; a pulse that hits a cell removes it with no fuel and no points.
- [ ] At fuel 0 the controls stop, the ship falls, and a crash into the canyon costs 1 life.
- [ ] A drone dies to one pulse and adds exactly 100 points; touching a drone costs 1 life.
- [ ] The distance adds 1 point per 10 px scrolled (1000 px adds 100 points).
- [ ] After a death the world freezes 0.8 s, the ship respawns at x 120 inside the gap, blinks and is immune for 1.5 s, and fuel is at least 60.
- [ ] Losing the last life opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'scramble'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=scramble`, on `/juegos/scramble` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/scramble` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list the new game; `/salon` has one more tab.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, the fuel and the distance; pressing again resumes with no jump.
- [ ] While the game is mounted, the arrow keys and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, canyon, distance, fuel, lives and score; no duplicate loops run (scroll speed stays 120 px/s at the start after 3 restarts).
- [ ] At 30 fps and at 144 fps the scroll covers the same distance per second (within 2%).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/scramble/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with a procedural canyon, one weapon and one enemy. **No:** authored stages, a base at the end, bombs and ground missiles: they recreate an existing game and exceed one spec.
- **Yes:** `id` `scramble` (the pick's id and URL), title `AMBER CANYON`. **No:** using the id as the title: the title carries the original setting.
- **Yes:** a procedural canyon with a minimum gap of 180 px and a maximum slope of about 0.47. **No:** unbounded random heights: some columns could be impassable.
- **Yes:** fuel spent per px scrolled and refilled by touching cells. **No:** refueling by shooting tanks on the ground: it needs ground targets and a bomb.
- **Yes:** cell spacing grows to 1200 px and then stays, so the fuel is break-even only if every cell is taken. **No:** an easy fuel curve: fuel is the main skill the pick asked for.
- **Yes:** the HUD shows `floor(fuel)` as `number`. **No:** a bar: the HUD formats are fixed and the shell is not changed.
- **Yes:** at 0 fuel the ship stalls and crashes. **No:** instant death: the player sees it coming and can still shoot.
- **Yes:** distance gives 1 point per 10 px plus kills and cells. **No:** points only for kills: it would reward standing still.
- **Yes:** respawn keeps at least 60 fuel and gives 1.5 s of immunity. **No:** respawn at full fuel: deaths would be free refuels.
- **Yes:** no win state; the run ends by lives. **No:** a final zone: out of scope.
- **Yes:** keyboard only (arrows or WASD, `Space`). **No:** mouse aim, touch, gamepad: out of scope.
- **Yes:** new `.cover-scramble`, designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-glot`: they belong to other pending picks.
- **Yes:** color `yellow` and category `SHOOTER` as the pick asked, although `asteroids` is also yellow SHOOTER. Flagged for review.
- **Yes:** `sort_order` 8, re-checked at promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks scroll speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                |
| May exceed one spec (pick's warning)                                      | Core cut to canyon, pulse, drones, cells and lives; boost and turrets go in `JAM-scramble-02`.                  |
| Canyon becomes impassable or too steep                                    | Ranges give a 180 px gap; segment delta capped at 60 px over at least 200 px; step 2 check confirms it.         |
| Fuel balance too harsh or too easy                                        | All values in `constants.ts`; check by hand that a player taking every cell never starves.                      |
| Drones spawn inside a wall                                                | Drone y is clamped to the gap at its current x every frame.                                                     |
| HUD fuel causes many re-renders                                           | The snapshot holds `floor(fuel)`: at most 5 changes per second.                                                 |
| Frame-rate-dependent motion                                               | All motion uses `px/s × dt` with the 0.05 s cap; criterion checks 30 and 144 fps.                               |
| Keys stuck after pause or blur                                            | Clear input on `setPaused`, on `window` blur and on `stop`.                                                     |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                          |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- Boost, ground turrets and enemy shots.
- Bombs, bosses, power-ups, zones and ground targets.
- Sound and music.
- Touch controls, mouse, gamepad and skins.
- Authored levels and level select.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
