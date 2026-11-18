# SPEC JAM-dragrush-02 — Drag Rush nitro, perfect-shift combo and rival tiers

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-dragrush-01
> **Date:** 2026-11-18
> **Objective:** Add a nitro boost charged by perfect shifts, a perfect-shift combo multiplier and three named rival tiers to DRAG RUSH, so every race has a decision beyond the shift timing.

## Why this spec exists

`JAM-dragrush-01` ships a playable one-key timing game. Its main risk is repetition: every race asks for the same four shifts. This spec is the theme layer: a nitro bottle the player earns by shifting well and chooses when to burn, a combo that makes a clean race worth much more than a sloppy one, and rival tiers that change how the rival behaves and looks every five races.

The result is a distinct ruleset of the same game: same strip, bike, gearbox and leaderboard, with a second key and a deeper score. It only changes files under `lib/games/dragrush/` and the `dragrush` entry in `lib/games/registry.ts`. It inserts no catalog row and does not touch the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it is re-checked against the promoted core spec.

## Scope

**In:**

- Nitro charge: the meter `nitro` goes from 0 to 1 and resets to 0 at the start of every race. A perfect launch adds `NITRO_PER_PERFECT = 0.25`; each perfect shift adds `0.25`. A full meter needs four perfect events.
- Nitro use: `X` burns the meter. It needs `nitro ≥ 0.5` at the press; below that the press is ignored. While burning, `ACCEL × power(rpm)` is multiplied by `NITRO_BOOST = 1.35` and the meter drains at `1 / NITRO_MAX_SECONDS` per second with `NITRO_MAX_SECONDS = 2.0` (a full meter burns for 2.0 s, a half meter for 1.0 s). Burning ends when the meter reaches 0, at the finish, or on a new race. The shift lock (`SHIFT_LOCK`) still cuts thrust, including the boost. Perfect events during a burn still charge the meter.
- Combo: `perfectShifts` is replaced by a streak. Each perfect shift in the same race adds `100 × streak` points on a win, with `streak` counting consecutive perfect shifts (1, 2, 3, 4), so four in a row pay `100 + 200 + 300 + 400 = 1000`. A shift outside the green zone resets `streak` to 0 (the points already earned stay). The perfect launch does not count in the streak. The core formula becomes `score += 500 + floor(margin × 500) + comboPoints + (perfect launch ? 200 : 0)`.
- Rival tiers (by `lap`):

  | Laps  | Tier key  | Label (drawn near the rival) | Rival color | `RIVAL_REACTION` (s) |
  | ----- | --------- | ---------------------------- | ----------- | -------------------- |
  | 1–5   | `amateur` | `AMATEUR`                    | `#ff006e`   | 0.30                 |
  | 6–10  | `pro`     | `PRO`                        | `#ffae00`   | 0.22                 |
  | 11+   | `elite`   | `ELITE`                      | `#f5ff00`   | 0.15                 |

- Rival times: `RIVAL_MIN_TIME` changes from 9.00 s to 8.60 s so a nitro run can still beat the floor race by race. `RIVAL_BASE_TIME` (11.80 s) and `RIVAL_STEP` (0.20 s) do not change. Race 17 and later are 8.60 s. The rival curve exponent (1.4) does not change.
- Tuning: the core windows are updated. Shifting inside the green zone every time with a perfect launch and no nitro still finishes between 9.05 s and 9.35 s; the same run with a full-meter nitro burned from the start of gear 3 finishes between 8.60 s and 8.95 s. `NITRO_BOOST` is the tuning constant.
- HUD: new field `nitro` (`number`, `initial: 0`), the meter as a percentage `round(nitro × 100)`, 0–100. Registry entry updated with a third field after `lap`; nothing else in the shell.
- Drawing (primitives only): a nitro bar under the tachometer (cyan, with a tick at 50 % marking the minimum to burn); a flame behind the player bike while burning; the tier label above the rival and the rival color from the table; a short "+N" combo text above the tachometer for 0.6 s after each perfect shift. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: Games table row `dragrush`, HUD column now gear (`number`), lap (`pad2`), nitro (`number`).

**Out of scope (for future specs):**

- More tiers, tier-specific rival behaviour beyond the reaction time, rival names or portraits.
- Several nitro bottles per race or nitro carried between races.
- Bike upgrades, several tracks or distances.
- Sound and music.
- Touch mapping for nitro (button B = `X`, done later by `@mobile-porter`).
- Skins and bitmap sprites.
- Realtime scores, auth-linked scores.
- New catalog copy: the core `long` text stays.

## Data model

No new tables, no new catalog row, no new `localStorage` keys.

```ts
// HUD fields in lib/games/registry.ts (replaces the core list)
hud: [
  { key: "gear", label: "Marcha", format: "number", initial: 1 },
  { key: "lap", label: "Vuelta", format: "pad2", initial: 1 },
  { key: "nitro", label: "Nitro", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { gear, lap, nitro } }
```

```ts
// lib/games/dragrush/constants.ts (additions and changes)
const NITRO_PER_PERFECT = 0.25;
const NITRO_MIN_TO_BURN = 0.5;
const NITRO_MAX_SECONDS = 2.0;
const NITRO_BOOST = 1.35; // starting value, see tuning step
const RIVAL_MIN_TIME = 8.6; // was 9.0
const TIERS = [
  { key: "amateur", label: "AMATEUR", from: 1, color: "#ff006e", reaction: 0.3 },
  { key: "pro", label: "PRO", from: 6, color: "#ffae00", reaction: 0.22 },
  { key: "elite", label: "ELITE", from: 11, color: "#f5ff00", reaction: 0.15 },
];
```

Conventions:

- `nitro` is kept as a float 0–1 in the engine; the HUD value is `round(nitro × 100)`. `onChange` fires when the rounded value changes, so it fires at most about 100 times per burn, not per frame.
- The nitro key is `KeyX` (and `x` / `X`), chosen to match the SPEC 10 button B mapping used by Tetris. `preventDefault` is not needed for `X`.
- The tier is derived from `lap` each race; it is not stored.

## Implementation plan

1. Extend `constants.ts` with the nitro constants, the `TIERS` table and `RIVAL_MIN_TIME = 8.6`. Manual check: `npm run lint` passes.
2. Extend `engine.ts`: nitro meter (charge on perfect events, reset per race), burn rule (`X`, minimum 0.5, drain, boost), `streak` combo and the new win formula, tier lookup for rival reaction and color. Manual check: `npx tsc --noEmit` passes.
3. Extend the snapshot with `hud.nitro` and add the field to the `registry.ts` entry. Manual check: `/juegos/dragrush/jugar` shows a third HUD item `Nitro` at 0 and it rises after a perfect shift.
4. Extend the draw: nitro bar, flame, tier label, combo text. Manual check: lint and tsc pass; the bar, flame and label are visible during a race.
5. Tuning step: set `NITRO_BOOST` so the two windows in Scope hold. Manual check: three consecutive scripted runs inside each window; remove any temporary log.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

New UI is limited to canvas drawing of existing shapes; the shell is unchanged. If `/spec-impl` decides the nitro bar needs a designed look, it must use `/frontend-design`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No second `games` row is inserted and no file outside `lib/games/dragrush/`, `lib/games/registry.ts` and `CLAUDE.md` changes.
- [ ] The HUD shows `Marcha`, `Vuelta` and `Nitro`; `Nitro` starts at 0 and returns to 0 at the start of each race and after JUGAR DE NUEVO.
- [ ] A perfect launch raises `Nitro` to 25; each perfect shift adds 25 more up to 100; a shift outside the green zone adds 0.
- [ ] Pressing `X` with `Nitro` below 50 does nothing; with 50 or more it starts the burn and shows the flame.
- [ ] A burn from `Nitro` 100 lasts 2.0 s (±0.05 s) and drains the HUD value to 0; a burn from 50 lasts 1.0 s (±0.05 s).
- [ ] While burning, speed gain per second is 1.35 times the same gear and rpm without a burn.
- [ ] A burn ends at the finish line and does not carry into the next race.
- [ ] Four perfect shifts in a row add `100 + 200 + 300 + 400 = 1000` points on a win; a non-perfect shift in the middle resets the streak so the next perfect shift is worth 100.
- [ ] The perfect launch adds 200 points and does not count in the streak.
- [ ] Shifting perfectly every time with a perfect launch and no nitro finishes between 9.05 s and 9.35 s; the same run with a full-meter nitro burned from the start of gear 3 finishes between 8.60 s and 8.95 s.
- [ ] The rival finish time is 11.80 s in race 1, 8.80 s in race 16 and 8.60 s in race 17 and every later race.
- [ ] The rival label and color are `AMATEUR` `#ff006e` in laps 1–5, `PRO` `#ffae00` in laps 6–10 and `ELITE` `#f5ff00` from lap 11; the rival starts moving 0.30 s, 0.22 s and 0.15 s after green in those tiers.
- [ ] Winning a race adds `500 + floor(margin × 500) + comboPoints + (perfect launch ? 200 : 0)` to the score; losing a race still ends the game with the final score once.
- [ ] A "+N" text appears above the tachometer for 0.6 s after each perfect shift, with N equal to the combo points of that shift.
- [ ] PAUSA freezes the nitro burn timer and the meter; resuming continues from the same value.
- [ ] GUARDAR PUNTUACIÓN still inserts one row in `scores` with `game_id = 'dragrush'` and the final score.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/dragrush/jugar` during a full session.

## Decisions

- **Yes:** nitro is earned by skill (perfect events) and spent by choice. **No:** a free boost: it would not add a decision.
- **Yes:** nitro resets every race. **No:** carrying it over: it would make the first races worth more than the last and hide the per-race timing.
- **Yes:** minimum 0.5 to burn, so the player must choose between burning early at half power-time or waiting. **No:** burn at any level: the choice disappears.
- **Yes:** combo points `100 × streak`. **No:** a flat 100 per shift: it does not reward consistency.
- **Yes:** the perfect launch is outside the streak. **No:** counting it: a lucky launch would inflate the first shift.
- **Yes:** `RIVAL_MIN_TIME` drops to 8.60 s because nitro makes a faster run possible. **No:** keeping 9.00 s: nitro players would never lose and the game would not end.
- **Yes:** tiers change reaction time and color, nothing else. **No:** a different curve per tier: it adds tuning with no new decision.
- **Yes:** new HUD field `nitro` (`number`, percentage). **No:** a new HUD format: only `number`, `hearts`, `pad2` exist and the shell is not changed.
- **Yes:** nitro on `X`, matching the pad button B convention for later. **No:** `Shift`: it conflicts with browser shortcuts in some layouts.
- **Yes:** the tuning step sets `NITRO_BOOST` from measured windows. **No:** guessing the value.
- **Yes:** no second catalog row; `sort_order` and cover do not change.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Nitro makes the early races trivial                                     | Rival still drops 0.20 s per race; the nitro windows are measured in the tuning step.                               |
| The HUD value changes about 100 times per burn                          | Rounded to integers and only emitted on change: bounded and not per frame.                                          |
| Combo and nitro double-count the perfect launch                         | The launch adds nitro and the 200-point bonus only; it never enters `streak`; criteria check both.                  |
| Existing leaderboard scores from the core are not comparable            | The core was never promoted before this spec if both are implemented together; otherwise flag it when promoting.    |
| A second key breaks the one-key `@mobile-porter` mapping                | Button A = `Space`, button B = `X`; both fit the SPEC 10 pad.                                                       |
| Burn timer keeps running while paused                                   | The burn drains inside the fixed physics step, which does not run when paused.                                      |
| Next.js 16 differs from training data                                   | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.              |

## What is **not** in this spec

- More tiers, tier-specific rival behaviour, rival names or portraits.
- Several nitro bottles per race or nitro carried between races.
- Bike upgrades, several tracks or distances.
- Sound and music.
- Touch mapping for nitro.
- Skins and bitmap sprites.
- Realtime scores and auth-linked scores.
- New catalog copy.

Each one of those, if it lands, goes in its own spec.
