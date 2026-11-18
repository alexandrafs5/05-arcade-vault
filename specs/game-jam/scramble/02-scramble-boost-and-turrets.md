# SPEC JAM-scramble-02 — Boost and ground turrets

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-scramble-01
> **Date:** 2026-11-18
> **Objective:** Add a fuel-burning boost and ground turrets that shoot back to AMBER CANYON, so players trade fuel for points and must fly low to destroy threats.

## Why this spec exists

The core spec has one skill, flying, and one resource, fuel that only drains by distance. A boost turns fuel into a choice (spend it for faster points or save it), and turrets add an enemy that shoots, forces the ship into the lower canyon and rewards accurate pulses. Both are rules for the same engine: this spec changes only `lib/games/scramble/`, adds no catalog row, no shell change and no assets, and needs `JAM-scramble-01` implemented first.

## Scope

**In:**

- Boost: holding `Shift` (`ShiftLeft` or `ShiftRight`) multiplies the scroll speed by `BOOST_SCROLL = 1.5` (the speed cap of 200 px/s applies before the multiplier, so the top boosted speed is 300 px/s) and adds an extra fuel cost of `BOOST_FUEL_PER_S = 2.0` per second on top of the distance cost. While boosting, the distance points double: 1 point per 5 px scrolled. Boost needs at least `BOOST_MIN_FUEL = 10` fuel to start and stops by itself when fuel falls under 10 or when `Shift` is released. Boost does not work while the ship is stalled or during a death freeze. The ship shows a longer flame while boosting.
- Ground turrets: a 24×14 px turret sits on the canyon floor on a flat pad, a floor stretch of 24 px (3 columns) where the heights differ by at most 2 px. A turret appears beyond the right edge every `600` to `900` px of scroll, only after the player has traveled `TURRET_START_DISTANCE = 1500` px. A turret that cannot find a flat pad in the next 200 px of terrain is skipped.
- Turret fire: while the horizontal distance `turret.x − ship.x` is between `−40` and `400` px, it fires one shot every `TURRET_PERIOD_S = 1.8` s, aimed at the ship position at the moment of firing (fixed direction, no homing), at `TURRET_SHOT_SPEED = 220` px/s relative to the canyon, radius `TURRET_SHOT_R = 4`. The barrel flashes for `0.25` s before each shot. A shot is removed when it touches the canyon or leaves the screen, and kills the ship on contact (same death rules as the core).
- Turret kill: a pulse that touches the turret box destroys it and gives `TURRET_POINTS = 150`. The ship touching a turret kills the ship.
- Immunity: during the `INVULN_S` of the core spec, turrets and turret shots keep working but do not kill the ship.
- Constants added to `constants.ts`: `BOOST_SCROLL = 1.5`, `BOOST_FUEL_PER_S = 2.0`, `BOOST_MIN_FUEL = 10`, `BOOST_POINTS_PER_PX = 0.2`, `TURRET_W = 24`, `TURRET_H = 14`, `TURRET_START_DISTANCE = 1500`, `TURRET_SPACING_MIN = 600`, `TURRET_SPACING_MAX = 900`, `TURRET_PERIOD_S = 1.8`, `TURRET_SHOT_SPEED = 220`, `TURRET_SHOT_R = 4`, `TURRET_POINTS = 150`.
- Key handling: `Shift` is added to the keys the engine reads; it is cleared on pause, on `blur` and on `stop` like the other keys.
- Drawing: turret as a dome and barrel on the floor, turret shots as small bright dots, boost flame. All primitives. Exact look is a detail for `/spec-impl` using `/frontend-design` (new in-canvas UI elements).

**Out of scope (for future specs):**

- Bombs, bosses, zones with different palettes, power-ups.
- Air enemies that shoot.
- Sound and music.
- Touch controls (a boost button), gamepad, skins.
- Any change to the HUD formats, the registry entry, the cover or the catalog row.
- Any other game.

## Data model

No new tables, no catalog row, no migration, no registry change, no new `localStorage` keys. The snapshot and HUD fields (`fuel`, `lives`) are the same as in `JAM-scramble-01`.

```ts
// lib/games/scramble/constants.ts (added)
const BOOST_SCROLL = 1.5, BOOST_FUEL_PER_S = 2.0, BOOST_MIN_FUEL = 10, BOOST_POINTS_PER_PX = 0.2; // 1 point per 5 px
const TURRET_W = 24, TURRET_H = 14, TURRET_START_DISTANCE = 1500;
const TURRET_SPACING_MIN = 600, TURRET_SPACING_MAX = 900;
const TURRET_PERIOD_S = 1.8, TURRET_SHOT_SPEED = 220, TURRET_SHOT_R = 4, TURRET_POINTS = 150;
```

Conventions:

- Fuel cost per second while boosting at the base speed of 120 px/s: the canyon moves 180 px/s, so `0.025 × 180 + 2.0 = 6.5` per second, against `3.0` per second without boost. At boost the player gains 36 points per second from distance, against 12 without boost.
- The distance score is accumulated as a float and only the whole part is added, so the score stays an integer.
- Turret positions are fixed in world coordinates and scroll with the canyon.

## Implementation plan

1. Add the constants and the `Shift` key to the input handling. Manual check: `npm run lint` and `npx tsc --noEmit` pass; the game still plays exactly as `JAM-scramble-01`.
2. Extend `engine.ts`: boost (scroll multiplier, fuel cost, double distance points, start threshold, auto-stop, disabled while stalled or dead). Manual check: lint and tsc pass.
3. Extend `terrain.ts` with a flat-pad finder (3 columns within 2 px) and `engine.ts` with turret spawning after 1500 px. Manual check: lint and tsc pass.
4. Extend `engine.ts`: turret fire (range, period, aimed shot, barrel flash), shot movement and collision, turret kill and points. Manual check: lint and tsc pass.
5. Extend the draw code for boost, turrets and turret shots. Use `/frontend-design` for the look. Manual check: all three read clearly at 375 px width.
6. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Holding `Shift` at the base speed scrolls the canyon at 180 px/s; releasing it returns to 120 px/s.
- [ ] While boosting, the HUD fuel drops about 6.5 per second at the base speed.
- [ ] While boosting, the score rises 36 points per second from distance at the base speed (1 point per 5 px); without boost it rises 12 per second.
- [ ] Boost does not start with fewer than 10 fuel, and it stops by itself when fuel falls under 10.
- [ ] Boost does nothing while the ship is stalled (fuel 0) or during the 0.8 s death freeze.
- [ ] `Shift` is released on pause, on window blur and on leaving the page: the canyon does not stay boosted after resuming.
- [ ] No turret appears before 1500 px of distance; after it, one appears every 600 to 900 px on a flat pad (3 columns within 2 px).
- [ ] A turret fires every 1.8 s while its horizontal distance to the ship is between −40 and 400 px, and its barrel flashes for 0.25 s before each shot.
- [ ] A turret shot kills the ship on contact (1 life) and disappears on touching the canyon or leaving the screen.
- [ ] A pulse that hits a turret destroys it and adds exactly 150 points.
- [ ] Touching a turret costs 1 life.
- [ ] During the 1.5 s immunity after a respawn, turret shots and turrets do not kill the ship.
- [ ] The fuel cells, drones, lives, game over, pause and saved scores behave as in `JAM-scramble-01`.
- [ ] No file outside `lib/games/scramble/` changes (no shell, registry, CSS, migration or `CLAUDE.md` change).
- [ ] The other five games still play exactly as before.
- [ ] No console errors on `/juegos/scramble/jugar` during a full session.

## Decisions

- **Yes:** boost costs fuel and doubles distance points. **No:** a free boost: there would be no trade-off.
- **Yes:** boost needs 10 fuel to start. **No:** boosting down to 0: the ship could stall by choice and crash.
- **Yes:** `Shift` for boost. **No:** a second action key: `Space` stays the only weapon.
- **Yes:** turrets only after 1500 px and only on flat pads. **No:** turrets from the start or on slopes: a turret on a slope looks and plays wrong.
- **Yes:** one aimed, non-homing shot at 220 px/s. **No:** homing or rapid fire: the player could not learn to dodge.
- **Yes:** the pulse is the only way to kill a turret. **No:** bombs: out of scope and not needed.
- **Yes:** turrets give 150 points, more than drones (100), because the player must fly low to reach them. **No:** equal points.
- **Yes:** no shell, registry, cover or catalog change. **No:** a second catalog row: one game has one row.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file (done in the core spec). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Boost makes fuel cells harder to catch (faster scroll, less reaction time) | Boost is optional and stops under 10 fuel; cell spacing is in px, not seconds.                        |
| No flat pad in the generated canyon                                       | Skip the turret after 200 px of search; the next spawn tries again.                                    |
| A turret shot is unavoidable right after a respawn                        | 1.5 s of immunity after a respawn covers turret shots too.                                             |
| Shift stuck after a window switch                                         | Clear it on `setPaused`, on `window` blur and on `stop`.                                               |
| Distance points lose the integer after boost                              | Accumulate points as a float and add only the whole part; the score stays an integer.                  |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components. |

## What is **not** in this spec

- Bombs, bosses, zones with different palettes and power-ups.
- Air enemies that shoot.
- Sound and music.
- Touch controls, gamepad and skins.
- Any change to the HUD formats, the registry entry, the cover or the catalog row.
- Any other game.

Each one of those, if it lands, goes in its own spec.
