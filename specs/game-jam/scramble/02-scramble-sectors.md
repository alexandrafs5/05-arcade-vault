# SPEC JAM-scramble-02 — Space Scroller sector route with enemies and reactor

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-scramble-01
> **Date:** 2026-11-17
> **Objective:** Turn SPACE SCROLLER's endless run into a looping route of five themed sectors, each with its own terrain profile and enemy, ending in a reactor target whose destruction pays a bonus and starts a faster loop.

## Why this spec exists

`JAM-scramble-01` ships a playable endless run with one terrain generator, rockets and fuel tanks, and a speed ramp per sector. It plays the same from start to end, so high-score runs have no landmarks to learn. This spec is the theme layer: a fixed route of five sectors (plains, caverns, meteor belt, fortress, reactor), three new enemy types plus a multi-hit reactor target, and a loop counter that drives the difficulty instead of the sector count.

The result is a distinct ruleset of the same game: same ship, weapons, fuel and lives, but a designed route with a goal every loop. It only changes files under `lib/games/scramble/` and the `scramble` entry in `lib/games/registry.ts`. It inserts no catalog row and does not touch the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it is re-checked against the promoted core spec.

## Scope

**In:**

- New file `lib/games/scramble/sectors.ts` with the `SECTORS` table below. `terrain.ts` reads the current sector profile instead of picking `open` / `cave` segments at random.
- Route: sectors 1 → 2 → 3 → 4 → 5, then loop back to sector 1 with `loop + 1`. `loop` starts at 1.

  | #   | Key        | Length (px) | Terrain                                           | Base `gapMin` | Ground objects                                   | Air enemy |
  | --- | ---------- | ----------- | ------------------------------------------------- | ------------- | ------------------------------------------------ | --------- |
  | 1   | `plains`   | 4800        | open only (`ceil = 0`), floor 300–456             | —             | rockets 65 %, tanks 35 %                         | none      |
  | 2   | `caverns`  | 4800        | cave only, floor 300–456                          | 160           | rockets 65 %, tanks 35 %                         | drones    |
  | 3   | `belt`     | 4800        | open only, floor 380–456                          | —             | tanks only                                       | meteors   |
  | 4   | `fortress` | 4800        | cave only, floor 300–456                          | 130           | turrets 50 %, tanks 35 %, rockets 15 %           | none      |
  | 5   | `reactor`  | 2400        | corridor: flat floor 400, flat ceil 200 (gap 200) | —             | tanks on the first 3 pads only, then the reactor | none      |

- Each sector starts with the core's 30 flat open columns (breather). In sector 5, after the breather, the ceiling ramps in to 200 with the core's 12 px per column ramp. The forced-tank rule (32 columns) applies in sectors 1–4.
- **Difficulty per loop** replaces the core's per-sector ramp:
  - Scroll multiplier `min(1.15^(loop − 1), 2.0)`.
  - Fuel drain `min(5 + 1 × (loop − 1), 8)` units per second.
  - Cave `gapMin` = base `gapMin` of the sector − `10 × (loop − 1)`, never below 110.
- **Sector bonus.** Finishing sectors 1–4 adds +1000 points each, as in the core. Finishing sector 5 adds no sector bonus.
- **Drone** (sector 2): 20×12 px. One spawns every 1.6 s at the right edge, with a base y at random between `ceil + 20` and `floor − 32` of the right-edge column. Screen velocity `vx = −(scroll speed + 60)` px/s; `y = baseY + 36 × sin(2π × t / 1.4)`, `t` in seconds since spawn. Destroyed by one laser hit or a blast: +120 points. Touching it kills the ship. Drones pass through terrain (no terrain collision) and are removed when they leave the left edge.
- **Meteor** (sector 3): two sizes, small (radius 14) and large (radius 22), 70 % small. One spawns every 0.9 s at the right edge with y at random between 24 and `floor − 40` of the right-edge column, `vx = −(scroll speed + 40 to 100)` px/s and `vy` between −30 and +30 px/s, both at random. Small: 1 laser hit or a blast, +60 points. Large: 3 laser hits or a blast, +150 points; it flashes white for 0.1 s on each non-fatal hit. A meteor that touches the floor shatters with no points. Touching it kills the ship. Removed when it leaves the screen.
- **Turret** (sector 4): ground object 24×16 on a pad, with a barrel drawn towards the ship. While on screen and to the right of the ship's x, it fires a flak shot (6×6 px) every 1.8 s, aimed at the ship centre at 200 px/s. Destroyed by 2 laser hits or a blast: +150 points. Touching a turret or a flak shot kills the ship. A flak shot is removed when it enters terrain or leaves the screen. At most 6 flak shots on screen; a turret does not fire while 6 are alive.
- **Reactor** (sector 5): a 48×64 target on a 5-column pad, placed so its left edge is 400 px before the end of the sector. It has 6 hit points: a laser hit removes 1, a blast removes 3. It flashes white for 0.1 s on each non-fatal hit. Touching it kills the ship.
  - Destroying it: +`5000 × loop` points and a 0.6 s explosion of primitive particles (the world keeps scrolling).
  - If it scrolls off the left edge undestroyed: no bonus.
  - Either way, the loop ends when the sector 5 distance is done: `loop + 1`, the route goes back to sector 1.
- **Respawn** (core rule, extended): drones, meteors and flak shots on screen are also removed. The reactor keeps its remaining hit points.
- **Progress strip** (core): it now fills over the current sector's length (2400 px in sector 5).
- **HUD.** New field `sector` (`pad2`), the absolute sector count `(loop − 1) × 5 + index`: `01`–`05` in loop 1, `06`–`10` in loop 2, and so on. Registry entry updated; nothing else in the shell.
- Drawing (primitives only): drones magenta diamonds with a cyan core; meteors grey rough circles with darker craters; turrets dark red domes with a grey barrel; flak shots orange; the reactor a cyan-and-white cylinder with a pulsing core that dims as it loses hit points. The terrain edge color per sector: `plains` `#f5ff00`, `caverns` `#00f5ff`, `belt` `#aaaaaa`, `fortress` `#ff006e`, `reactor` `#00ff88`. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: Games table row `scramble`, HUD column now fuel (`number`), lives (`hearts`), sector (`pad2`), and the note "sector data in `sectors.ts`".

**Out of scope (for future specs):**

- More than five sectors, a sector picker or starting from a later sector.
- Hand-authored terrain per column (profiles stay procedural inside their rules).
- Reactor weapons or any boss behaviour.
- Power-ups (shield, double laser).
- New catalog copy: the core `long` text already says "sectores cada vez más duros".
- Sound and music.
- Bitmap sprites and skins.
- Touch mapping (done later by `@mobile-porter`).
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys and no catalog row: the `scramble` row comes from `JAM-scramble-01`. Scores still go through `saveScore` into `scores` (`game_id = 'scramble'`).

```ts
// HUD fields in lib/games/registry.ts (replaces the core list)
hud: [
  { key: "fuel", label: "Combustible", format: "number", initial: 100 },
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "sector", label: "Sector", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { fuel, lives, sector } }
```

```ts
// lib/games/scramble/sectors.ts
type SectorProfile = {
  key: "plains" | "caverns" | "belt" | "fortress" | "reactor";
  length: number; // px of scroll
  terrain: "open" | "cave" | "corridor";
  floorMin: number;
  floorMax: number;
  gapMin: number | null; // base, before the loop reduction
  objects: { tank: number; rocket: number; turret: number }; // chances, sum 1
  air: "drone" | "meteor" | null;
  edge: string; // terrain edge color
};
```

```ts
// lib/games/scramble/constants.ts (added)
const LOOP_SPEED_STEP = 1.15,
  LOOP_SPEED_CAP = 2.0,
  LOOP_DRAIN_STEP = 1;
const DRONE_W = 20,
  DRONE_H = 12,
  DRONE_EVERY = 1.6,
  DRONE_EXTRA_VX = 60;
const DRONE_AMP = 36,
  DRONE_PERIOD = 1.4,
  PTS_DRONE = 120;
const METEOR_R_SMALL = 14,
  METEOR_R_LARGE = 22,
  METEOR_SMALL_CHANCE = 0.7,
  METEOR_EVERY = 0.9;
const METEOR_HP_LARGE = 3,
  PTS_METEOR_SMALL = 60,
  PTS_METEOR_LARGE = 150;
const TURRET_W = 24,
  TURRET_H = 16,
  TURRET_HP = 2,
  TURRET_EVERY = 1.8,
  PTS_TURRET = 150;
const FLAK_SIZE = 6,
  FLAK_SPEED = 200,
  FLAK_MAX = 6;
const REACTOR_W = 48,
  REACTOR_H = 64,
  REACTOR_HP = 6,
  REACTOR_BOMB_DMG = 3;
const REACTOR_LEAD = 400,
  PTS_REACTOR = 5000,
  HIT_FLASH = 0.1;
```

Removed from the core constants: `SPEED_STEP`, `SPEED_CAP`, `FUEL_DRAIN_STEP` and `GAP_MIN_START` (replaced by the loop values and the `SECTORS` table).

Conventions:

- Same units as the core: px, px/s, seconds; movement uses `dt`.
- Air enemies (drones, meteors, flak shots) live in screen space; ground objects (tanks, rockets, turrets, reactor) live in world x, as in the core.
- Points per object are awarded once, by the hit that destroys it; a blast and a laser hit on the same frame count once.
- The score cap of 10,000,000 from the core still applies.

## Implementation plan

1. Create `lib/games/scramble/sectors.ts` with the `SECTORS` table and add the new constants to `constants.ts`. Manual check: `npm run lint` and `npx tsc --noEmit` pass; the game still plays as the core.
2. Change `terrain.ts` to read the current profile (terrain kind, floor range, base `gapMin` with the loop reduction, object chances, sector 5 corridor and reactor pad). Change `engine.ts` to track `index` and `loop`, apply the loop speed and drain, give the sector bonus only for sectors 1–4, and report `sector` in the snapshot. Manual check: tsc passes; plains are open, caverns are caves, the route wraps after sector 5.
3. Add the `sector` HUD field to the `scramble` entry in `registry.ts`. Manual check: the HUD shows `Sector 01` at start and `02` after 4800 px.
4. Extend `engine.ts`: drones (spawn timer, sine path, hit, scoring, contact death). Manual check: lint and tsc pass; drones appear only in sector 2.
5. Extend `engine.ts`: meteors (sizes, spawn, drift, hit points and flash, floor shatter, scoring, contact death). Manual check: lint and tsc pass; meteors appear only in sector 3.
6. Extend `engine.ts`: turrets and flak (aim, fire timer, 6-shot cap, hit points, scoring, terrain removal, contact death). Manual check: lint and tsc pass; turrets appear only in sector 4.
7. Extend `engine.ts`: reactor (placement, hit points, flash, bonus `5000 × loop`, missed reactor, loop end), respawn clearing of air enemies, per-sector edge color and progress strip length. Manual check: lint and tsc pass; destroying the reactor adds 5000 in loop 1.
8. Update `CLAUDE.md`.
9. Run `npm run lint`, `npx tsc --noEmit` and `npm run build`.

No new UI element is created: the `pad2` format already exists and the cover comes from the core. `/frontend-design` is not required. If `/spec-impl` finds the third HUD field breaks the HUD layout, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.
- [ ] `games` still has exactly one `scramble` row; no migration is added by this spec.
- [ ] The HUD shows `Combustible` 100, 3 hearts and `Sector` `01` at start.
- [ ] Sector 1 has no ceiling anywhere; sector 2 has a ceiling on every column after the breather; sector 3 has no ceiling and its floor stays between y 380 and 456.
- [ ] Every sector starts with 30 flat open columns with no objects.
- [ ] After 4800 px the HUD sector becomes `02` and +1000 points are added; the same at the end of sectors 2, 3 and 4.
- [ ] Sector 5 lasts 2400 px, has a flat floor at 400 and a flat ceiling at 200 after its ramp, and adds no sector bonus.
- [ ] After sector 5 the HUD sector becomes `06` and the terrain is the sector 1 profile again.
- [ ] In loop 2 the scroll speed is 138 px/s (120 × 1.15) and fuel drains 6 per second; the multiplier never exceeds ×2.0 and the drain never exceeds 8.
- [ ] Cave gaps are never below 160 px in sector 2 and 130 px in sector 4 during loop 1, 10 px less per extra loop, and never below 110 px.
- [ ] Drones appear only in sector 2, one every 1.6 s, follow a sine path of 36 px amplitude, and give +120 when destroyed.
- [ ] Meteors appear only in sector 3, one every 0.9 s; a small one dies to 1 laser hit (+60), a large one to 3 laser hits or one blast (+150); a meteor that touches the floor gives 0 points.
- [ ] Turrets appear only in sector 4, fire an aimed flak shot every 1.8 s while ahead of the ship, never with more than 6 flak shots on screen, and give +150 after 2 laser hits or one blast.
- [ ] Touching a drone, meteor, turret, flak shot or the reactor costs exactly one life (unless invulnerable).
- [ ] The reactor appears 400 px before the end of sector 5, takes 6 laser hits or 2 blasts, and destroying it in loop 1 adds exactly +5000 (loop 2: +10000).
- [ ] Letting the reactor scroll off the screen adds no bonus and still starts the next loop.
- [ ] After a respawn no drone, meteor or flak shot is on screen.
- [ ] The terrain edge color matches the sector: yellow, cyan, grey, magenta, green.
- [ ] The progress strip fills over 4800 px in sectors 1–4 and over 2400 px in sector 5.
- [ ] JUGAR DE NUEVO resets the HUD to sector `01`, loop 1 and 120 px/s.
- [ ] PAUSA freezes drones, meteors, turrets, flak shots and the reactor flash; resuming has no jump.
- [ ] The core criteria of `JAM-scramble-01` that do not involve the per-sector ramp still pass (controls, fuel, tanks, rockets, death, respawn, game over, score saving).
- [ ] The five other games still play exactly as before.
- [ ] No console errors on `/juegos/scramble/jugar` during a full loop.

## Decisions

- **Yes:** a fixed route of five profiles that loops. Players learn the route and chase the reactor bonus. **No:** hand-authored terrain column by column: large data for little gain.
- **Yes:** difficulty per loop (×1.15 speed, +1 drain). **No:** keeping the core's per-sector ramp: five sectors per loop would hit the cap before the first reactor.
- **Yes:** one air enemy per sector (drones in 2, meteors in 3) and turrets only in 4. Each sector has one clear identity. **No:** mixing all enemies everywhere.
- **Yes:** the reactor is a multi-hit target that does not fire back. **No:** a boss with attacks: own spec.
- **Yes:** bonus `5000 × loop` for the reactor, scaling with the risk. **No:** a flat bonus.
- **Yes:** a missed reactor still ends the loop. **No:** blocking the route until it is destroyed: the game is a scroller and cannot stop.
- **Yes:** new HUD field `sector` (`pad2`), the absolute count; the loop is implied by it (`06` = loop 2). **No:** a separate `loop` field: no game shows more than two HUD fields today and a fourth would crowd the touch layout.
- **Yes:** air enemies pass through terrain (drones) or shatter on the floor (meteors). **No:** terrain pathfinding for enemies.
- **Yes:** 6-shot flak cap. Keeps the fortress readable. **No:** unlimited enemy fire.
- **Yes:** no catalog change and no shell change. **No:** a second catalog row or a mode picker: one row per game.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                            | Mitigation                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The meteor belt has no rockets and becomes too easy or too hard | Spawn rate (0.9 s) and the small/large split are constants; tune them during `/spec-impl`.                 |
| Flak aimed at the ship in a 130 px cave is unfair               | 6-shot cap, 1.8 s interval and 200 px/s speed; turrets only fire while ahead of the ship.                  |
| Drones spawned inside the ceiling or floor look broken          | Base y is picked between `ceil + 20` and `floor − 32` of the right-edge column.                            |
| Fuel runs dry in the reactor sector (only 3 tank pads)          | Sector 5 is 2400 px: 20 s and 100 fuel of drain in loop 1; the 3 tanks (+90) sit right after the breather. |
| The first three-field HUD crowds the touch layout               | `@mobile-porter scramble` checks the layout; if it breaks, a shell change goes in its own spec.            |
| Score inflation in late loops                                   | The core score cap of 10,000,000 still applies.                                                            |
| More entity types slow the frame on low-end devices             | Primitives only, no `shadowBlur` in the loop; `@game-performance-booster scramble` can review it later.    |
| Game over fired twice (engine and FIN)                          | The shell ignores `onGameOver` when the modal is open.                                                     |
| Next.js 16 differs from training data                           | No route or component changes in this spec; read `node_modules/next/dist/docs/` if one becomes necessary.  |

## What is **not** in this spec

- More sectors, a sector picker or a later start.
- Hand-authored terrain.
- Reactor weapons and boss behaviour.
- Power-ups.
- New catalog copy.
- Sound and music.
- Bitmap sprites and skins.
- Touch mapping (done later by `@mobile-porter`).
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
