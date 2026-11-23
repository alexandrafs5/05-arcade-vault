# SPEC JAM-climber-01 — Cave Climber game (CLIMBER) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-23
> **Objective:** Add CLIMBER as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/climber/jugar`.

## Why this spec exists

There is no reference game folder and `references/started-games/` and `references/source-assets/` are empty. The game is a single-screen cave-climbing platformer written from scratch. The brief in `references/game-suggestions-todo.md` (`climber`, ARCADE, green, effort M) warns that it is the largest ARCADE candidate and needs level data. To fit one core spec the scope is shrunk hard: one screen per level, one tile grid, one player move set (walk, jump, climb), only two hazards (spikes and patrolling bats), no scrolling and no enemy AI. Three hand-built levels loop forever with growing difficulty, which gives an endless score chase with a small amount of data. Extra hazards and more levels are `JAM-climber-02`.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-climber-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/`, the live `games` table and the other jam specs (`scramble` holds 6 in its draft; `JAM-dragrush-01` uses 7; `JAM-bubbles-01` uses 9).

The engine is written directly into the `createEngine` contract (SPEC 05): state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal. No assets are loaded (primitives only), so SPEC 08 is not a dependency.

## Scope

**In:**

- Engine in `lib/games/climber/` (`constants.ts`, `levels.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- Physics runs in fixed sub-steps of 1/120 s (at most 6 per frame) so jump height and distance do not depend on the display refresh rate.
- The canvas draws only the world: tiles, ladders, crystals, spikes, bats, the exit, the player (primitives) and a thin time bar along the ceiling row (`y 0..8`). Score, lives, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "climber"`, logic size 640×512, HUD fields `lives` and `level`.
- Migration `supabase/migrations/20261119000100_add_climber_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. Timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-climber` in `app/globals.css`, designed with `/frontend-design`. The covers unused today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows a cave, and `.cover-invaders` and `.cover-duelo` are reserved for pending suggestions.
- Level data in `lib/games/climber/levels.ts`: three levels as 20×16 ASCII grids (see Data model). The engine uses level `((n − 1) mod 3) + 1` for level number `n`.
- Rules:
  - Grid 20 columns × 16 rows, `TILE = 32` px, logic canvas 640×512. Origin top-left; tile `(col, row)` draws at `(col × 32, row × 32)`.
  - The player is a 20×28 px box. It spawns standing on the floor of the `S` tile with its horizontal center on the tile center.
  - Keys: `←` `→` (or `A` `D`) walk at 150 px/s. `Space` jumps with initial speed 480 px/s up (apex 76.8 px, about 2.4 tiles). `↑` `↓` (or `W` `S`) climb ladders at 110 px/s. Gravity 1500 px/s², max fall speed 700 px/s. Coyote time 0.08 s and jump buffer 0.10 s.
  - Tiles: `#` solid, `H` ladder, `*` crystal, `^` spikes, `S` player start, `E` exit, `.` empty. Bats come from the level's `bats` list.
  - Ladders: pressing `↑` or `↓` while the player's center is within 12 px of a ladder column and the player overlaps a ladder cell grabs the ladder: the player snaps to the column center, gravity is off and `←` `→` `Space` are ignored. Climbing up past the top of the ladder's top cell stands the player on that cell's top edge. A ladder top (a ladder cell with no ladder cell above) is a one-way floor: solid from above unless `↓` is pressed while centered on it. Climbing down onto a solid tile releases the ladder.
  - Crystals: 5 per level. Touching one adds 100 points and removes it. Collected crystals stay collected after a death.
  - Exit: closed (drawn dim) until all 5 crystals are collected; then touching it completes the level: `+500 + 10 × ceil(timeLeft)` points.
  - Time: each level has `timeLimit = max(30, 60 − 5 × loop)` seconds where `loop = floor((n − 1) / 3)`. The time bar shows what is left. Time at 0 costs a life.
  - Hazards: spikes (the lower 16 px of the tile) and bats (24×14 px boxes) kill on overlap. A fall of 192 px (6 tiles) or more without touching a ladder kills on landing. Bats patrol their row between `col − range` and `col + range` (tile centers) at `60 × min(2.0, 1 + 0.15 × loop)` px/s, ping-pong. Bats ignore tiles. A bat flies on the floor line of its row (box `y = row × 32 + 18`), so a jump clears it.
  - Death: the player freezes 0.8 s, `lives −1`, then respawns at `S` with the timer reset. Collected crystals stay collected. With `lives = 0` the state becomes `gameover` and `onGameOver(score)` fires once.
  - Start: 3 lives, level 1, score 0. Completing level 99 ends the game as a win (`gameover`, no bonus). Score is clamped to 10,000,000.
- `CLAUDE.md` update: the `games` rows (adds `climber`).

**Out of scope (for future specs):**

- Falling stalactites, crumbling ledges and levels 4 to 5: `JAM-climber-02`.
- Scrolling levels, level editor, moving platforms, enemy AI beyond patrol.
- Sound and music.
- Touch controls, on-screen d-pad mapping, gamepad.
- Skins (`classic`, `neon`, `retro`): owned by `@skin-designer` after the game lands.
- Extra lives from score.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'climber'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'climber',
  'CAVE CLIMBER',
  'Sube la cueva, recoge cristales y llega a la salida.',
  'Trepa por escaleras, salta huecos y esquiva murciélagos y pinchos. Recoge todos los cristales para abrir la salida antes de que se acabe el tiempo. Pierdes una vida con cada golpe o caída.',
  'ARCADE',
  'cover-climber',
  'green',
  8
);
```

`color` is `green` as requested by the brief (a CHECK allows `cyan`, `magenta`, `green`, `yellow`). `sort_order` 8 is the next free value after `JAM-dragrush-01` (7); live games use 1 to 5 and the `scramble` draft reserves 6. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "level", label: "Nivel", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "dead" | "gameover", hud: { lives, level } }
```

```ts
// lib/games/climber/constants.ts
const COLS = 20, ROWS = 16, TILE = 32;
const W = COLS * TILE; // 640
const H = ROWS * TILE; // 512
const SUBSTEP = 1 / 120;
const PLAYER_W = 20, PLAYER_H = 28;
const WALK = 150, CLIMB = 110, GRAVITY = 1500, JUMP_V = 480, MAX_FALL = 700;
const COYOTE_S = 0.08, JUMP_BUFFER_S = 0.1, LADDER_SNAP = 12;
const FALL_DEATH_PX = 192;
const BAT_W = 24, BAT_H = 14, BAT_SPEED = 60, BAT_SPEED_MAX_MUL = 2.0, BAT_SPEED_STEP = 0.15;
const SPIKE_H = 16;
const CRYSTAL_POINTS = 100, LEVEL_POINTS = 500, TIME_POINTS_PER_S = 10;
const TIME_BASE = 60, TIME_STEP = 5, TIME_MIN = 30;
const DEATH_FREEZE_S = 0.8, LEVELS_COUNT = 3, LAST_LEVEL = 99, SCORE_MAX = 10_000_000;
```

```ts
// lib/games/climber/levels.ts
type Bat = { col: number; row: number; range: number };
type Level = { rows: string[]; bats: Bat[] }; // rows.length === 16, each row.length === 20
```

Level 1 (`rows`, top to bottom; `E` row 1 col 16, `S` row 14 col 2, crystals at (1,8), (4,10), (7,9), (10,10), (14,9) as `row,col`; bats: `{ col: 9, row: 7, range: 4 }`):

```text
####################
#.......*.......E..#
##H#################
#.H................#
#.H.......*........#
#################H##
#................H.#
#........*.......H.#
##H#################
#.H................#
#.H.......*..^.....#
#################H##
#................H.#
#................H.#
#.S......*..^^...H.#
####################
```

Level 2 (`E` row 1 col 3, `S` row 14 col 2; crystals at (1,13), (1,17), (7,8), (10,3), (14,10); bats: `{ col: 11, row: 10, range: 3 }`, `{ col: 8, row: 4, range: 3 }`):

```text
####################
#..E.........*...*.#
########..#######H##
#................H.#
#................H.#
##H########..#######
#.H................#
#.H.....*..........#
######..#######H####
#..............H...#
#..*...^.......H...#
####H####..#########
#...H..............#
#...H..............#
#.S.H.....*...^^...#
####################
```

Level 3 (`E` row 1 col 3, `S` row 14 col 8; crystals at (1,7), (1,17), (4,9), (10,5), (14,11); bats: `{ col: 9, row: 4, range: 4 }`, `{ col: 11, row: 7, range: 3 }`):

```text
####################
#..E...*.........*.#
######..#########H##
#................H.#
#........*.......H.#
###H######..########
#..H...............#
#..H.....^.........#
#####..##########H##
#................H.#
#....*.......^...H.#
##H######..#########
#.H................#
#.H................#
#.H.....S..*...^^..#
####################
```

Conventions:

- Logic canvas is 640×512, units in pixels. Physics time is in seconds. Every ledge-to-ledge step in the three levels needs at most a 2-tile gap or a ladder; a jump covers 96 px horizontally, so no level needs more than 84 px (2 tiles plus the player width).
- The level number in the HUD is the running level `n` (1 to 99); the layout is `LEVELS[(n − 1) % 3]`.
- State `dead` is active during the 0.8 s death freeze, then returns to `playing`.
- A ladder column is the set of `H` cells in one column; the engine derives ladder tops from the grid, they are not stored.

## Implementation plan

1. Create `lib/games/climber/constants.ts` with the block above and the colors used by the drawing. Manual check: `npm run lint` passes.
2. Create `lib/games/climber/levels.ts` with the three levels and their bats. Manual check: a temporary log shows every `rows` entry has 16 strings of length 20 and each level has exactly one `S`, one `E` and 5 `*`; remove the log; lint passes.
3. Create `lib/games/climber/engine.ts`, first part: closure state, `loadLevel`, tile queries, fixed sub-step movement with gravity, solid collision, jump with coyote and buffer. Manual check: `npx tsc --noEmit` passes.
4. Extend `engine.ts`: ladders (grab, climb, ladder-top one-way floor, release), fall-death distance. Manual check: lint and tsc pass.
5. Extend `engine.ts`: crystals, exit, time, spikes, bats, death, respawn, level completion, loop scaling and the snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
6. Extend `engine.ts`: key handling, `preventDefault`, input cleared on pause, blur and stop; draw; rAF loop with `dt` cap and sub-steps; `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/climber/jugar` is still the not-found page because the DB row does not exist yet; the five live games still play.
8. Add `.cover-climber` to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview with no change to other covers.
9. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `climber` row; `/biblioteca` shows the card; `/juegos/climber/jugar` plays.
10. Update `CLAUDE.md` (the `games` table).
11. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `climber` with title `CAVE CLIMBER`, the copy above, category `ARCADE`, cover `cover-climber`, color `green` and `sort_order` 8.
- [ ] `/juegos/climber/jugar` shows a 640×512 canvas; the game starts on level 1 with the player on tile (row 14, col 2), HUD score 0, 3 hearts and level 01.
- [ ] `←` `→` and `A` `D` walk the player at 150 px/s; the player cannot enter `#` tiles.
- [ ] `Space` jumps about 76.8 px high (2.4 tiles, ±2 px) and about 96 px forward while walking; holding `Space` does not re-jump on landing.
- [ ] A jump pressed up to 0.10 s before landing, or up to 0.08 s after walking off a ledge, still jumps.
- [ ] `↑` / `↓` (and `W` / `S`) on a ladder column climb at 110 px/s; `←` `→` `Space` do nothing while on the ladder.
- [ ] A ladder top is walkable from above; pressing `↓` there starts the descent.
- [ ] Every crystal adds exactly 100 points once and disappears; the 5 crystals of level 1 give 500.
- [ ] The exit is drawn dim and does nothing until all 5 crystals are collected; then touching it ends the level and adds `500 + 10 × ceil(timeLeft)` points.
- [ ] Touching spikes (lower 16 px of the tile) or a bat costs 1 life; jumping over a spike tile or a bat does not.
- [ ] A fall of 192 px or more costs 1 life on landing; a fall of 160 px does not; grabbing a ladder resets the fall distance.
- [ ] After a death the player respawns on `S` after 0.8 s, the timer is reset and collected crystals stay collected.
- [ ] Time at 0 costs 1 life. The level 1 limit is 60 s, level 4 is 55 s and the limit never goes below 30 s.
- [ ] Level 4 uses the layout of level 1 with bat speed 69 px/s; level 7 uses bat speed 78 px/s; bat speed never exceeds 120 px/s.
- [ ] The HUD level goes 01, 02, 03, 04 and lives show as hearts; `lives = 0` opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'climber'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=climber`, on `/juegos/climber` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/climber` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, the timer and the bats; pressing again resumes with no jump.
- [ ] While the game is mounted, `Space` and the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] Jump height is the same at 60 Hz and 144 Hz within 2 px.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, level, crystals, timer and score; no duplicate loops run (bat speed stays 60 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] The five live games still play exactly as before.
- [ ] No console errors on `/juegos/climber/jugar` during a full session through level 4.

## Decisions

- **Yes:** write the game from scratch: there is no reference folder. **No:** porting: nothing to port.
- **Yes:** `id` `climber`, taken from the planner's entry in `references/game-suggestions-todo.md`, English slug. Title `CAVE CLIMBER`.
- **Yes:** shrink scope to one screen per level and three looping levels. **No:** scrolling caves and a level editor: they exceed one core spec, which is the brief's risk.
- **Yes:** exit locked until every crystal is collected. It forces a route through the whole cave instead of a straight climb. **No:** open exit: the level would be a 20 s sprint.
- **Yes:** ladders for the long climbs and jumps only for 2-tile gaps. It keeps every level provably reachable. **No:** free-form platforms: reachability would need a validator.
- **Yes:** loop the three levels with faster bats and a shorter timer for replay value. **No:** a long campaign.
- **Yes:** collected crystals stay after a death. **No:** resetting them: it punishes a life twice.
- **Yes:** time bar drawn in the world along the ceiling, since the HUD fields are fixed to lives and level. **No:** a new HUD field or format.
- **Yes:** completing level 99 ends the game as a win and saves the score. The shell only knows `gameover`. **No:** a win screen.
- **Yes:** keyboard only; `Space` jumps and arrows climb. Touch, sound and gamepad are out of scope.
- **Yes:** primitives only, no assets. **No:** sprites: none exist in `references/`.
- **Yes:** new cover `.cover-climber` designed with `/frontend-design`, `sort_order` 8, color `green` (brief). **No:** reusing a reserved cover.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Largest scope of the ARCADE candidates                                    | One screen per level, three levels, two hazards; everything else is `JAM-climber-02`.                               |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks bat speed after restarts.       |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                    |
| Ladder-top one-way floors and snapping are fiddly                         | Dedicated step 4 and criteria; ladder tops are derived from the grid, not hand-marked.                              |
| Hand-written ASCII levels contain a typo (wrong length, missing exit)     | Step 2 manual check validates row count, row length and one `S`, one `E`, five `*`.                                 |
| A level is unreachable                                                    | Levels use ladders for climbs and gaps of at most 2 tiles; each was traced from `S` to `E` while writing the spec.  |
| Physics depends on the refresh rate                                       | Fixed 1/120 s sub-steps; criterion compares 60 Hz and 144 Hz.                                                       |
| Input stuck after pause or blur                                           | Clear input on `setPaused`, on `window` blur and on `stop`.                                                         |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                              |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.                     |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.              |

## What is **not** in this spec

- Falling stalactites, crumbling ledges and more levels (`JAM-climber-02`).
- Scrolling levels, level editor, moving platforms, enemy AI beyond patrol.
- Sound and music.
- Touch controls and gamepad.
- Skins.
- Extra lives from score.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
