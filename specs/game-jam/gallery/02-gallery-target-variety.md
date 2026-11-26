# SPEC JAM-gallery-02 — Target variety: decoys, clocks, armor and gold (GALLERY)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-gallery-01
> **Date:** 2026-11-26
> **Objective:** Add four new target kinds (decoy, clock, armored, golden) to GALLERY so every shot is a decision between points, time and a broken combo.

## Why this spec exists

The suggestion for `gallery` flags low depth as its main risk. `JAM-gallery-01` adds combos and three rows, but every target is still "shoot it". This spec gives the player things not to shoot (decoys), things worth more than points (clocks), targets that need two shots (armor) and a rare, fast prize (gold). It only changes `lib/games/gallery/`; the shell, the registry entry and the catalog row do not change, and no migration is added.

## Scope

**In:**

- Target kinds. Every spawn picks a kind by weight; `standard` is the core target.

  | Kind     | Weight | Effect                                                                                   |
  | -------- | ------ | ---------------------------------------------------------------------------------------- |
  | standard | 67     | As in the core.                                                                          |
  | decoy    | 13     | Hit: score `-50` (never below 0), `-2 s`, combo counter reset to 0. Looks friendly.       |
  | clock    | 8      | Only spawns on row 2. Speed ×1.3. Hit: `+3 s`, flat 10 points × combo, counts as a hit.   |
  | armored  | 12     | Needs 2 hits. The first hit adds 0 points, counts as a hit for the combo and shows a dent. The second hit awards `base × 2 × ring × combo`. |

- Golden target: a separate timer spawns one every 15 s of play (first at 15 s). It crosses row 1 at 300 px/s, radius 14, stays on screen until it leaves. Hit: flat 200 × combo (no ring multiplier), counts as a hit. It never counts toward the 4-per-row limit.
- Time cap: remaining time never exceeds 75 s.
- Combo rule for new kinds: a decoy hit resets the counter (it counts as a miss, but no extra miss is applied by the same click); the other kinds count as hits.
- Rings apply to `standard` and `armored` only.
- Drawing: each kind has a distinct silhouette and color so they read at a glance (decoy friendly and round with a cross, clock with a face, armored with a plate, golden with a star-like shine). Their look is a new UI element: `/spec-impl` must use `/frontend-design`.
- `CLAUDE.md` update: add a note to the `gallery` row (kinds: standard, decoy, clock, armored, golden).

**Out of scope (for future specs):**

- Waves, levels or difficulty ramps over time.
- Power-ups for the weapon (rapid fire, bigger clip).
- Sound and music.
- Touch controls, gamepad, multiplayer.
- Neon recolor.
- Automated tests.
- Any other game.

## Data model

No new tables, no new catalog row, no migration, no HUD changes. HUD stays `time` and `ammo`. The score stays an integer far below 10,000,000.

```ts
// lib/games/gallery/constants.ts (additions)
type Kind = "standard" | "decoy" | "clock" | "armored" | "golden";
const KIND_WEIGHT: Record<Exclude<Kind, "golden">, number> = {
  standard: 67, decoy: 13, clock: 8, armored: 12,
};
const DECOY_PENALTY = 50, DECOY_TIME = 2;
const CLOCK_TIME = 3, CLOCK_POINTS = 10, CLOCK_SPEED_MULT = 1.3;
const ARMOR_HITS = 2, ARMOR_BASE_MULT = 2;
const GOLD = { every: 15, r: 14, speed: 300, row: 1, points: 200 };
const TIME_CAP = 75;
```

Conventions:

- `Target` gains `kind` and `hp` (1 for all kinds except `armored`, which starts at 2).
- The clock kind is picked with its weight only when spawning on row 2; on rows 0 and 1 its weight is redistributed to `standard`.
- The golden timer is paused with the game and resets on restart. It counts play time, not wall time.
- Time lost to a decoy may bring the timer to 0 and ends the game normally.

## Implementation plan

1. Add the constants and the `Kind` type to `lib/games/gallery/constants.ts`. Manual check: `npm run lint` passes.
2. In `engine.ts`, add weighted kind selection at spawn and the `hp` field. Manual check: `npx tsc --noEmit` passes; kinds appear in proportion over 100 spawns.
3. In `engine.ts`, add per-kind hit handling (decoy, clock, armored, standard) and the time cap. Manual check: each kind produces its exact effect in the browser.
4. In `engine.ts`, add the golden timer and its target. Manual check: the first golden target crosses row 1 at 15 s.
5. Draw the new silhouettes with `/frontend-design` guidance for the look. Manual check: all five kinds are distinguishable at 375 px width.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Over 1,000 simulated spawns in a dev check, kind shares are within ±5 points of 67 / 13 / 8 / 12 (standard / decoy / clock / armored), with clocks only on row 2.
- [ ] Hitting a decoy lowers the score by exactly 50 (never below 0), removes 2 seconds from the timer and sets the combo counter to 0.
- [ ] Hitting a clock adds exactly 3 seconds, adds 10 × combo points and counts as a hit.
- [ ] The timer never shows more than 75.
- [ ] An armored target survives the first hit (adds 0 points, shows a dent, counts as a hit) and the second hit adds `base × 2 × ring × combo`.
- [ ] A golden target appears at 15 s, 30 s and 45 s of play time (the last one is only reachable if time bonuses extend the game), crosses row 1 at 300 px/s with radius 14, and a hit adds 200 × combo.
- [ ] The golden target does not count toward the 4-target limit of row 1.
- [ ] Pausing freezes the golden timer; resuming does not skip or repeat a spawn.
- [ ] JUGAR DE NUEVO resets the golden timer to 15 s and clears every target.
- [ ] The five target kinds have different silhouettes and colors in the canvas.
- [ ] HUD still shows only `Tiempo` and `Munición`; no registry, shell, catalog row or migration change is part of this spec.
- [ ] Core rules (clip 8, reload 1.2 s, rows, rings, combo ×1 to ×4) still behave as in `JAM-gallery-01`.
- [ ] The saved score still goes through `saveScore` with `game_id = 'gallery'`.
- [ ] No console errors during a full session.

## Decisions

- **Yes:** decoys cost points, time and combo. A decoy that only costs points would be ignored; the combo loss is what makes players aim. **No:** decoys that end the game: too punishing for a 45 s session.
- **Yes:** clocks on row 2 only (the smallest, fastest row): extra time is earned with the hardest shots. **No:** clocks on every row.
- **Yes:** armored targets as a two-shot trade with a good payoff. **No:** targets with 3+ hits: they would eat the clip.
- **Yes:** golden every 15 s on a fixed row, flat points. **No:** random timing: it would make runs unequal on the leaderboard.
- **Yes:** time cap 75 s. **No:** uncapped time: runs could stretch indefinitely.
- **Yes:** no HUD change. **No:** a new HUD field for the combo: the shell shows only `number`, `hearts` and `pad2` and the combo is visible in the canvas.
- **Yes:** no second catalog row and no migration. **No:** duplicating the core scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                  | Mitigation                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Decoys look too similar to standard targets and feel unfair           | Distinct silhouette and color, checked at 375 px width; designed with `/frontend-design`.            |
| Time bonuses make the 45 s promise false                              | Cap at 75 s; the `long` copy in the core migration does not claim a fixed length after this spec lands (re-check when promoted). |
| Golden timing depends on wall clock and drifts with pauses            | The timer accumulates capped `dt` only; criterion checks pause behavior.                              |
| Kind weights drift when the clock is excluded from rows 0 and 1       | Redistribute its weight to `standard`; the distribution criterion covers it.                          |
| Score subtraction goes below 0 or breaks the 0 to 10,000,000 range    | Clamp at 0 after a decoy hit.                                                                        |
| Next.js 16 differs from training data                                 | No Next code is touched; if the shell must change, stop and ask.                                     |

## What is **not** in this spec

- Waves, levels and difficulty ramps over time.
- Weapon power-ups.
- Sound and music.
- Touch controls, gamepad and multiplayer.
- Neon recolor.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
