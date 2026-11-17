# SPEC JAM-rana-01 — Road Crosser game (RANA) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-16
> **Objective:** Add ROAD CROSSER as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/rana/jugar`.

## Why this spec exists

There is no reference game folder. The game is an original lane-crossing arcade game written from scratch: a frog hops across a five-lane road, a safe median and a four-lane river of drifting logs to fill five bays at the top. It uses the genre's general rules (discrete hops, lanes with fixed speeds, drowning, a timer), with its own grid, lane tables, scoring and neon look. No licensed art, names, levels or music are used. It was picked from `references/game-suggestions-todo.md` (entry `rana`, suggested 2026-11-16).

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This game needs no assets: everything is vector drawing, so `SPEC 08` is not a dependency. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

The unused cover `.cover-rana` already exists in `app/globals.css` (green frog dot over cyan lane stripes). The old mock row `ranaria` that used it was deleted in migration `20261116000200_remove_mock_games.sql`, so no catalog row uses it today.

This is a jam spec, not numbered yet. When it is promoted to `specs/NN-rana-game.md`, the migration file name and the `sort_order` below are re-checked against `supabase/migrations/` and the `games` table.

## Scope

**In:**

- Engine in `lib/games/rana/` (`constants.ts`, `lanes.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: lanes, vehicles, logs, bays, frog. Score, lives, level, time, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "rana"`, logic size 520×480, HUD fields `lives`, `level`, `time`.
- Migration `supabase/migrations/20261116000800_add_rana_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-rana` (`app/globals.css`). No new cover CSS.
- No assets: all drawing uses canvas paths and rectangles. Nothing is added under `public/games/`.
- Grid and rows (origin top-left, row 0 at the top):
  - 13 columns × 12 rows, `CELL = 40` px, logic canvas 520×480. Cell `(col, row)` draws at `(col × 40, row × 40)`.
  - Row 0: goal row, five bays at cols 1, 3, 6, 9 and 11; every other cell of the row is a hedge (deadly).
  - Rows 1–4: river, four lanes of logs. Water is deadly; a log is the only safe thing.
  - Row 5: median, safe.
  - Rows 6–10: road, five lanes of vehicles. Vehicles are deadly.
  - Row 11: start strip, safe.
- Frog:
  - Spawns at col 6, row 11. Position is `{ x, row }`, `x` is a float column (left edge of its cell), `row` is an integer.
  - One key press is one hop of 1 cell: `←` `A` left, `→` `D` right, `↑` `W` up, `↓` `S` down. Key repeat (`event.repeat`) is ignored, so holding a key does one hop.
  - The logic position changes instantly on the key press; the drawn frog tweens to it over `HOP_MS = 80` ms (visual only).
  - A vertical hop snaps `x` to the nearest integer column (`Math.round`). A horizontal hop adds or subtracts exactly 1 to `x`.
  - A hop that would put `x` below 0 or above `COLS - 1`, or `row` below 0 or above 11, is ignored.
  - Frog hitbox: horizontal span `[x + 0.2, x + 0.8]` in column units; the frog is always on one row.
- Lanes (`lanes.ts`): vehicles and logs move continuously in cells per second, wrap around a ring, and are placed by a deterministic formula (no random numbers). See Data model for the table.
- Road: each frame, if the frog is on a road row and its hitbox overlaps any vehicle box in that lane, the frog dies. A vehicle box is its span `[ox + 0.1, ox + width - 0.1]`.
- River: each frame, if the frog is on a river row, the frog is safe only if its center `x + 0.5` lies inside a log span `[ox, ox + width]` of that lane; then `x` changes by `dir × speed × speedMult × dt` (the log carries it). Otherwise the frog drowns. If the center leaves `[0, COLS]` the frog dies (carried off screen).
- Goal row: a hop to row 0 lands in column `Math.round(x)`. If that column is an empty bay, the bay fills and the frog respawns. If it is a hedge or an already filled bay, the frog dies.
- Timer: each frog has `FROG_TIME = 30` s. At 0 the frog dies.
- Lives: 3. A death costs 1 life. Lives reach 0 → `state = "gameover"` and `onGameOver(score)` fires once.
- Death animation: `state = "dead"` for `DEATH_MS = 600` ms (frog flashes, input ignored, timer stopped, lanes keep moving), then the frog respawns at col 6, row 11 with a full timer, or the game ends if no lives remain.
- Levels: filling the 5th bay clears the level: bays reset, `level` +1, lanes speed up. The game is endless; it ends only by losing all lives.
- Speed: `speedMult = min(1 + 0.12 × (level - 1), 2.2)`. Lane speed in cells/s = base speed × `speedMult`. Level 1 is ×1.0, level 4 is ×1.36, level 11 and above is ×2.2.
- Scoring (every value is an integer):
  - First time the frog reaches a row nearer the top than any row it reached during this frog's life: +10. A frog starts with `bestRow = 11`. Going back down and up again scores nothing until a new best row is passed. Reaching row 0 into a bay also gives this +10.
  - Filling a bay: +50, plus a time bonus of `10 × Math.floor(timeLeft)`.
  - Clearing a level (5th bay): +1000.
  - A frog's maximum is 11 × 10 + 50 + 10 × 29 = 450 points, plus 1000 per level, so a score above 10,000,000 is not reachable in practice. The engine still clamps `score` to 10,000,000.
- `CLAUDE.md` update: the `games` table (`rana`, new row) and the project intro count.

**Out of scope (for future specs):**

- Sinking platforms, bay bonus items, rare fast vehicles and extra lives (JAM-rana-02).
- Sprites, spritesheets and image assets.
- Sound and music.
- Touch or swipe controls, on-screen d-pad, mouse, gamepad.
- Multiplayer or two-frog modes.
- Neon recolor options, themes, difficulty selector.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'rana'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'rana',
  'ROAD CROSSER',
  'Cruza la autopista y el río sin ser aplastada.',
  'Salta de carril en carril esquivando coches y camiones, y cruza el río saltando de tronco en tronco. Llena las cinco bahías antes de que se acabe el tiempo. Cada nivel acelera el tráfico.',
  'ARCADE',
  'cover-rana',
  'green',
  5
);
```

`sort_order` 5 is the next unique value at the time of writing: `asteroids` holds 1, `tetris` 2, `arkanoid` 3 and `snake` 4. Re-check it, and the migration timestamp (later than `20261116000700`), when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "level", label: "Nivel", format: "pad2", initial: 1 },
  { key: "time", label: "Tiempo", format: "number", initial: 30 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "dead" | "gameover", hud: { lives, level, time } }
```

`hud.time` is `Math.ceil(timeLeft)`, from 30 down to 1, so the snapshot changes once per second, not per frame.

```ts
// lib/games/rana/constants.ts
const COLS = 13,
  ROWS = 12,
  CELL = 40;
const W = COLS * CELL; // 520
const H = ROWS * CELL; // 480
const START_COL = 6,
  START_ROW = 11;
const BAY_COLS = [1, 3, 6, 9, 11];
const LIVES = 3;
const FROG_TIME = 30; // seconds per frog
const HOP_MS = 80; // visual tween only
const DEATH_MS = 600;
const FROG_HIT = { from: 0.2, to: 0.8 }; // hitbox inside its cell, in columns
const VEHICLE_INSET = 0.1; // columns trimmed from each side of a vehicle box
const SPEED_STEP = 0.12,
  SPEED_MAX = 2.2;
const SCORE_ROW = 10,
  SCORE_BAY = 50,
  SCORE_SECOND = 10,
  SCORE_LEVEL = 1000;
const SCORE_MAX = 10_000_000;
const RING = 18,
  RING_START = -4; // lane ring in columns: x in [-4, 14)
```

```ts
// lib/games/rana/lanes.ts
type LaneKind = "car" | "truck" | "log";
type Lane = {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  speed: number;
  width: number;
  count: number;
  offset: number;
};

const LANES: Lane[] = [
  { row: 10, kind: "car", dir: 1, speed: 2.0, width: 1, count: 3, offset: 0 },
  { row: 9, kind: "car", dir: -1, speed: 3.0, width: 1, count: 3, offset: 2 },
  { row: 8, kind: "truck", dir: 1, speed: 1.5, width: 2, count: 3, offset: 1 },
  { row: 7, kind: "car", dir: -1, speed: 2.5, width: 1, count: 4, offset: 3 },
  { row: 6, kind: "car", dir: 1, speed: 3.5, width: 1, count: 3, offset: 4 },
  { row: 4, kind: "log", dir: -1, speed: 1.5, width: 3, count: 3, offset: 0 },
  { row: 3, kind: "log", dir: 1, speed: 2.0, width: 2, count: 4, offset: 1 },
  { row: 2, kind: "log", dir: -1, speed: 2.5, width: 4, count: 3, offset: 2 },
  { row: 1, kind: "log", dir: 1, speed: 1.8, width: 3, count: 3, offset: 3 },
];
```

Conventions:

- Logic canvas is 520×480, units in pixels for drawing and in columns / rows for game logic. Time inside the engine is in seconds.
- Object `i` of a lane has `ox = RING_START + mod(offset + i × RING / count + dir × speed × speedMult × laneTime, RING)`, where `laneTime` is total playing seconds of the current game (it keeps running during the death animation and is not reset between frogs, so lane positions never jump). `mod` returns a non-negative result.
- Lane gaps stay positive for every lane: the smallest gap is `RING / count - width` = 2.0 columns (row 2), so a hop always has a safe landing somewhere.
- `RING` is 18 columns and `RING_START` is -4: objects appear and disappear outside the 0–13 visible columns, because the widest object is 4 columns.
- Movement is per second, not per frame: no frame-rate dependence. A frog carried by a log keeps the fractional `x`.
- `bestRow` is per frog (reset to 11 on respawn); `filledBays` is per level (reset on level clear and on `restart`).

## Implementation plan

1. Create `lib/games/rana/constants.ts` with the constants above, the lane colors (neon: cars `#ff2bd6` and `#00f5ff`, truck `#ffd400`, logs `#8a5a2b` with a lighter top edge, road `#14142a`, river `#06344a`, median and start `#0f2a1a`, frog `#00ff88`) and the key maps. Manual check: `npm run lint` passes.
2. Create `lib/games/rana/lanes.ts` with the `Lane` type, the `LANES` table and two helpers, `laneObjects(lane, laneTime, speedMult)` (returns the `ox` list) and `laneAt(row)`. Manual check: `npx tsc --noEmit` passes.
3. Create `lib/games/rana/engine.ts`, first part: closure state (frog, `bestRow`, `timeLeft`, `filledBays`, `lives`, `level`, `score`, `laneTime`, `state`), `reset`, `respawn`, the hop with its bounds rules, scoring and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
4. Extend `engine.ts`: `update(dt)` with lane time, road collision, river carry and drowning, off-screen check, goal-row landing, timer, death, death animation, respawn, level clear and the speed multiplier. Manual check: lint and tsc pass.
5. Extend `engine.ts`: key handling (arrows and WASD, `event.repeat` ignored), `preventDefault` on arrows and `Space`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
6. Extend `engine.ts`: draw (lanes, vehicles, logs, bays and filled bays, frog with the 80 ms hop tween, death flash), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/rana/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS, ARKANOID and SNAKE still play.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `rana` row; `/biblioteca` shows the card with the `.cover-rana` art; `/juegos/rana/jugar` plays; score, lives, level and time update.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

No UI is designed or created in this spec (the cover is reused, the new HUD field uses the existing `number` format and the shell is unchanged), so `/frontend-design` is not required. If `/spec-impl` finds the 520×480 canvas needs shell CSS changes, or the cover needs rework, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `rana` with title `ROAD CROSSER`, the copy above, category `ARCADE`, cover `cover-rana`, color `green` and `sort_order` 5 (or the next free value at promotion).
- [ ] `/juegos/rana/jugar` shows a 520×480 canvas; the game starts with the frog at col 6, row 11, HUD score 0, lives 3, level 01 and time 30.
- [ ] `←` `↑` `→` `↓` and `A` `W` `D` `S` hop the frog exactly 1 cell; holding a key does one hop only.
- [ ] A hop that would leave the board (left of col 0, right of col 12, above row 0, below row 11) is ignored.
- [ ] A vertical hop from a log snaps the frog to the nearest integer column.
- [ ] Rows 10, 9, 8, 7 and 6 carry vehicles moving at 2.0, 3.0, 1.5, 2.5 and 3.5 cells/s at level 1, with directions right, left, right, left, right.
- [ ] Touching any vehicle on a road row costs exactly 1 life.
- [ ] Standing on a river row outside every log (row 1, 2, 3 or 4) costs exactly 1 life.
- [ ] Standing on a log carries the frog at the log speed (row 4: 1.5 cells/s left at level 1).
- [ ] Being carried until the frog center is below column 0 or above column 13 costs 1 life.
- [ ] The first hop into each new best row adds exactly 10 points; hopping back and forth between two rows adds nothing after the first time.
- [ ] Filling a bay adds 50 plus `10 × floor(timeLeft)` points (a bay filled with 20.4 s left adds 50 + 200 + the 10 row points).
- [ ] Hopping into a hedge cell of row 0 or into a filled bay costs 1 life and does not add the bay points.
- [ ] After a bay is filled the frog respawns at col 6, row 11 with `time` 30 and the filled bay stays drawn as filled.
- [ ] Filling the 5th bay adds 1000 points, raises `level` by 1 (HUD `02`), empties all bays and multiplies lane speeds by 1.12.
- [ ] At level 4 lane speeds are ×1.36; at level 11 and above they are ×2.2 and do not grow further.
- [ ] `time` counts down once per second from 30; at 0 the frog dies and loses 1 life.
- [ ] During the 600 ms death animation `state` is `dead`, key presses do nothing and the timer does not run; then the frog respawns with a full timer.
- [ ] Losing the 3rd life opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'rana'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=rana`, on `/juegos/rana` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/rana` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list ASTEROIDS, TETRIS, ARKANOID, SNAKE and ROAD CROSSER; `/salon` has five tabs.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, the lanes and the timer; pressing again resumes with no jump (time and lane positions advance 0 s on the first frame).
- [ ] While the game is mounted, the arrow keys and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD (lives 3, level 01, time 30), score, bays and lane positions; no duplicate loops run (lane speed stays at 2.0 cells/s in row 10 after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` and `/juegos/snake/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/rana/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch as an original lane-crossing game with its own grid, lane table, scoring and neon look. **No:** copying the layout, levels, art or names of an existing game.
- **Yes:** `id` `rana`, English-or-Spanish short slug already reserved by the unused `.cover-rana` and the planner entry; title `ROAD CROSSER`. **No:** a longer slug, because it becomes the URL.
- **Yes:** road and river in the same core spec. The river is what makes the crossing a game; a road-only version would be too easy. **No:** splitting the river into a feature spec: the core must be playable end to end.
- **Yes:** 13×12 cells of 40 px (520×480). Fits the shell with a small canvas and gives five road lanes, four river lanes and the safe rows. **No:** a larger board: more lanes would need more tuning for no extra mechanic.
- **Yes:** hops are discrete and the logic moves instantly; the 80 ms tween is only drawn. **No:** locking input during the tween: it feels slow and adds a state.
- **Yes:** ignore `event.repeat`. A held key must not run the frog into traffic. **No:** auto-repeat hops.
- **Yes:** vertical hops snap `x` to the nearest column, horizontal hops add exactly 1. This keeps the frog aligned on the road and lets the player step between logs. **No:** free horizontal movement.
- **Yes:** deterministic lane layout from a formula (no random numbers). Levels are reproducible and a bug can be replayed. **No:** random spawning: it can create impossible gaps.
- **Yes:** lane gaps are always at least 2.0 columns. **No:** denser traffic in the core.
- **Yes:** endless game that ends only when lives reach 0. **No:** a win state: the leaderboard rewards going further.
- **Yes:** scoring is integer only: 10 per new best row, 50 per bay, 10 per whole second left, 1000 per level. A frog is worth at most 450. **No:** fractional time bonus or per-frame points.
- **Yes:** clamp `score` to 10,000,000 in the engine. It is unreachable in practice but keeps the database check satisfied. **No:** trusting the maximum by arithmetic only.
- **Yes:** no points for hopping back down and no penalty for dying. **No:** negative scores: `scores.score` must stay between 0 and 10,000,000.
- **Yes:** HUD fields `lives` (`hearts`, 3), `level` (`pad2`, 1) and `time` (`number`, 30). The time limit is a core rule and the canvas must not draw a HUD, so it needs a field. **No:** a timer bar drawn in the canvas; **No:** a new HUD format (`number` is enough).
- **Yes:** `hud.time` is `ceil(timeLeft)`, so it changes once per second. **No:** sending the float every frame.
- **Yes:** `state = "dead"` during the 600 ms death animation, like ASTEROIDS. The shell only reacts to `gameover`. **No:** a new state.
- **Yes:** lanes keep moving during the death animation and the lane clock is never reset between frogs. **No:** freezing or resetting lanes on respawn: positions would jump.
- **Yes:** speed grows 12% of the base per level and stops at ×2.2. **No:** unbounded speed: level 20 would be impossible to read.
- **Yes:** no extra life in the core. **No:** a score-based life: it goes in JAM-rana-02.
- **Yes:** vector drawing, no assets. **No:** sprites: not needed and no theme-fitting asset exists in `references/source-assets/`.
- **Yes:** reuse `.cover-rana` (exists, unused, green frog dot over cyan stripes). **No:** a new cover.
- **Yes:** color `green`, matching the cover. It is shared with `snake`; `cyan`, `magenta` and `yellow` are used once each and are not a better match for the cover. **No:** recoloring the cover.
- **Yes:** category `ARCADE`, as the user chose. **No:** another category.
- **Yes:** `sort_order` 5 (next unique value), re-checked at promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks lane speed after restarts.     |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                   |
| `keys` or held hop stuck after pause or blur                              | Clear input on `setPaused`, on `window` blur and on `stop`; hops are one-shot on `keydown`.                        |
| Frog snapped onto the wrong log edge after a vertical hop                 | Snap happens before the river check; the center test uses `x + 0.5` against the log span.                          |
| Frog carried off screen without dying                                     | Explicit check of the center against `[0, COLS]` every frame in river rows.                                        |
| Fractional `x` makes a bay landing feel unfair                            | Landing column is `Math.round(x)`: any center within half a cell of a bay counts; tune only if playtests differ.   |
| Level 11+ speeds make lanes unreadable                                    | `SPEED_MAX = 2.2` caps the multiplier; row 3 at ×2.2 is 4.4 cells/s, still with a 2.5 column gap.                  |
| Lane positions jump on respawn, pause or restart                          | One lane clock (`laneTime`), advanced by capped `dt`; reset only in `restart`; first frame after resume uses 0.    |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                             |
| New HUD field `time` changes the player layout width                      | It uses the existing `number` format; check `/juegos/rana/jugar` at 375 px; fix with `/frontend-design` if needed. |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for ROAD CROSSER (no touch controls); fixing it needs its own change.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.             |

## What is **not** in this spec

- Sinking platforms, bay bonus items, rare fast vehicles and extra lives (JAM-rana-02).
- Sprites and image assets.
- Sound and music.
- Touch or swipe controls, on-screen d-pad, mouse and gamepad.
- Multiplayer or two-frog modes.
- Themes, difficulty selector and neon recolor options.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
