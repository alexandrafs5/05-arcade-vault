# SPEC JAM-climber-01 — Cave Climber game (CAVE CLIMBER) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-18
> **Objective:** Add CAVE CLIMBER as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/climber/jugar`.

## Why this spec exists

There is no reference game folder. CAVE CLIMBER is a single-screen platform climber written from scratch for the `climber` pick in `references/game-suggestions-todo.md`. A spelunker climbs a glowing cave from the floor to the exit lantern at the top, collecting crystals, dodging bats, falling drips and floor spikes, against an oil-lamp timer. There are no barrels, no thrower at the top and no ice blocks: the climbing is done with one-way ledges, jumps and hanging ropes, and the hazards are original. Level data is hand-authored ASCII in `levels.ts`; everything is drawn with canvas primitives, so there are no assets.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This is the largest game so far, so the core is cut to three authored levels that loop with a speed-up; extra tiles and levels go in `JAM-climber-02`.

This spec is a jam draft. It is not numbered yet; the migration timestamp and `sort_order` below are re-checked when it is promoted to `specs/NN-climber-game.md`.

## Scope

**In:**

- Engine in `lib/games/climber/` (`constants.ts`, `levels.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: cave walls, ledges, ropes, crystals, spikes, bats, drips, the exit lantern, the player, and a lamp-oil time bar drawn inside the top wall row. Score, lives, level, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "climber"`, logic size 640×576, HUD fields `lives` and `level`.
- Migration `supabase/migrations/20261118001000_add_climber_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-climber` in `app/globals.css`, designed with `/frontend-design`.
- Physics and movement (px and px/s; fixed physics sub-step `PHYS_STEP = 1/120` s so a 700 px/s fall never skips a 32 px tile):
  - Grid 20 columns × 18 rows, `TILE = 32`, logic canvas 640×576. Tile `(col, row)` draws at `(col × 32, row × 32)`.
  - Player box 20×28 px. `WALK_SPEED = 150`, `GRAVITY = 1500`, `JUMP_V = 600` (jump height 120 px, 3.75 tiles), `MAX_FALL = 700`, `CLIMB_SPEED = 110`.
  - `COYOTE_S = 0.08` (jump still allowed 0.08 s after leaving a ledge) and `JUMP_BUFFER_S = 0.1` (a jump pressed up to 0.1 s before landing fires on landing).
  - Tiles: `#` solid; `-` one-way ledge (solid only from above, the player passes up through it); `|` rope; `*` crystal; `^` spike; `@` start; `E` exit; `.` empty.
  - Rope rule: while the player box overlaps a `|` tile and `↑` or `↓` is held, the player grabs the rope: x snaps to the rope's tile center, gravity is off, `↑` and `↓` move at `CLIMB_SPEED`, `←` and `→` do nothing. `Space` releases the rope with a jump (horizontal speed 150 px/s if `←` or `→` is held). The top tile of every rope column is also a one-way platform: climbing up stops with the feet exactly on the tile's top edge and the player stands there; `↓` while standing on it grabs the rope again.
  - The player cannot leave the 640×576 area; walls (`#`) are solid on every side. No fall damage.
- Controls: `←` `→` or `A` `D` walk; `Space` jumps (and releases a rope); `↑` `↓` or `W` `S` climb a rope. There is no attack.
- Hazards (lethal on contact):
  - Bat: a circle of radius `BAT_R = 10` patrolling horizontally on one row between two columns at a fixed speed in px/s, reversing at the ends. Its x range is `[from × 32 + 16, to × 32 + 16]` and its y is `row × 32 + 16`.
  - Drip: an emitter at the bottom edge of tile `(col, row)`. Every `DRIP_PERIOD_S = 2.4` s the emitter shakes for `DRIP_WARN_S = 0.6` s, then releases a 6×12 px drop that falls at `DRIP_SPEED = 400` px/s and disappears on the first `#` tile, `-` ledge top or rope-top platform it hits.
  - Spike: tile `^`; lethal when the player box overlaps the lower half of the tile (y from `tileTop + 16` to `tileTop + 32`).
- Scoring: crystal +100 (`CRYSTAL_POINTS`); reaching `E` +500 (`EXIT_POINTS`) plus `floor(secondsLeft) × 10` (`TIME_BONUS_PER_S`); collecting every crystal of the level before reaching `E` +300 (`FULL_HAUL_BONUS`).
- Lives: 3 at start. Touching a hazard or running the timer to 0 costs 1 life. After a death (`DEATH_S = 0.8` s freeze with a short animation) the player respawns at `@` with `RESPAWN_INVULN_S = 1.0` s of invulnerability (blinking). Collected crystals stay collected (no second score). The timer continues after a hazard death and resets to full after a timeout death. At 0 lives, `state = "gameover"` and `onGameOver(score)` fires once.
- Levels: 3 hand-authored levels (data below). Time limit per level: 45, 60 and 75 s (`LEVEL_TIMES`). After `E`, a `CLEAR_S = 1.2` s pause shows the tally, then the next level starts. After level 3 the cycle repeats from level 1 with the level number still going up (`level = 4` uses map 1). `loop = floor((level − 1) / 3)`: bat speeds are multiplied by `1 + 0.15 × loop` (cap 2.0) and the drip period is `max(1.2, 2.4 − 0.3 × loop)`. There is no win state.
- `CLAUDE.md` update: the `games` table row for `climber`.

**Out of scope (for future specs):**

- Crumbling ledges, lantern power-up and level 4 (feature spec `JAM-climber-02`).
- Enemies that chase the player, an attack or tool, moving platforms, keys and doors.
- Sound and music.
- Touch controls (the d-pad mapping is a later `@mobile-porter` run), gamepad, skins (later `@skin-designer` run).
- Level editor, level select, random level generation.
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
  'Escala la cueva antes de que se apague tu lámpara.',
  'Sube de repisa en repisa por una cueva luminosa. Salta, trepa cuerdas, junta cristales y esquiva murciélagos, goteras y pinchos antes de que se acabe el aceite de tu lámpara. Tres vidas y cada vuelta es más rápida.',
  'ARCADE',
  'cover-climber',
  'green',
  7
);
```

The migration file name and `sort_order` 7 are the values reserved at the time of writing (last migration `20261116000800_add_frogger_game.sql`, `frogger` holds 5; the jam draft `gems` reserves 6 and `scramble` reserves 8). Both are re-checked when the spec is promoted; renumber if the drafts are promoted in a different order.

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
// lib/games/climber/constants.ts
const COLS = 20, ROWS = 18, TILE = 32;
const W = COLS * TILE; // 640
const H = ROWS * TILE; // 576
const PLAYER_W = 20, PLAYER_H = 28;
const WALK_SPEED = 150, GRAVITY = 1500, JUMP_V = 600, MAX_FALL = 700, CLIMB_SPEED = 110;
const COYOTE_S = 0.08, JUMP_BUFFER_S = 0.1, PHYS_STEP = 1 / 120;
const LIVES = 3, DEATH_S = 0.8, RESPAWN_INVULN_S = 1.0, CLEAR_S = 1.2;
const CRYSTAL_POINTS = 100, EXIT_POINTS = 500, TIME_BONUS_PER_S = 10, FULL_HAUL_BONUS = 300;
const BAT_R = 10, DRIP_PERIOD_S = 2.4, DRIP_WARN_S = 0.6, DRIP_SPEED = 400;
const LEVEL_TIMES = [45, 60, 75]; // seconds
// lib/games/climber/levels.ts
type Level = {
  map: string[]; // 18 strings of exactly 20 chars
  bats: { row: number; from: number; to: number; speed: number }[]; // columns, px/s
  drips: { col: number; row: number }[];
};
```

Level data: each map is 18 rows of exactly 20 characters, row 0 first, columns 0 and 19 are `#`. Authoring rules every level obeys: a ledge-to-ledge rise is at most 3 tiles (96 px) with a horizontal gap of at most 2 tiles; at equal height the gap is at most 3 tiles; bigger rises use a rope.

Level 1 (45 s, 6 crystals, start col 2 row 16):

```text
####################
#......E.*.........#
#....------........#
#..................#
#..............*...#
#..........------..#
#..................#
#......*...........#
#....-----.........#
#..................#
#............*.....#
#..........-----...#
#..................#
#......*...........#
#....-----.........#
#..................#
#.@.........^^..*..#
####################
```

```ts
// bats: [{ row: 12, from: 2, to: 9, speed: 60 }]   drips: []
```

Level 2 (60 s, 6 crystals, start col 11 row 16; the rope is column 9, rows 8 to 15):

```text
####################
#.......E.*........#
#.....------.......#
#..................#
#..............*...#
#............-----.#
#..................#
#......*...........#
#.....---|---......#
#........|.........#
#........|.....*...#
#........|...----..#
#........|.........#
#....*...|.........#
#..-----.|.........#
#........|.........#
#..^^^.....@....*..#
####################
```

```ts
// bats: [{ row: 12, from: 2, to: 8, speed: 70 }, { row: 6, from: 3, to: 11, speed: 80 }]
// drips: [{ col: 15, row: 1 }]
```

Level 3 (75 s, 7 crystals, start col 2 row 16; ropes are column 4 rows 11 to 15 and column 11 rows 2 to 7):

```text
####################
#...E...*..........#
#..--------|-......#
#..........|.......#
#..........|....*.*#
#..........|...----#
#..........|.......#
#..........|.*.....#
#........------....#
#..................#
#.....*............#
#.--|---...........#
#...|..............#
#...|....*.........#
#...|..............#
#...|..............#
#.@.........^^^..*.#
####################
```

```ts
// bats: [{ row: 14, from: 9, to: 17, speed: 90 }, { row: 4, from: 2, to: 9, speed: 90 }]
// drips: [{ col: 12, row: 4 }, { col: 6, row: 8 }]
```

`parseLevel` must reject any map that is not 18 rows of 20 characters, so a typo fails loudly.

Conventions:

- Logic canvas is 640×576, origin top-left, units in pixels; time inside the engine is in seconds. Fixed physics step with an accumulator; rendering is per frame.
- Level state (crystals taken, bat positions, drip timers, timer) resets on a new level; only crystals taken persist through deaths.
- State `dead` is unused: the game goes from `playing` to `gameover` directly; the death animation is internal.
- Time bar: full width of row 0 (the top wall) shrinks from right to left with `timeLeft / LEVEL_TIMES[map]`.

## Implementation plan

1. Create `lib/games/climber/constants.ts` and `levels.ts` (three maps, bats, drips, a `parseLevel` helper). Manual check: `npm run lint` passes; a temporary console call parses all three maps and counts 6, 6 and 7 crystals (remove it before committing).
2. Create `lib/games/climber/engine.ts`, first part: closure state, tile queries, player physics (walk, gravity, jump with coyote and buffer, one-way ledges, walls) with the 1/120 s accumulator. Manual check: lint and tsc pass.
3. Extend `engine.ts`: ropes (grab, climb, top-tile platform, release jump). Manual check: lint and tsc pass.
4. Extend `engine.ts`: crystals, exit, timer, scoring, level cycle and loop speed-up, snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
5. Extend `engine.ts`: hazards (bats, drips, spikes), death, respawn with invulnerability, lives, game over. Manual check: lint and tsc pass.
6. Extend `engine.ts`: key handling (`preventDefault`, cleared on pause, blur, stop), draw (walls, ledges, ropes, crystals, hazards, player, lantern, time bar), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/climber/jugar` is still the not-found page because the DB row does not exist yet; the other five games still play.
8. Add `.cover-climber` to `app/globals.css`. Use `/frontend-design` (project rule for any UI). Manual check: it renders on `/biblioteca` after step 9.
9. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `climber` row; `/biblioteca` shows the card with the `.cover-climber` art; `/juegos/climber/jugar` plays.
10. Update `CLAUDE.md` (Games table row).
11. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `climber` with title `CAVE CLIMBER`, the copy above, category `ARCADE`, cover `cover-climber`, color `green` and `sort_order` 7 (or the value re-checked at promotion).
- [ ] `/juegos/climber/jugar` shows a 640×576 canvas; the game starts in level 1 with the player at col 2, row 16, 6 crystals, 3 lives, HUD score 0 and level 01.
- [ ] Every map in `levels.ts` is 18 rows of 20 characters and has 6, 6 and 7 crystals.
- [ ] `←` `→` and `A` `D` walk at 150 px/s; `Space` jumps 120 px high (the player can reach a ledge 3 tiles higher and cannot reach one 4 tiles higher).
- [ ] A jump pressed 0.1 s before landing fires on landing; a jump pressed up to 0.08 s after walking off a ledge still fires.
- [ ] Ledges `-` can be crossed from below and stood on from above; `#` blocks from every side.
- [ ] Holding `↑` at a rope grabs it, snaps the player to the rope center and climbs at 110 px/s; `Space` leaves the rope with a jump.
- [ ] Climbing to the top of a rope leaves the player standing on the top tile; `↓` there grabs the rope again.
- [ ] A crystal adds exactly 100 to the HUD score and disappears; it does not come back after a death.
- [ ] Touching `E` with 2 crystals missing adds 500 plus 10 per whole second left; touching it with all crystals taken also adds 300.
- [ ] After `E` the tally pause lasts 1.2 s, then the next level starts; after level 3 the game continues with map 1 and the HUD shows level 04.
- [ ] From level 4 on, bats move 15% faster than in level 1 and the drip period is 2.1 s.
- [ ] A bat, a drop or a spike costs exactly 1 life: the HUD hearts drop by 1, the player freezes 0.8 s, then respawns at `@` blinking and immune for 1.0 s.
- [ ] A drip emitter shakes for 0.6 s before each drop and drops every 2.4 s in level 2.
- [ ] The lamp bar reaches 0 after 45 s in level 1: it costs 1 life, the player respawns and the bar is full again.
- [ ] Losing the last life opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'climber'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=climber`, on `/juegos/climber` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/climber` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list the new game; `/salon` has one more tab.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and the timer; pressing again resumes with no jump (no extra fall, timer unchanged).
- [ ] While the game is mounted, the arrow keys and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, level, lives, crystals, timer and score; no duplicate loops run (walk speed stays 150 px/s after 3 restarts).
- [ ] At 30 fps and at 144 fps the jump height and the fall speed are the same (within 4 px), because physics uses the fixed 1/120 s step.
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/climber/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with ledges, ropes, bats, drips and spikes. **No:** barrels, a thrower, ladder-and-ape layouts or ice blocks: they would be a recreation of existing games.
- **Yes:** `id` `climber` (the pick in `game-suggestions-todo.md`), title `CAVE CLIMBER`.
- **Yes:** one screen per level (640×576), hand-authored ASCII maps in `levels.ts`. **No:** scrolling levels or generation: the pick flagged level data as the cost and one screen keeps it testable.
- **Yes:** three levels that loop with a speed-up and a continuing level number. **No:** a final level or win screen: the shell only knows `gameover`.
- **Yes:** jump height 120 px with maps authored for 96 px rises. **No:** rises at the limit: they feel unfair.
- **Yes:** coyote time and jump buffer. **No:** pixel-exact jumps: keyboard platformers feel broken without them.
- **Yes:** fixed 1/120 s physics step. **No:** per-frame physics: a 144 Hz screen would jump differently.
- **Yes:** a lamp-oil time bar drawn in the top wall and a time bonus of 10 per second. **No:** a HUD time field: the HUD formats are fixed to `number`, `hearts` and `pad2`, and the shell is not changed.
- **Yes:** crystals stay collected after a death. **No:** respawning them: a player could farm them by dying.
- **Yes:** no attack. The skill is movement and timing, and it keeps scope to one spec.
- **Yes:** HUD `lives` (`hearts`, 3) and `level` (`pad2`, 1) as the pick asked.
- **Yes:** new `.cover-climber`, designed with `/frontend-design`. **No:** reusing an existing cover: the pick asked for a new one.
- **Yes:** color `green` and category `ARCADE` as the pick asked, although `snake` and `frogger` are already green ARCADE games. Flagged for review.
- **Yes:** `sort_order` 7, re-checked at promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts.     |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                              |
| Largest scope of the ARCADE picks                                         | Core cut to 3 maps, 3 hazards and no attack; extras go in `JAM-climber-02`.                                   |
| A map is unwinnable or a row has the wrong length                         | `parseLevel` checks 18 rows × 20 chars; authoring rules fix rises and gaps; play each map once before commit. |
| Tunneling through ledges at high fall speed                               | Fixed 1/120 s step: max move per step is 5.8 px, far below one tile.                                          |
| Rope top platform and one-way ledges feel sticky                          | Rule is explicit (feet on the top edge); tune only `CLIMB_SPEED` and `COYOTE_S` if needed.                    |
| Bats or drips unfair after loop speed-up                                  | Caps: bat multiplier 2.0, drip period 1.2 s.                                                                  |
| Keys stuck after pause or blur                                            | Clear input on `setPaused`, on `window` blur and on `stop`.                                                   |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                        |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.               |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.        |

## What is **not** in this spec

- Crumbling ledges, lantern power-up and level 4.
- Chasing enemies, attacks, moving platforms, keys and doors.
- Sound and music.
- Touch controls, gamepad and skins.
- Level editor, level select and random levels.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
