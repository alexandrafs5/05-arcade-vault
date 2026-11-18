# SPEC JAM-scramble-01 — Space Scroller core game (SPACE SCROLLER) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-17
> **Objective:** Add SPACE SCROLLER as a real side-scrolling shooter with fuel management, with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/scramble/jugar`.

## Why this spec exists

There is no reference game folder and no fitting asset in `references/source-assets/`. SPACE SCROLLER is an original side-scrolling shooter written from scratch with primitive canvas shapes: a ship flies right over endless procedural terrain, shoots forward, drops bombs, and must destroy fuel tanks on the ground to keep its tank from running dry. It comes from the `@game-planner` suggestion `scramble` in `references/game-suggestions-todo.md` (SHOOTER, yellow, effort L, "may exceed one spec").

To fit one spec, the scope is cut to the core loop: one procedural terrain generator (open hills and caves), two ground objects (rockets and fuel tanks), two weapons (laser and bomb), fuel, lives and a sector speed ramp. Themed sector profiles, flying enemies, turrets and a final target are in `JAM-scramble-02`.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD, pause, game-over modal and score saving. A new game only adds files; the shell is not changed.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-scramble-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/scramble/` (`constants.ts`, `terrain.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: starfield, terrain, ground objects, rockets in flight, lasers, bombs, explosions, the ship and a 4 px sector-progress strip along the top edge. Score, fuel, lives, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "scramble"`, logic size 800×480, HUD fields `fuel` (`number`) and `lives` (`hearts`).
- Migration `supabase/migrations/20261117000000_add_scramble_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261116000800_add_frogger_game.sql`).
- New cover `.cover-scramble` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none fits a side-scroller and `.cover-invaders` / `.cover-duelo` are reserved for pending suggestions (`invaders`, `duelo`).
- No image assets. Everything is drawn with canvas primitives.
- Scores through the existing `saveScore` (`lib/session.tsx`) into `scores`. Nothing new in the shell. The game shows on `/salon?game=scramble`, `/juegos/scramble` (top 10), the home lists and the card stats with no extra code.
- Rules:
  - Logic canvas 800×480, origin top-left, units in pixels. The ship stays on screen; the world scrolls right to left.
  - **Scroll.** Base speed `SCROLL_SPEED = 120` px/s, multiplied by the sector multiplier `min(1.1^(sector − 1), 1.6)`. The scrolled distance `dist` (px, float) only grows while playing (not during the death freeze or pause).
  - **Sectors.** Each sector is `SECTOR_LEN = 4800` px of scroll. When `dist` passes `sector × 4800`, `sector + 1` and +1000 points. The game starts at sector 1. The sector number is internal (no HUD field in this spec); the top strip shows the progress inside the current sector.
  - **Terrain.** A list of columns of `COL_W = 16` px. Each column has `floor` (y of the ground top) and `ceil` (y of the ceiling bottom; `0` means open sky). `floor` follows a random walk of −12 to +12 px per column, clamped to `[300, 456]`. The generator alternates two segment kinds, each 60–100 columns long, picked at random: `open` (`ceil = 0`) and `cave` (`ceil` follows a random walk of −12 to +12 px per column, clamped to `[24, floor − gapMin]`). Entering a cave, `ceil` ramps from 0 in steps of 12 px per column until it reaches its first target; leaving a cave, it ramps back to 0 the same way. `gapMin = max(160 − 10 × (sector − 1), 110)`.
  - The first 50 columns (one screen) are flat open ground at `floor = 420` with no objects. Each new sector starts with 30 flat open columns with no objects (a breather).
  - **Ship.** Rectangle `SHIP_W = 32` × `SHIP_H = 16`, starts at `x = 96`, `y = 200`. Moves with `←` `↑` `→` `↓` and `A` `W` `D` `S` at `SHIP_SPEED = 220` px/s; a diagonal is normalised to the same speed. `x` is clamped to `[16, 368]`, `y` to `[0, 464]`. The hitbox is the ship rectangle inset 3 px on each side (26×10).
  - **Laser.** `Space` fires a horizontal bolt (12×3 px) from the ship nose at `LASER_SPEED = 560` px/s. Holding `Space` fires every `LASER_COOLDOWN = 0.18` s; key auto-repeat events are ignored (the engine tracks the held state). At most `LASER_MAX = 3` bolts on screen. A bolt is removed when it leaves the right edge, enters the terrain of its column (below `floor` or above a non-zero `ceil`) or hits an object.
  - **Bomb.** `X` drops a bomb (6×6 px) from the ship bottom centre with screen velocity `vx = +40` px/s, `vy = 0` and gravity `600` px/s². At most `BOMB_MAX = 2` bombs in the air; `BOMB_COOLDOWN = 0.4` s between drops. A bomb explodes when it touches the floor or ceiling of its column or an object; the blast destroys every object whose rectangle intersects a circle of `BOMB_RADIUS = 28` px around the impact point.
  - **Ground objects.** They sit on flat pads of 3 columns (48 px) that the generator inserts when it places an object. The gap to the next object is 10–22 columns at random. Kind: fuel tank 35 %, rocket 65 %; if 32 or more columns have passed since the last fuel tank, the next object placed is always a fuel tank. Objects move with the terrain.
    - **Fuel tank** (28×20): destroyed by one laser hit or a blast; +100 points and +30 fuel (capped at 100). Touching it kills the ship.
    - **Rocket** (10×24): each rocket gets `launches = true` with chance 0.6 when placed. A rocket with `launches = true` launches when its x minus the ship x is below `ROCKET_LAUNCH_DIST = 180` px and rises at `ROCKET_SPEED = 170` px/s; it is removed when it leaves the top edge or hits a non-zero `ceil`. A rocket with `launches = false` never leaves the ground. Destroyed by one laser hit or a blast: +50 points on the ground, +80 in flight. Touching it kills the ship.
  - **Fuel.** Starts at `FUEL_MAX = 100`. Drains `min(5 + 0.5 × (sector − 1), 8)` units per second while playing. The HUD value is `ceil(fuel)`. When fuel reaches 0 the ship dies.
  - **Distance points.** +10 points for every 80 px of `dist` (integer steps, 15 points per second at sector 1).
  - **Death.** Causes: ship hitbox overlaps the floor or a non-zero ceiling of any column it covers, touches a rocket or a fuel tank, or fuel reaches 0. At most one death per frame. On death: `lives − 1`, the world freezes for `DEATH_FREEZE = 0.8` s while an explosion of primitive particles plays.
  - **Respawn.** After the freeze, if lives remain: objects with screen x below 480 and all rockets in flight, lasers and bombs are removed; the ship is placed at `x = 96`, with its centre at the middle of the gap of the column under it (`(ceil + floor) / 2`, `ceil` taken as 0 in open sky); fuel is refilled to 100; the ship is invulnerable to objects for `INVULN = 2` s and blinks at 8 Hz. Terrain still kills during invulnerability. `dist`, `sector` and score are kept.
  - **Game over.** At 0 lives, `state = "gameover"` and `onGameOver(score)` fires once. There is no win state: the run is endless.
  - Score is clamped to 10,000,000 (the `scores` check constraint).
- Drawing (primitives only): background `#05051a` with 60 parallax stars moving at 0.3× scroll speed; terrain filled `#2a1a4a` with a 2 px `#f5ff00` edge on the floor top and the ceiling bottom; fuel tanks cyan with a `F` stripe; rockets white with a red tip and a flame while flying; laser yellow; bombs white; ship a cyan-white arrow with an orange engine flame that turns red when fuel ≤ 25; the progress strip yellow on dark. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: add the `scramble` row to the Games table.

**Out of scope (for future specs):**

- Sector profiles, flying enemies, turrets, enemy fire and the final target (`JAM-scramble-02`).
- A `sector` HUD field (`JAM-scramble-02`).
- Sound and music.
- Bitmap sprites.
- Skins (`classic` / `neon` / `retro`): run `@skin-designer scramble` afterwards.
- Mobile / touch mapping (A = `Space`, B = `X` fit the SPEC 10 pad): run `@mobile-porter scramble` afterwards.
- Mouse control, gamepad, multiplayer.
- Seeded or daily terrain, checkpoints that rewind the world.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'scramble'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'scramble',
  'SPACE SCROLLER',
  'Vuela entre cavernas, revienta depósitos y no te quedes sin combustible.',
  'Pilota una nave por un terreno que no deja de avanzar: colinas, cavernas y pasos estrechos. Dispara al frente, suelta bombas sobre los cohetes y revienta los depósitos para recargar combustible. Si el tanque llega a cero, te estrellas. Tres vidas y sectores cada vez más duros.',
  'SHOOTER',
  'cover-scramble',
  'yellow',
  6
);
```

`color` must be one of `cyan`, `magenta`, `green`, `yellow` (check constraint). Today: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. `yellow` is the planner's pick and matches the terrain edge. `sort_order` 6 is the next unique value (`asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4, `frogger` 5). Both the timestamp and `sort_order` are re-checked when the spec is promoted.

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
const W = 800,
  H = 480;
const COL_W = 16;
const SCROLL_SPEED = 120,
  SECTOR_LEN = 4800,
  SPEED_STEP = 1.1,
  SPEED_CAP = 1.6;
const SHIP_W = 32,
  SHIP_H = 16,
  SHIP_SPEED = 220;
const SHIP_MIN_X = 16,
  SHIP_MAX_X = 368,
  START_X = 96,
  START_Y = 200;
const START_LIVES = 3,
  DEATH_FREEZE = 0.8,
  INVULN = 2;
const FUEL_MAX = 100,
  FUEL_DRAIN = 5,
  FUEL_DRAIN_STEP = 0.5,
  FUEL_DRAIN_CAP = 8,
  FUEL_TANK = 30;
const LASER_SPEED = 560,
  LASER_MAX = 3,
  LASER_COOLDOWN = 0.18;
const BOMB_VX = 40,
  BOMB_GRAVITY = 600,
  BOMB_MAX = 2,
  BOMB_COOLDOWN = 0.4,
  BOMB_RADIUS = 28;
const ROCKET_W = 10,
  ROCKET_H = 24,
  ROCKET_SPEED = 170,
  ROCKET_LAUNCH_DIST = 180,
  ROCKET_LAUNCH_CHANCE = 0.6;
const TANK_W = 28,
  TANK_H = 20,
  TANK_CHANCE = 0.35,
  TANK_FORCE_COLS = 32;
const FLOOR_MIN = 300,
  FLOOR_MAX = 456,
  CEIL_MIN = 24,
  WALK_STEP = 12;
const GAP_MIN_START = 160,
  GAP_MIN_STEP = 10,
  GAP_MIN_FLOOR = 110;
const PTS_DIST = 10,
  DIST_STEP = 80,
  PTS_ROCKET_GROUND = 50,
  PTS_ROCKET_AIR = 80;
const PTS_TANK = 100,
  PTS_SECTOR = 1000,
  SCORE_CAP = 10_000_000;
```

```ts
// lib/games/scramble/terrain.ts
type Column = { floor: number; ceil: number }; // ceil 0 = open sky
type GroundObject = {
  kind: "tank" | "rocket";
  wx: number; // world x of the left edge, px
  y: number; // top, px (changes once a rocket launches)
  launches: boolean; // rockets only
  flying: boolean;
};
```

Conventions:

- Logic canvas is 800×480, units in pixels, speeds in px/s, time in seconds. Movement uses `dt`, so it does not depend on frame rate.
- Terrain and objects live in world x; screen x = `wx − dist`. The terrain keeps only the columns from 1 column left of the screen to 2 columns past the right edge; older columns are dropped.
- `Math.random` drives terrain and objects; each run is different. No seed.
- State `dead` is unused: the game goes from `playing` to `gameover`. The death freeze is an internal engine flag.
- `onChange` fires when `ceil(fuel)` changes (about 5 times per second), never per frame.

## Implementation plan

1. Create `lib/games/scramble/constants.ts` with the constants above and the colors. Manual check: `npm run lint` passes.
2. Create `lib/games/scramble/terrain.ts`: column generator (random walk, `open` / `cave` segments with ramps, `gapMin` per sector, flat start, sector breather), pad insertion and object placement (spacing, 35 % tanks, forced tank after 32 columns, 0.6 launch chance). Manual check: `npx tsc --noEmit` passes.
3. Create `lib/games/scramble/engine.ts`, first part: closure state (ship, terrain, objects, lasers, bombs, fuel, lives, sector, dist, score, state), `reset`, scroll with the sector multiplier, sector change and bonus, fuel drain, distance points, score cap, snapshot with `onChange` / `onGameOver`. Manual check: tsc passes.
4. Extend `engine.ts`: input (arrows and WASD held state, `Space` held for laser, `X` for bomb, auto-repeat ignored, `preventDefault` on arrows and `Space`, input cleared on pause, blur and stop), ship movement and clamps, laser and bomb spawn with limits and cooldowns. Manual check: lint and tsc pass.
5. Extend `engine.ts`: laser and bomb updates, rocket launch and flight, hits and blast, scoring per object, ship collisions (terrain, objects), fuel-out death, death freeze, respawn with invulnerability, game over. Manual check: lint and tsc pass.
6. Extend `engine.ts`: draw (stars, terrain, objects, shots, explosions, ship with blink and fuel flame color, progress strip), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/scramble/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
8. Add `.cover-scramble` to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview with no layout change to other covers.
9. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `scramble` row; `/biblioteca` shows the card with the new cover; `/juegos/scramble/jugar` plays; fuel, lives and score update.
10. Update `CLAUDE.md`.
11. Run `npm run lint`, `npx tsc --noEmit` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.
- [ ] `games` has a row `scramble` with title `SPACE SCROLLER`, the copy above, category `SHOOTER`, cover `cover-scramble`, color `yellow` and `sort_order` 6.
- [ ] `/juegos/scramble/jugar` shows an 800×480 canvas; the ship starts at x 96, y 200 over flat open ground; HUD score 0, fuel 100 and 3 hearts.
- [ ] The first 50 columns (800 px) have flat ground at y 420 and no objects.
- [ ] Arrows and WASD move the ship at 220 px/s; a diagonal moves at the same speed; the ship cannot leave x 16–368 or y 0–464.
- [ ] Holding `Space` fires one bolt every 0.18 s, never more than 3 on screen.
- [ ] `X` drops a bomb that falls in an arc; never more than 2 bombs in the air and never two drops within 0.4 s.
- [ ] Terrain scrolls at 120 px/s in sector 1; caves appear with a ceiling that ramps in and out, and the vertical gap in a cave is never below 160 px in sector 1.
- [ ] Every 4800 px of scroll the sector increases, +1000 points are added and the next 30 columns are flat and empty; scroll speed is ×1.1 per sector and stops growing at ×1.6.
- [ ] The cave gap minimum drops by 10 px per sector and never goes below 110 px.
- [ ] Distance adds exactly +10 points per 80 px scrolled.
- [ ] Destroying a fuel tank adds +100 points and +30 fuel, never above 100.
- [ ] Destroying a rocket on the ground adds +50; destroying it in flight adds +80.
- [ ] A bomb blast destroys every object within 28 px of the impact point, each counted once.
- [ ] A rocket with `launches = true` lifts off when the ship is within 180 px of it and rises at 170 px/s; a rocket with `launches = false` never leaves the ground.
- [ ] After 32 or more columns without a fuel tank, the next object placed is always a fuel tank.
- [ ] Fuel drains 5 per second in sector 1 (+0.5 per sector, never above 8); the HUD fuel shows the rounded-up integer.
- [ ] Touching the floor, a ceiling, a rocket or a fuel tank, or reaching 0 fuel, costs exactly one life and freezes the world for 0.8 s.
- [ ] After respawn the ship sits at x 96 in the middle of the gap, fuel is 100, objects with screen x below 480 are gone, and for 2 s the ship blinks and objects do not kill it; terrain still does.
- [ ] At 0 lives the game-over modal opens with the final score exactly once; the HUD shows 0 hearts.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'scramble'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=scramble`, on `/juegos/scramble` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/scramble` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list ASTEROIDS, TETRIS, ARKANOID, SNAKE, FROGGER and SPACE SCROLLER; `/salon` has six tabs.
- [ ] PAUSA, `P` and `Esc` freeze scroll, fuel drain, rockets, bombs and the invulnerability timer; pressing again resumes with no jump.
- [ ] While the game is mounted, `Space` and the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width the canvas fits with no horizontal scroll caused by the canvas.
- [ ] JUGAR DE NUEVO resets HUD, score, terrain, sector and fuel; no duplicate loops run (scroll speed stays 120 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] The five existing games still play exactly as before.
- [ ] No console errors on `/juegos/scramble/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with canvas primitives. **No:** bitmap sprites: there are no fitting assets in the repo.
- **Yes:** `id` `scramble`, the planner's id, English slug like the other games. Title `SPACE SCROLLER`, the planner's name. **No:** reusing the title of any existing commercial game.
- **Yes:** original rules from the genre (scrolling terrain, forward shot, bombs, fuel from ground tanks). **No:** copying the stages, enemies or look of a specific arcade game.
- **Yes:** cut to one spec: one procedural generator, rockets and fuel tanks only. **No:** flying enemies, turrets or a final target here: they are `JAM-scramble-02`.
- **Yes:** endless run, game over only by losing all lives. **No:** a win state: score chase needs an open ceiling.
- **Yes:** procedural terrain with `Math.random`. **No:** a fixed seed or daily seed: it needs its own fairness rules.
- **Yes:** keyboard only: arrows/WASD, `Space` laser, `X` bomb. Both buttons map to the SPEC 10 pad A and B later. **No:** mouse aim: it does not fit a side-scroller.
- **Yes:** fuel 100, drain 5/s, +30 per tank, a tank forced after 32 columns without one. A missed tank hurts but one missed tank is not fatal. **No:** fuel as a timer with no refill.
- **Yes:** fuel 0 kills the ship at once. **No:** a falling animation with no control: extra state for no gameplay.
- **Yes:** respawn in place with 2 s invulnerability to objects. **No:** rewinding the world to a checkpoint: it needs world snapshots.
- **Yes:** HUD fields `fuel` (`number`, 100) and `lives` (`hearts`, 3), as the planner listed. Score is shown by the shell. **No:** a `sector` field in this spec: the top strip shows progress, the field comes in `JAM-scramble-02`.
- **Yes:** a 4 px progress strip drawn in the canvas, like the Frogger timer bar. **No:** text banners on the canvas.
- **Yes:** new cover `.cover-scramble` designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games; `.cover-glot` shows a maze eater.
- **Yes:** color `yellow`, the planner's pick. Note: `asteroids` is also yellow and SHOOTER.
- **Yes:** `sort_order` 6 (next unique value), re-checked on promotion.
- **Yes:** score clamped to 10,000,000.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** skins and mobile come afterwards from `@skin-designer` and `@mobile-porter`. **No:** doing either in this spec.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                        | Mitigation                                                                                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops       | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks scroll speed after restarts.     |
| Canvas access during SSR or under `cacheComponents`                         | Engine is created only inside `useEffect` of a client component.                                                     |
| Held keys stuck after pause or blur (ship keeps moving, laser keeps firing) | Clear the held-key set on `setPaused`, on `window` blur and on `stop`.                                               |
| Procedural cave closes or becomes impossible                                | `ceil` is clamped to `floor − gapMin` per column, so the gap never drops under `gapMin`.                             |
| A fuel drought makes a run unwinnable by luck                               | A tank is forced after 32 columns; breathers have no objects but are short (30 columns, 4 s at base speed).          |
| Respawn inside a narrow cave kills the ship again at once                   | Respawn at the gap centre; nearby objects are cleared; if repeated deaths show up in testing, lengthen the breather. |
| Fast scroll makes a long frame skip through thin terrain                    | `dt` is capped at 0.05 s (max 9.6 px of scroll per frame at ×1.6, below `COL_W`).                                    |
| `onChange` too frequent because of fuel                                     | Report `ceil(fuel)`, an integer that changes about 5 times per second.                                               |
| Game over fired twice (engine and FIN)                                      | The shell ignores `onGameOver` when the modal is open.                                                               |
| HUD crowding on touch with two fields                                       | Same count as Asteroids and Frogger; `@mobile-porter` checks the touch layout afterwards.                            |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded   | Flag it if a claim is false for SPACE SCROLLER; fixing it needs its own change.                                      |
| Next.js 16 differs from training data                                       | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.               |

## What is **not** in this spec

- Sector profiles, flying enemies, turrets, enemy fire and the final target.
- A `sector` HUD field.
- Sound and music.
- Bitmap sprites and skins.
- Touch mapping (done later by `@mobile-porter`).
- Mouse control, gamepad and multiplayer.
- Seeded terrain and checkpoints.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
