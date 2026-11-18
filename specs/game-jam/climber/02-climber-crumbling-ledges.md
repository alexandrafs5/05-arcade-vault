# SPEC JAM-climber-02 — Crumbling ledges, lantern and level 4

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-climber-01
> **Date:** 2026-11-18
> **Objective:** Add crumbling ledges, a lantern pickup that gives an extra life, and a fourth cave to CAVE CLIMBER, so each lap has a new rule to learn and a way to earn lives.

## Why this spec exists

The core spec has three caves, three hazards and a fixed 3 lives. After two laps a player knows every map. A ledge that falls after you step on it changes how a known route is climbed, and a lantern pickup gives a reason to take a risky detour, which is what keeps high-score runs going. This spec changes only the engine data and rules in `lib/games/climber/`. It adds no catalog row, no shell change and no assets, and it needs `JAM-climber-01` implemented first.

## Scope

**In:**

- New tile `~` (crumbling ledge) in `lib/games/climber/levels.ts` and the engine. It behaves like a `-` one-way ledge until the player's feet touch it. First contact starts a `CRUMBLE_S = 0.5` s timer; the tile shakes while it runs and does not stop if the player leaves. At 0 the tile disappears (the player falls if still on it). It comes back after `CRUMBLE_RESPAWN_S = 3.0` s, but only when the player box does not overlap its cell; if it does, the check repeats every physics step. A drip drop lands on a `~` tile like on a `-` tile and does not trigger it.
- New tile `L` (lantern pickup): +200 points (`LANTERN_POINTS`) and +1 life, with a cap of `MAX_LIVES = 5`. At the cap it still gives the 200 points. A lantern taken stays taken through deaths, like a crystal; it comes back when the level loads again in a later lap.
- Change to level 3: the ledge in row 5, columns 15 to 18, changes from `----` to `~~~~`. Row 5 becomes `#..........|...~~~~#`. Nothing else in level 3 changes.
- New level 4, appended to `LEVELS` (data below). `LEVEL_TIMES` becomes `[45, 60, 75, 60]`. The cycle now has 4 maps: `levelIndex = (level − 1) % 4` and `loop = floor((level − 1) / 4)`. The loop speed-up formulas of the core spec do not change (bats `1 + 0.15 × loop`, cap 2.0; drip period `max(1.2, 2.4 − 0.3 × loop)`).
- Constants added to `constants.ts`: `CRUMBLE_S = 0.5`, `CRUMBLE_RESPAWN_S = 3.0`, `LANTERN_POINTS = 200`, `MAX_LIVES = 5`, `LEVEL_COUNT = 4`.
- Drawing: a `~` tile looks like a ledge with cracks and shakes by ±2 px while crumbling; a `L` pickup is a small lit lantern that glows. Both use canvas primitives. Exact look is a detail for `/spec-impl` using `/frontend-design` (new in-canvas UI elements).

**Out of scope (for future specs):**

- More levels, a level editor or random levels.
- Moving platforms, keys and doors, chasing enemies, an attack.
- Sound and music.
- Touch controls, gamepad, skins.
- Any change to the HUD formats, the registry entry, the cover or the catalog row.
- Any other game.

## Data model

No new tables, no catalog row, no migration, no registry change, no new `localStorage` keys. The snapshot and HUD fields (`lives`, `level`) are the same as in `JAM-climber-01`; the `hearts` format already draws up to the value it receives, and lives never exceed 5.

Level 4 (60 s, 5 crystals, 1 lantern, start col 2 row 16). Row 16 is floor with spikes from column 5 to column 16: falling from a crumbled ledge to the floor is lethal, and the only safe floor is columns 1 to 4 and 17 to 18.

```text
####################
#..*.E.............#
#..-----...........#
#..................#
#........*.........#
#.......~~~~.......#
#..................#
#.............*.L..#
#............~~~~..#
#..................#
#........*.........#
#.......~~~~.......#
#..................#
#...*..............#
#..----............#
#..................#
#.@..^^^^^^^^^^^^..#
####################
```

```ts
// lib/games/climber/levels.ts (added)
// Level 4: bats [{ row: 9, from: 3, to: 12, speed: 100 }, { row: 3, from: 9, to: 17, speed: 100 }]
//          drips [{ col: 14, row: 5 }]
// lib/games/climber/constants.ts (added / changed)
const CRUMBLE_S = 0.5, CRUMBLE_RESPAWN_S = 3.0;
const LANTERN_POINTS = 200, MAX_LIVES = 5, LEVEL_COUNT = 4;
const LEVEL_TIMES = [45, 60, 75, 60]; // seconds
```

Route check for level 4 (authoring rules of the core spec hold): floor to the ledge in row 14 (rise 3 tiles) from columns 3 to 4; row 14 to row 11 (rise 3, gap 1 tile); row 11 to row 8 (rise 3, gap 1 tile); row 8 to row 5 (rise 3, gap 1 tile); row 5 to row 2 (rise 3, gap 0 tiles). The lantern sits at row 7, column 16, on the row 8 ledge.

Conventions:

- A crumbling tile has its own state (`idle`, `crumbling`, `gone`) and timer per tile in the level state; it resets when the level loads. Lanterns use the same "taken" set as crystals.
- The core spec's criteria about "after level 3 the next level is 04 on map 1" are replaced by this spec's: the cycle is 4 maps.

## Implementation plan

1. Add the constants and parse `~` and `L` in `parseLevel`; change level 3 row 5 and append level 4 and `LEVEL_TIMES`. Manual check: `npm run lint` passes; a temporary console call parses 4 maps (18 rows × 20 chars each) and counts crystals 6, 6, 7, 5 (remove it before committing); the game still plays levels 1 to 3.
2. Extend `engine.ts`: crumbling tile state machine, solid-from-above collision for `~` while not `gone`, respawn rule. Manual check: lint and tsc pass.
3. Extend `engine.ts`: lantern pickup, life cap, the 4-map cycle and `loop = floor((level − 1) / 4)`. Manual check: lint and tsc pass.
4. Extend the draw code for `~` (cracks, shake, gone) and `L`. Use `/frontend-design` for the look. Manual check: both read clearly at 375 px width.
5. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] There are 4 maps in `levels.ts`, each 18 rows of 20 characters, with 6, 6, 7 and 5 crystals.
- [ ] A `~` tile can be crossed from below and stood on from above like a `-` tile.
- [ ] A `~` tile disappears 0.5 s after the player's feet first touch it, even if the player has already left it.
- [ ] A `~` tile that disappeared returns after 3.0 s; if the player box overlaps it at that moment, it returns on the first step after the player leaves the cell.
- [ ] A drip drop landing on a `~` tile does not start its timer.
- [ ] Taking the lantern in level 4 adds 200 to the HUD score and 1 to the HUD hearts; with 5 hearts it adds 200 and no heart.
- [ ] Lives never go above 5.
- [ ] A lantern taken stays taken after a death in the same level.
- [ ] Level 3 shows `~` tiles on the ledge in row 5, columns 15 to 18, and its other tiles are unchanged.
- [ ] After level 4 the game continues with level 05 on map 1.
- [ ] From level 5 on, bats move 15% faster than in level 1 and the drip period is 2.1 s; in levels 1 to 4 they are unchanged.
- [ ] Level 4 has its time bar at 60 s, bats on rows 9 and 3, and one drip at column 14.
- [ ] The floor of level 4 kills on contact from column 5 to column 16 and not on columns 1 to 4.
- [ ] Score, crystals, exit bonuses, the death rules, the pause and game over behave as in `JAM-climber-01`.
- [ ] No file outside `lib/games/climber/` changes (no shell, registry, CSS, migration or `CLAUDE.md` change).
- [ ] The other five games still play exactly as before.
- [ ] No console errors on `/juegos/climber/jugar` during a full session.

## Decisions

- **Yes:** one new tile (crumbling ledge) and one new pickup (lantern). **No:** moving platforms and keys: they need their own rules and maps.
- **Yes:** the timer keeps running after the player leaves the tile. **No:** cancelling it: the player could tap and leave forever.
- **Yes:** crumbling tiles return after 3.0 s. **No:** permanent holes: a map could become unwinnable after a fall.
- **Yes:** the lantern gives a life up to 5. **No:** unlimited lives: the run would never end by lives.
- **Yes:** the lantern is only in level 4 and comes back each lap. **No:** one in every level: lives would stop mattering.
- **Yes:** change level 3 row 5 to crumbling. **No:** leaving the new tile only in level 4: players would meet it only after three levels.
- **Yes:** a fourth map and a 4-map cycle. **No:** a fifth map: this spec stays small.
- **Yes:** no shell, registry, cover or catalog change. **No:** a second catalog row: one game has one row.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file (done in the core spec). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Level 4 route is too hard with a spiked floor                             | Every rise is 3 tiles with gaps of 0 or 1 tile; crumble delay 0.5 s; play it once before commit.   |
| A crumbled tile returns on top of the player and traps them in a wall     | The respawn check waits until the player box leaves the cell.                                       |
| Lives above 5 overflow the HUD                                            | Cap at `MAX_LIVES = 5` in the engine; the HUD receives at most 5.                                   |
| Changing level 3 breaks a score balance already seen in play              | Only one 4-tile ledge changes and its crystal row stays; crystals count is still 7.                 |
| Cycle length change breaks `level` mapping                                | One formula (`(level − 1) % LEVEL_COUNT`); criterion checks level 05.                               |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components. |

## What is **not** in this spec

- More levels, a level editor and random levels.
- Moving platforms, keys and doors, chasing enemies, an attack.
- Sound and music.
- Touch controls, gamepad and skins.
- Any change to the HUD formats, the registry entry, the cover or the catalog row.
- Any other game.

Each one of those, if it lands, goes in its own spec.
