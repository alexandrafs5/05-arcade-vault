# SPEC JAM-missile-defense-02 — Missile Defense splitting warheads and bombers

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-missile-defense-01
> **Date:** 2026-11-19
> **Objective:** Add splitting warheads and bomber ships to MISSILE DEFENSE, so later waves need new tactics instead of only more of the same warheads.

## Why this spec exists

The core game only escalates count and speed of identical warheads. This feature adds two enemy types that change how the player aims: a splitter that becomes three warheads if it is not stopped early, and a bomber that crosses the sky dropping warheads and must be hit before it empties its payload. Both are engine rules and drawings; the shell, the catalog row and the HUD do not change.

This is a jam spec: it is not numbered yet. It can only be promoted after the core spec (JAM-missile-defense-01) is implemented.

## Scope

**In:**

- Splitters and bombers in `lib/games/missile-defense/engine.ts`, with their constants in `constants.ts`.
- Per-enemy base points with the `n` multiplier of the core spec (the n-th enemy destroyed by one blast pays `base × n`).
- Drawing of both enemy types with primitives, no assets.
- Rules:
  - Splitter: appears from wave `SPLIT_FROM_WAVE = 4`. A wave has `min(4, w - 3)` splitters; they replace normal warheads inside the wave count (the count formula of the core spec does not change). A splitter is a yellow `#ffd400` diamond 12 px wide, falls at the normal warhead speed toward a random alive city, and at a random altitude `y ∈ [140, 220]` (picked at spawn) splits into `SPLIT_CHILDREN = 3` normal warheads at that point. Each child targets its own random alive city and has the normal warhead speed. Children do not split. A splitter destroyed before it splits is one kill worth `SPLITTER_POINTS = 50` (base); children are worth 25 each.
  - Bomber: appears from wave `BOMBER_FROM_WAVE = 6`. One bomber per wave, 2 from wave `BOMBER_DOUBLE_WAVE = 10`. The first appears 3.0 s after the wave starts, the second 9.0 s after. A bomber is a 40×14 px magenta-and-white ship at `y = 70`, enters from a random side at `BOMBER_SPEED = 90` px/s and leaves on the opposite side. While its `x` is in `[40, 600]` it drops one normal warhead every `BOMBER_DROP_S = 1.5` s from its current position, aimed at a random alive city. Dropped warheads do not count in the wave size. A bomber is destroyed when a blast circle overlaps its rectangle; it is worth `BOMBER_POINTS = 100` (base).
  - A wave ends only when all its warheads, splitters, children, bombers and dropped warheads have been spawned and none is alive (a bomber that left the screen counts as gone).
  - Splitters and bombers never damage cities directly: only warheads do, as before.
- `CLAUDE.md` update: add "splitters, bombers" to the `missile-defense` canvas notes in the Games table.

**Out of scope (for future specs):**

- Sound and music.
- Keyboard fire, touch controls, gamepad.
- More enemy types (fast scouts, armored warheads), extra turrets, upgrades.
- Skins.
- Realtime scores, auth-linked scores.
- Automated tests.

## Data model

No catalog row, no migration, no new tables, no new `localStorage` keys, no registry change. The HUD stays `cities` and `wave`; the snapshot shape is unchanged.

```ts
// Added to lib/games/missile-defense/constants.ts
const SPLIT_FROM_WAVE = 4, SPLIT_MAX = 4, SPLIT_CHILDREN = 3;
const SPLIT_Y_MIN = 140, SPLIT_Y_MAX = 220;
const SPLITTER_POINTS = 50;
const BOMBER_FROM_WAVE = 6, BOMBER_DOUBLE_WAVE = 10;
const BOMBER_Y = 70, BOMBER_SPEED = 90, BOMBER_DROP_S = 1.5;
const BOMBER_W = 40, BOMBER_H = 14, BOMBER_POINTS = 100;
const BOMBER_DELAYS = [3.0, 9.0];       // seconds after wave start
```

```ts
// Entity changes in the engine closure
// warheads: { ..., kind: "warhead" | "splitter", splitY?: number }
// bombers: { x: number; dir: 1 | -1; dropTimer: number }
// the base points per kind: warhead 25, splitter 50, bomber 100
```

Conventions:

- The kill multiplier per blast counts all kinds together. Within one frame, kills are resolved in list order: warheads and splitters first, then bombers. A warhead then a bomber in the same blast pay `25 × 1` and `100 × 2`.
- Wave bonus, rebuild rule and spawn timing of the core spec are unchanged.

## Implementation plan

1. Add the constants above to `lib/games/missile-defense/constants.ts`. Manual check: `npm run lint` passes.
2. Engine: splitter kind in the spawner (replaces normal warheads, `splitY`), split behavior and children targeting. Manual check: in wave 4 one yellow diamond splits into three warheads between `y = 140` and `y = 220`.
3. Engine: bomber spawn schedule, movement, drop timer, blast-vs-rectangle test, wave-end rule. Manual check: from wave 6 a bomber crosses at `y = 70` and drops a warhead every 1.5 s.
4. Engine: generalize the per-blast kill multiplier to base points per kind. Manual check: killing a warhead and a bomber in one blast adds 25 and 200.
5. Draw: splitter diamond and bomber ship with primitives. Manual check: both are distinguishable from the 8 px magenta warhead; no `shadowBlur` in the loop.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

The new art is small primitive drawing inside the canvas, so `/frontend-design` is not required.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Waves 1 to 3 have no splitters and no bombers.
- [ ] Wave 4 has exactly 1 splitter, wave 5 has 2, wave 7 has 4 and wave 12 has 4; the wave size (`6 + 2 × (w - 1)`, capped at 30) does not change.
- [ ] A splitter that reaches its split altitude (between `y = 140` and `y = 220`) turns into 3 warheads, each aimed at an alive city.
- [ ] A splitter destroyed before splitting adds 50 points and creates no warheads.
- [ ] Waves 1 to 5 have no bombers; wave 6 has 1, appearing 3.0 s after the wave starts at `y = 70`; wave 10 has 2, at 3.0 s and 9.0 s.
- [ ] A bomber moves at 90 px/s and drops one warhead every 1.5 s only while its `x` is in `[40, 600]`.
- [ ] A bomber destroyed by a blast adds 100 points; a warhead and a bomber destroyed by the same blast add 25 and 200.
- [ ] Dropped warheads and split children do not change the wave size, and the wave does not end while any of them is alive.
- [ ] A bomber that leaves the screen is removed and the wave can end.
- [ ] The HUD fields are still `cities` and `wave`; the shell and the registry are unchanged.
- [ ] Score, game over, pause, restart and unmount behave as in the core spec; after 3 restarts no bomber or splitter remains.
- [ ] No console errors during a full session.

## Decisions

- **Yes:** splitters replace normal warheads in the wave count. **No:** adding them on top: the wave size would grow faster than the core balance.
- **Yes:** children do not split again. **No:** recursive splitting: it can flood the screen.
- **Yes:** bombers drop normal warheads that do not count in the wave size. **No:** bombs that hit cities directly: the city rule stays single.
- **Yes:** base points per kind (25, 50, 100) with the core `n` multiplier. **No:** a second multiplier system.
- **Yes:** first appearance in wave 4 (splitters) and wave 6 (bombers). **No:** all types from wave 1: players need to learn the core first.
- **Yes:** no second catalog row; this spec reuses the core row and cover. **No:** a new game entry.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data; code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                      | Mitigation                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Too many warheads at once after splits at high waves      | Splitters capped at 4 per wave and children at 3; the cap on wave size stays 30.                   |
| Wave never ends because a bomber stays alive              | A bomber always leaves the screen: its speed is constant and it is removed past the opposite edge. |
| Blast-vs-rectangle test is wrong near the corners         | Use the closest-point-on-rectangle distance against the blast radius.                              |
| Kill multiplier order is ambiguous in one frame           | Resolve kills in list order: warheads and splitters first, then bombers.                           |
| State left over after restart                             | `reset` clears warheads, bombers and timers; criterion checks it after 3 restarts.                 |

## What is **not** in this spec

- Sound and music.
- Keyboard fire, touch controls and gamepad.
- More enemy types, extra turrets and upgrades.
- Skins.
- Realtime scores and auth-linked scores.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
