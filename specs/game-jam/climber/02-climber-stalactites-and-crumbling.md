# SPEC JAM-climber-02 — Cave Climber stalactites, crumbling ledges and two new levels (CLIMBER)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-climber-01
> **Date:** 2026-11-23
> **Objective:** Add falling stalactites, crumbling ledges and two new levels (4 and 5) to CLIMBER, extending the level loop from 3 to 5 layouts.

## Why this spec exists

`JAM-climber-01` ships a complete game on three looping levels with two hazards, and defers everything else so it could fit one core spec. After one lap the layouts repeat with only faster bats. This spec is the theme layer: the cave itself becomes dangerous. Stalactites fall when the player walks under them, and some ledges crumble after being stood on, so the player has to read the ceiling and keep moving. Two new hand-built levels use both mechanics and the loop grows from 3 to 5 layouts.

Everything is engine and data. The shell, the registry entry, the HUD fields and the catalog row stay as the core left them. This spec lists only what it adds or changes; it does not insert a second catalog row.

## Scope

**In:**

- Edit `lib/games/climber/constants.ts`, `lib/games/climber/levels.ts` and `lib/games/climber/engine.ts` (plus `CLAUDE.md`). No change to `lib/games/registry.ts`, the migration, the cover or the shell.
- Two new tile characters in the level grids:
  - `v` stalactite anchor. It must sit in the cell directly below a `#` tile.
  - `~` crumbling ledge.
- Stalactites:
  - A hanging stalactite is harmless and does not block movement.
  - It is triggered when the player's center is within 24 px (horizontally) of the stalactite's center, the player is below it, and no `#`, `~` or ladder-top tile lies between them. It then shakes for 0.6 s (drawn with a 2 px horizontal wobble).
  - After shaking it falls from rest with gravity 1500 px/s² and kills the player on overlap (hitbox 12×20 px). It disappears when its bottom touches a `#`, `~` or ladder-top tile.
  - It re-hangs at its anchor 4.0 s after it landed.
- Crumbling ledges:
  - A `~` tile is solid like `#`. Once the player stands on it, a 0.5 s countdown starts; the tile is drawn cracked during it.
  - At 0 the tile disappears (not solid) for 3.0 s. It returns afterwards only if nothing overlaps it; if the player overlaps it, it returns the moment the player leaves.
  - A player standing on it when it disappears falls normally (fall-death rules apply).
- Levels 4 and 5 (see Data model). The layout for running level `n` becomes `LEVELS[(n − 1) % 5]`, and `loop = floor((n − 1) / 5)` replaces `floor((n − 1) / 3)` in the bat speed and timer formulas.
- Time limit and bat speed formulas keep the core constants: `timeLimit = max(30, 60 − 5 × loop)`; bat speed `60 × min(2.0, 1 + 0.15 × loop)`.
- `CLAUDE.md` update: the `climber` row Canvas notes mention stalactites, crumbling ledges and five levels.

**Out of scope (for future specs):**

- Moving platforms, water, lava, other enemies.
- More than five levels, scrolling levels, a level editor.
- Sound and music, touch controls, gamepad, skins.
- Extra lives from score.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no catalog row. HUD fields and snapshot stay `lives` (`hearts`, initial 3) and `level` (`pad2`, initial 1).

```ts
// added to lib/games/climber/constants.ts (LEVELS_COUNT changes from 3 to 5)
const LEVELS_COUNT = 5;
const STALACTITE_RANGE = 24, STALACTITE_SHAKE_S = 0.6, STALACTITE_REHANG_S = 4.0;
const STALACTITE_W = 12, STALACTITE_H = 20;
const CRUMBLE_DELAY_S = 0.5, CRUMBLE_RETURN_S = 3.0;
```

Level 4 (`E` row 1 col 2, `S` row 14 col 8; crystals at (1,8), (1,16), (7,8), (10,3), (14,12) as `row,col`; bats: `{ col: 8, row: 4, range: 4 }`, `{ col: 11, row: 10, range: 3 }`):

```text
####################
#.E.....*.......*..#
######~~~~######H###
#..v........v...H..#
#...............H..#
###H#####~~~########
#..H..v.......v....#
#..H....*..........#
####..##########H###
#.......v..v....H..#
#..*..^.........H..#
###H######~~~~######
#..H...............#
#..H...............#
#..H....S...*..^^..#
####################
```

Level 5 (`E` row 1 col 16, `S` row 14 col 17; crystals at (1,2), (1,6), (7,11), (10,16), (14,9); bats: `{ col: 8, row: 10, range: 3 }`, `{ col: 11, row: 4, range: 3 }`, `{ col: 9, row: 7, range: 3 }`):

```text
####################
#.*...*.........E..#
##H#######..########
#.H......v.....v...#
#.H................#
#######~~########H##
#.....v.......v..H.#
#..........*.....H.#
####H#######~~######
#...H......v.......#
#...H.......^...*..#
#########..####H####
#..............H...#
#..............H...#
#...^^...*.....H.S.#
####################
```

Conventions:

- Every level still has exactly 16 rows of 20 characters, one `S`, one `E` and 5 `*`. Every `v` has a `#` directly above it. A `~` run is at most 4 tiles wide.
- The step-by-step route of each new level uses only ladders and gaps of at most 2 tiles; crumbling runs are crossed by walking. A crumbled tile opens a drop of at most 4 tiles (128 px), below the 192 px fall-death limit.
- Level 5 is the level 2 layout mirrored left to right, with stalactites and two crumbling runs added.
- Engine private state added per tile: `crumbleTimer`, `crumbleState`; per stalactite: `phase` (`hanging`, `shaking`, `falling`, `gone`), `y`, `vy`, `rehangAt`.
- State `dead` timing, lives, crystals, exit and scoring rules from the core are unchanged.

## Implementation plan

1. Add the constants to `constants.ts` and change `LEVELS_COUNT` to 5. Manual check: `npm run lint` passes.
2. Add levels 4 and 5 to `levels.ts` and extend the temporary validation (16 rows, 20 columns, one `S`, one `E`, 5 `*`, each `v` below a `#`). Manual check: validation passes; remove the log; the loop and the layout lookup use `% 5` and `floor(… / 5)`.
3. Engine: crumbling tiles (solid state, countdown, disappear, return rule, drawing). Manual check: standing on `~` in level 4 makes it crack after 0.5 s and disappear; it returns after 3.0 s.
4. Engine: stalactites (trigger, shake, fall, kill, re-hang, drawing). Use `/frontend-design` for the new in-world shapes (project rule for UI). Manual check: walking under a stalactite in level 4 triggers it; it kills only while falling.
5. Update `CLAUDE.md`. Manual check: the `climber` row reads correctly.
6. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No migration, registry or shell file changes in this spec's diff; `games` still has exactly one `climber` row.
- [ ] The layouts for levels 1 to 6 are the layouts 1, 2, 3, 4, 5 and 1; the level 6 bat speed is 69 px/s and its time limit is 55 s.
- [ ] Levels 4 and 5 each have 5 crystals and both are completable from `S` to `E` with all crystals, using only walking, 2-tile jumps and ladders.
- [ ] A hanging stalactite does not hurt: walking or jumping through its cell costs no life.
- [ ] Standing within 24 px of a stalactite's center, below it with a clear path, makes it shake for 0.6 s and then fall.
- [ ] A falling stalactite costs 1 life on overlap; it disappears when it lands and re-hangs 4.0 s later.
- [ ] A player who leaves the 24 px zone before the 0.6 s shake ends does not stop the fall.
- [ ] A `~` tile holds the player like `#`, cracks for 0.5 s after the player stands on it and then disappears for 3.0 s.
- [ ] A `~` tile does not return while the player overlaps it; it returns as soon as the player leaves.
- [ ] A drop through a crumbled tile in levels 4 and 5 does not cost a life by itself (at most 128 px).
- [ ] Crystals collected stay collected after a death, as in the core; stalactites and crumbled tiles reset on respawn.
- [ ] Level 4 loads with 2 bats and level 5 with 3 bats.
- [ ] PAUSA, `P` and `Esc` freeze stalactite timers and crumble timers; they resume with the same remaining time.
- [ ] JUGAR DE NUEVO restores all `~` tiles, all stalactites and level 1; no duplicate loops run.
- [ ] The core rules (walk, jump, ladders, crystals, exit, bats, spikes, timer, game over) behave exactly as before in levels 1 to 3.
- [ ] No console errors on `/juegos/climber/jugar` during a full session through level 6.

## Decisions

- **Yes:** stalactites fall only after a warning shake. **No:** instant drops: unfair without a tell.
- **Yes:** a hanging stalactite is harmless. **No:** a solid hazard at rest: it would block jumps near the ceiling.
- **Yes:** crumbling ledges return after 3.0 s. **No:** permanent holes: a level could become unwinnable after one misstep.
- **Yes:** level 5 is a mirror of level 2 with new hazards. **No:** a fully new layout: the mirror keeps the proven reachability and halves the data to trace.
- **Yes:** `loop` now uses 5 layouts. **No:** keeping `/ 3`: bats would speed up before the player saw all layouts.
- **Yes:** drawing with primitives, no assets. **No:** sprites.
- **Yes:** this spec changes only engine, data files and `CLAUDE.md`. **No:** a second catalog row, a new cover, a new HUD field or registry edits.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file (done in the core). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Changing the loop length shifts bat speed and timers vs. the core       | Stated explicitly; criterion checks level 6 values. Promote together with the core or note it at promotion.  |
| Crumbled tile traps the player in a loop of falls                       | Tiles return after 3.0 s and the maximum drop is 128 px.                                                     |
| Stalactite trigger feels random                                         | Shake of 0.6 s plus a 24 px zone; a visible wobble is the tell.                                              |
| ASCII typo in new levels                                                | Step 2 validation (size, markers, `v` below `#`).                                                            |
| Timers keep running while paused                                        | All timers advance only with the capped `dt`, which is 0 after resume.                                       |
| Input stuck after pause or blur                                         | Same input clearing as the core.                                                                             |
| Next.js 16 differs from training data                                   | No Next code is touched; the shell must not change.                                                          |

## What is **not** in this spec

- Moving platforms, water, lava, other enemies.
- More than five levels, scrolling levels, a level editor.
- Sound, touch controls, gamepad, skins.
- Extra lives from score.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
