# SPEC JAM-dragrush-02 — Moto Drag Rush race conditions, nitrous and rival styles

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-dragrush-01
> **Date:** 2026-11-19
> **Objective:** Add rotating race conditions, a one-shot nitrous boost and varied rival pacing to MOTO DRAG RUSH, so consecutive races play differently.

## Why this spec exists

The planner flagged repetition as the main risk of a drag-race game. In the core spec every race is the same 400 m with the same rules and only a faster rival. This feature makes each race ask a different question: a wet track that slows the bike, a hot engine with a narrow shift window and a bigger reward, a nitrous charge to spend at the right moment, and a rival that does not always accelerate the same way. Everything is engine rules and primitive drawing; the shell, the catalog row and the HUD do not change.

This is a jam spec: it is not numbered yet. It can only be promoted after the core spec (JAM-dragrush-01) is implemented.

## Scope

**In:**

- Race conditions, nitrous and rival styles in `lib/games/dragrush/engine.ts`, with constants in `constants.ts`.
- Condition drawing (rain, puddles, haze, a gantry sign with the condition name in Spanish) with primitives, no assets.
- Rules:
  - Conditions rotate by lap: condition index is `(lap - 1) % 3`: 0 `DRY` (laps 1, 4, 7, ...), 1 `WET` (laps 2, 5, ...), 2 `HOT` (laps 3, 6, ...).
  - `DRY`: the core rules, no change.
  - `WET`: all `ACCEL_G` values are multiplied by `WET_ACCEL = 0.92`, and the rival time is `T(lap) + WET_RIVAL_BONUS` with `WET_RIVAL_BONUS = 0.45` s. A win in this condition adds `CONDITION_BONUS = 250` points.
  - `HOT`: the perfect shift window is `[0.90, 0.96]`, the perfect boost is `HOT_BOOST = 1.25` for 0.8 s and a perfect shift gives `HOT_PERFECT_POINTS = 150`. The rival time is `T(lap)`. A win adds `CONDITION_BONUS = 250` points.
  - Nitrous: from lap `NITRO_FROM_LAP = 4`, every race starts with one nitrous charge. Press `↓` or `S` after green to use it: the acceleration is multiplied by `NITRO_ACCEL = 1.30` for `NITRO_S = 1.2` s (it multiplies with a perfect boost, so both together give 1.30 × 1.15 = 1.495 in `DRY`). The key is ignored before green, with no charge left, and on auto-repeat. The charge is not carried to the next race. Nitrous does not remove the rev limiter or the shift lag.
  - Rival styles rotate by lap: style index is `(lap - 1) % 4`: 0 `steady`, 1 `closer`, 2 `steady`, 3 `sprinter`. The ghost distance is `400 × (t / T)^p` with `p = 2.0` for `steady`, `p = 2.4` for `closer` (slow start, fast finish) and `p = 1.6` for `sprinter` (fast start, slow finish). The finish time stays exactly `T`.
  - The final rival time and the rules of winning, losing and scoring from the core spec are unchanged; only the rival time (`WET`), the perfect shift values (`HOT`) and the bonuses above differ.
- Drawing: `WET` shows 60 diagonal rain streaks, darker asphalt `#101a22` and 3 puddle highlights on the track; `HOT` shows an orange-tinted sky gradient `#2a1000` to `#0d2a1c` and a faint haze band over the horizon; a gantry above the start line shows the sign `SECO`, `MOJADO` or `MOTOR CALIENTE`; a small flame appears behind the bike during nitrous; a small `N` light near the tachometer is lit while a charge is available. No `shadowBlur` in the loop.
- `CLAUDE.md` update: add "race conditions, nitrous" to the `dragrush` canvas notes in the Games table.

**Out of scope (for future specs):**

- More conditions (headwind, night), downshifting, clutch, upgrades.
- Sound and music.
- Touch controls, on-screen gamepad, gamepad support.
- Skins.
- Realtime scores, auth-linked scores.
- Automated tests.

## Data model

No catalog row, no migration, no new tables, no new `localStorage` keys, no registry change. The HUD stays `gear` and `lap`; the snapshot shape is unchanged.

```ts
// Added to lib/games/dragrush/constants.ts
const CONDITIONS = ["DRY", "WET", "HOT"] as const;
const WET_ACCEL = 0.92, WET_RIVAL_BONUS = 0.45;
const HOT_PERFECT_MIN = 0.90, HOT_PERFECT_MAX = 0.96;
const HOT_BOOST = 1.25, HOT_PERFECT_POINTS = 150;
const CONDITION_BONUS = 250;
const NITRO_FROM_LAP = 4, NITRO_ACCEL = 1.3, NITRO_S = 1.2;
const RIVAL_STYLES = [2.0, 2.4, 2.0, 1.6];      // exponent p per (lap - 1) % 4
const CONDITION_NAMES = { DRY: "SECO", WET: "MOJADO", HOT: "MOTOR CALIENTE" };
```

```ts
// Engine state added to the closure
// condition: "DRY" | "WET" | "HOT"; rivalExponent: number
// nitroCharge: boolean; nitroTimer: number
```

Conventions:

- Condition, rival style and nitro charge are chosen in the race `reset` for the current lap; nothing is stored between sessions.
- The perfect-shift window and boost read the active condition; the core constants `PERFECT_MIN`, `PERFECT_MAX` and `PERFECT_BOOST` stay as they are for `DRY` and `WET`.
- Rival time for a lap is `T(lap) + (WET ? 0.45 : 0)`; the floor of the core spec (12.00 s) applies before the wet bonus.

## Implementation plan

1. Add the constants above to `lib/games/dragrush/constants.ts`. Manual check: `npm run lint` passes.
2. Engine: condition by lap, wet acceleration and rival time, hot window, boost and points, condition bonus on win. Manual check: in lap 2 the rival finishes at 14.45 s; in lap 3 a shift at `r = 0.89` gives no bonus.
3. Engine: nitrous charge, key `↓` / `S`, timer and acceleration multiplier. Manual check: from lap 4 pressing `↓` after green raises the acceleration by 30% for 1.2 s.
4. Engine: rival style exponent per lap. Manual check: in lap 4 the ghost leads early and finishes exactly at the rival time.
5. Draw: rain, puddles, haze, gantry sign, nitrous flame, `N` light. Manual check: the sign text matches the condition; no frame drops.
6. Tuning pass: a scripted ideal `WET` run (shifts at `r = 0.93`) finishes at least 0.20 s under the wet rival time of lap 7 (12.45 s); if it does not, change only `WET_RIVAL_BONUS`. Manual check: the measured time is written in the commit message.
7. Update `CLAUDE.md`.
8. Run `npm run lint` and `npm run build`.

The condition art is primitive drawing inside the canvas, so `/frontend-design` is not required.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Laps 1, 4 and 7 are `DRY`, laps 2 and 5 are `WET` and laps 3 and 6 are `HOT`; the gantry sign shows `SECO`, `MOJADO` or `MOTOR CALIENTE` accordingly.
- [ ] In `WET` the bike acceleration is 92% of `DRY` in every gear and the rival time is `T(lap) + 0.45` (lap 2 is 14.45 s, lap 7 is 12.45 s).
- [ ] A scripted ideal `WET` run (shifts at `r = 0.93`) finishes at least 0.20 s under 12.45 s.
- [ ] In `HOT` a shift at `r = 0.90` and at `r = 0.96` is perfect (150 points, 1.25× acceleration for 0.8 s); a shift at `r = 0.89` or `r = 0.97` adds nothing.
- [ ] A win in `WET` or `HOT` adds 250 points on top of the core win score; a win in `DRY` adds none.
- [ ] Nitrous is not available in laps 1 to 3; from lap 4 each race starts with one charge and the `N` light is on.
- [ ] Pressing `↓` / `S` after green uses the charge: acceleration × 1.30 for 1.2 s, the light turns off and a flame shows behind the bike.
- [ ] The nitrous key is ignored before green, with no charge, and on key auto-repeat; the charge does not carry to the next race.
- [ ] Nitrous together with a perfect shift in `DRY` gives an acceleration factor of 1.495 during the overlap.
- [ ] Nitrous does not skip the 0.12 s shift lag and does not raise the speed above the gear top speed.
- [ ] Rival ghost distance at `t = T / 2` is 100 m for `steady`, 75.8 m ± 0.5 for `closer` (lap 2) and 132.0 m ± 0.5 for `sprinter` (lap 4); in all styles the ghost reaches 400 m at exactly `T`.
- [ ] The HUD fields are still `gear` and `lap`; the shell and the registry are unchanged.
- [ ] Score, game over, pause, restart and unmount behave as in the core spec; after 3 restarts the condition is `DRY`, lap is 01 and no nitrous charge exists.
- [ ] No console errors during a full session.

## Decisions

- **Yes:** three conditions in a fixed 3-lap cycle so the player can learn them. **No:** random conditions: a bad draw would feel unfair on a game-ending race.
- **Yes:** `WET` is slower but the rival gets +0.45 s, so the race is balanced. **No:** a slower bike with the same rival: it would be a hidden difficulty spike.
- **Yes:** `HOT` has a narrower window with a bigger boost and points (risk and reward). **No:** only a penalty.
- **Yes:** +250 on a win in `WET` and `HOT`. **No:** more per condition: the margin in milliseconds already scores skill.
- **Yes:** nitrous from lap 4, one charge per race on `↓` / `S`. **No:** from lap 1: players need to learn shifting first. **No:** `Space`: it can activate a focused shell button.
- **Yes:** nitrous keeps the shift lag and the limiter. **No:** letting it bypass them: it would break the shifting skill.
- **Yes:** three rival exponents with the same finish time. **No:** different finish times per style: the lap table of the core spec stays the only source of `T`.
- **Yes:** condition name drawn on a gantry inside the canvas. **No:** a new HUD field: the HUD is fixed to gear and lap and a new field needs shell work.
- **Yes:** no second catalog row; this spec reuses the core row and cover. **No:** a new game entry.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data; code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `WET` is too hard or too easy                                             | Plan step 6 measures an ideal run and tunes only `WET_RIVAL_BONUS`.                                  |
| The `closer` rival looks unbeatable early and the player lifts the throttle | The ghost distance and the rival time are in the finish board; the criterion fixes the distances.  |
| Nitrous combined with boost makes an easy shortcut                        | One charge per race, 1.2 s, and the limiter and shift lag stay.                                      |
| Rain and haze cost frame time                                             | Streaks are plain lines (60 max), no `shadowBlur`, no per-frame gradients rebuilt.                   |
| State left over after restart                                             | `reset` recomputes condition, exponent and charge from the lap; criterion checks it after 3 restarts. |

## What is **not** in this spec

- More conditions, downshifting, clutch and upgrades.
- Sound and music.
- Touch controls, on-screen gamepad and gamepad support.
- Skins.
- Realtime scores and auth-linked scores.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
