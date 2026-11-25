# SPEC JAM-missile-defense-02 — Missile Defense threats and city rebuilding (MISSILE-DEFENSE)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-missile-defense-01
> **Date:** 2026-11-25
> **Objective:** Add splitting and fast enemy missiles plus a city rebuild every fifth wave to MISSILE DEFENSE, so later waves demand new tactics and long runs can recover.

## Why this spec exists

The core game has one kind of missile and no way to recover a lost city, so every wave plays alike and a bad early wave decides the run. This spec adds two new threats (a missile that splits and a very fast one) and a rule that rebuilds one city every 5 waves. It changes only `lib/games/missile-defense/`; the shell, registry entry, HUD fields and catalog row are untouched.

This is a jam spec: it is not numbered yet. It is promoted after `JAM-missile-defense-01`.

## Scope

**In:**

- Wave composition: the wave size stays `min(6 + 2 × (n − 1), 30)` from the core. In wave `n`, `splitters = floor(0.20 × size)` when `n ≥ 3` (else 0), `fast = floor(0.10 × size)` when `n ≥ 5` (else 0), and the rest are standard missiles. Spawn times stay random inside the 12 s window; the kind of each spawn is shuffled.
- Missile kinds:

  | Kind       | Speed                               | Points | Behaviour                                                                  |
  | ---------- | ----------------------------------- | ------ | -------------------------------------------------------------------------- |
  | `standard` | `min(40 + 6 × (n − 1), 120)` px/s   | 25     | As in the core                                                             |
  | `splitter` | same as `standard`                  | 50     | At `y = 220` it splits into 3 `standard` children, then the parent is gone |
  | `fast`     | `min(3 × standard speed, 240)` px/s | 40     | Straight line to its target; trail drawn in a different color              |

- Splitter rules: before the split it can be destroyed by a blast for 50 points and no children. At the split, each of the 3 children starts at the parent position and picks its own target among the cities alive at that moment (random, repeated targets allowed), with the standard speed of the wave. Children give 25 each. The splitter counts as one of the wave's missiles; its children do not count toward the wave size, but the wave does not end until they are resolved.
- Chain blasts follow the core rule for every kind (a destroyed missile spawns a 26-radius blast).
- City rebuild: when a wave `n` with `n % 5 == 0` ends (after the wave bonus is added), one destroyed city is rebuilt, the leftmost destroyed one by x. The HUD `cities` goes up by 1. If no city is destroyed, nothing happens and no points are added.
- Drawing: splitters are drawn with a wider head, and a small flash at the split; fast missiles with a bright long trail; a rebuilt city draws a short build-in animation of 0.5 s (part of the world). Exact art is a detail for `/spec-impl`; any new UI element in the world uses `/frontend-design`.
- All new state clears on restart and game over.
- `CLAUDE.md` update: one line noting that MISSILE-DEFENSE has splitter and fast missiles and rebuilds a city every fifth wave. No change to the `games` table row.

**Out of scope (for future specs):**

- A second turret or turret damage.
- Bonus items, smart bombs or special ammo.
- Bombers and enemies that shoot back.
- A HUD field for the rebuild countdown (the HUD stays `cities` and `wave`).
- Sound, touch controls, skins, gamepad.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no second catalog row and no migration. The registry entry and the snapshot stay exactly as in JAM-missile-defense-01: `{ score, state, hud: { cities, wave } }`.

```ts
// lib/games/missile-defense/constants.ts (added)
type MissileKind = "standard" | "splitter" | "fast";
const MISSILE_KINDS: Record<MissileKind, { speedMul: number; points: number }> = {
  standard: { speedMul: 1, points: 25 },
  splitter: { speedMul: 1, points: 50 },
  fast:     { speedMul: 3, points: 40 },
};
const FAST_SPEED_MAX = 240;
const SPLIT_Y = 220, SPLIT_COUNT = 3;
const SPLITTER_FROM_WAVE = 3, SPLITTER_SHARE = 0.20, FAST_FROM_WAVE = 5, FAST_SHARE = 0.10;
const REBUILD_EVERY = 5, REBUILD_ANIM = 0.5;
```

Conventions:

- The core `ENEMY_POINTS` (25) is the points of `standard`; it is not duplicated elsewhere.
- The enemy record gains a `kind` field and, for children, `spawnedBySplit: true` (children do not count toward the wave size).
- Wave composition is computed once at wave start and stored as a shuffled list of kinds.
- Score stays an integer between 0 and 10,000,000.

## Implementation plan

1. Add the constants and kind table to `constants.ts`. Manual check: `npm run lint` passes.
2. Refactor the core missile code to read speed and points from `MISSILE_KINDS`, with no behaviour change. Manual check: waves 1 and 2 behave exactly as in the core criteria (6 missiles at 40 px/s, 8 at 46 px/s).
3. Add wave composition (splitters from wave 3, fast from wave 5) and the fast missile speed and cap. Manual check: with a temporary debug start at wave 5 (not committed), fast missiles cross the screen in about 2.9 s (560 px at 192 px/s).
4. Add the splitter split at `y = 220`, child targeting and the wave-end rule that waits for children. Manual check: a splitter that is not shot makes 3 children and the wave does not end early.
5. Add the rebuild on waves 5, 10 and so on, with the animation. Manual check: with a city destroyed, clearing wave 5 brings HUD cities up by 1.
6. Update `CLAUDE.md`, then run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Waves 1 and 2 are identical to JAM-missile-defense-01: 6 and 8 standard missiles, no splitters, no fast missiles.
- [ ] Wave 3 (size 10) spawns exactly 2 splitters and 8 standard missiles, and no fast missiles.
- [ ] Wave 5 (size 14) spawns exactly 2 splitters (`floor(2.8)`), 1 fast missile (`floor(1.4)`) and 11 standard missiles.
- [ ] A fast missile moves at `min(3 × standard speed, 240)` px/s (wave 5: 3 × 64 = 192 px/s) and gives 40 when destroyed.
- [ ] A splitter destroyed above `y = 220` gives 50, spawns no children, and its chain blast has max radius 26.
- [ ] A splitter that reaches `y = 220` becomes exactly 3 standard children at that point, each aimed at a random living city, and the parent disappears.
- [ ] Each child gives 25 when destroyed; the wave size stays the core value (children are not counted).
- [ ] A wave does not end while any child, missile, interceptor or blast remains.
- [ ] Ending wave 5 with 2 destroyed cities adds the normal wave bonus and then rebuilds exactly one city (the leftmost destroyed); HUD cities goes up by 1; the 0.5 s build animation plays.
- [ ] Ending wave 5 with 4 cities alive rebuilds nothing and adds no extra points.
- [ ] Ending waves 1 to 4 and 6 to 9 never rebuilds a city.
- [ ] Losing the last city ends the game before any rebuild; no rebuild happens after game over.
- [ ] Pausing freezes splitters, children and the rebuild animation; resuming has no jump.
- [ ] JUGAR DE NUEVO clears all kinds, children and animations and returns to wave 01 with 4 cities.
- [ ] The HUD still shows only `Ciudades` and `Oleada`; the registry entry and the `games` row are unchanged.
- [ ] No console errors during a full session through wave 6.
- [ ] The five existing games still play exactly as before.

## Decisions

- **Yes:** kind table in `constants.ts`, behaviour in `engine.ts`. **No:** a second engine file: one closure is enough.
- **Yes:** the wave size is unchanged; new kinds replace standard missiles inside it. **No:** extra missiles on top: it would break the core balance.
- **Yes:** splitters at wave 3 and fast missiles at wave 5, fixed shares. **No:** random composition: scores become less comparable.
- **Yes:** children do not count toward the wave size but block the wave end. **No:** counting them: the wave table would depend on player skill.
- **Yes:** the rebuild is one city every fifth wave, leftmost first. **No:** a rebuild by score: it needs a HUD counter the brief does not include.
- **Yes:** no points for the rebuild. **No:** points for rebuilding: it would reward losing cities.
- **Yes:** the HUD stays as in the core. **No:** a new HUD field: it would change the registry and diverge from the planner brief.
- **Yes:** no second catalog row and no migration. **No:** a new game row for a feature.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                | Mitigation                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Refactoring the core missile code changes behaviour                 | Step 2 is a pure refactor with the core criteria for waves 1 and 2 as the check.                  |
| A fast missile at 192 to 240 px/s is hard to intercept              | Blasts last 1.0 s and reach 44 px; leading the target works; numbers are constants for tuning.    |
| Three children appear next to a city and cannot be stopped          | Split height 220 leaves about 340 px of fall; 3 children are the only burst; split is a constant. |
| The wave never ends because of children                             | Children are normal missiles with a finite path; the wave-end check counts them.                  |
| Rebuilding the leftmost city is predictable                         | Accepted: it is deterministic so scores stay comparable.                                          |
| New art needs UI design                                             | `/spec-impl` uses `/frontend-design` for the shapes; this spec fixes only gameplay values.        |

## What is **not** in this spec

- A second turret or turret damage.
- Bonus items, smart bombs and special ammo.
- Bombers and enemies that shoot back.
- A HUD field for the rebuild countdown.
- Sound, touch controls, skins and gamepad.
- Any other game.

Each one of those, if it lands, goes in its own spec.
