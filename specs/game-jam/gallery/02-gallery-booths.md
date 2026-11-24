# SPEC JAM-gallery-02 — Booths and prizes: new targets, booth changes and accuracy bonus for NEON GALLERY

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-gallery-01
> **Date:** 2026-11-24
> **Objective:** Add three new target kinds, two booth changes during the round and an end-of-round accuracy bonus to NEON GALLERY, so each 60-second run has phases and rewards precise shooting.

## Why this spec exists

JAM-gallery-01 is playable end to end, but every second of a run looks the same apart from speed. This spec gives the round a shape (three booths) and adds prize targets that change how the player manages ammo and time. It only adds or changes what is listed below. It does not insert a second catalog row, does not change the registry entry, the HUD fields or the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it follows the promoted core spec and the file names below are re-checked.

## Scope

**In:**

- Three new target kinds added to the spawn table (weights below replace the core weights; the core kinds keep radius, speed and effect):

  | Kind        | Radius | Speed × | Weight | Effect when hit                                                          |
  | ----------- | ------ | ------- | ------ | ------------------------------------------------------------------------ |
  | lantern     | 26     | 1.0     | 50     | as core                                                                  |
  | star        | 16     | 1.6     | 18     | as core                                                                  |
  | decoy       | 24     | 1.0     | 14     | as core                                                                  |
  | clock       | 20     | 1.0     | 4      | as core                                                                  |
  | ammo crate  | 22     | 1.0     | 8      | `ammo = 6` at once, cancels a running reload, +5 points                  |
  | frost       | 20     | 1.0     | 6      | all targets move at ×0.5 for 4 s (a second frost resets the 4 s)         |
  | golden star | 14     | 2.4     | 0      | +100 points, never in the random table (see below)                       |

- Golden star: a timer `goldTimer` starts at a random 10–14 s; when it reaches 0, one golden star spawns on a random shelf and the timer is redrawn (12–18 s). Bullseye and streak rules apply to it. It does not count towards the 4-target shelf limit.
- Ammo crate, frost and golden star hits count as scoring hits for the streak (they do not reset it). Frost gives 5 points, ammo crate 5, golden star 100, all before bullseye and multiplier.
- Booths by elapsed play time:
  - Booth 1 (0 s to 20 s): the 3 core shelves.
  - Booth 2 (20 s to 40 s): a fourth shelf at y `85`, moving right to left at base speed `260` px/s. Its first target appears right away. A 1.5 s banner `CASETA 2` is drawn in the world.
  - Booth 3 (40 s on): every target bobs vertically `±14` px as a sine at 2 Hz with a random phase per target (the hit circle follows the drawn position). A 1.5 s banner `CASETA 3` is drawn in the world.
- Accuracy bonus: when time runs out, if `shots ≥ 10`, `bonus = floor(500 × hits / shots)` (`hits` = shots that hit any target except decoys, `shots` = all shots) is added to the score, then `onGameOver(score)` fires with the total. With fewer than 10 shots the bonus is 0.
- A frost state is drawn in the world as a pale tint over the booth while active.
- `shots` and `hits` counters live in the engine closure. They are not saved in the database.

**Out of scope (for future specs):**

- More target kinds or hazards (moving obstacles, curtains that hide targets).
- Sound and music.
- Touch controls, gamepad.
- Neon recolor skins.
- Saving accuracy or streak statistics.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no catalog row, no HUD changes (`time`, `ammo` stay as in JAM-gallery-01).

```ts
// lib/games/gallery/constants.ts additions
const KINDS_EXTRA = {
  crate: { r: 22, speedMul: 1.0, weight: 8, points: 5 },
  frost: { r: 20, speedMul: 1.0, weight: 6, points: 5 },
  gold: { r: 14, speedMul: 2.4, weight: 0, points: 100 },
};
const FROST_TIME = 4, FROST_SLOW = 0.5;
const GOLD_FIRST = [10, 14], GOLD_NEXT = [12, 18];
const BOOTH2_AT = 20, BOOTH3_AT = 40, BOOTH_BANNER = 1.5;
const SHELF_4 = { y: 85, dir: -1, speed: 260 };
const BOB_AMPLITUDE = 14, BOB_HZ = 2;
const ACCURACY_MIN_SHOTS = 10, ACCURACY_MAX_BONUS = 500;
```

Conventions:

- Booth changes use elapsed play time (seconds played), not `timeLeft`, so clocks and decoys do not move the booth switches.
- Frost multiplies target speed only; the clock and the reload timer are not slowed.
- The final score is the shot-by-shot score plus the accuracy bonus. Maximum is far below 10,000,000.
- The snapshot shape does not change.

## Implementation plan

1. Add the new kinds and constants to `lib/games/gallery/constants.ts` and the new weights table. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
2. Implement ammo crate and frost effects in `engine.ts` (instant refill, reload cancel, speed factor). Manual check: a crate hit with ammo 2 sets HUD ammo to 6; a frost hit halves target speed for 4 s.
3. Implement the golden star timer and spawn. Manual check: a golden star appears between 10 and 14 s after the start, then every 12–18 s.
4. Implement booths: 4th shelf at 20 s, bobbing at 40 s, banners. Manual check: the fourth shelf appears at 20 s; targets bob after 40 s; hits land on the drawn position.
5. Implement the accuracy bonus at time out. Manual check: after 20 shots with 15 hits, the final score includes 375 extra points.
6. Run `npm run lint` and `npm run build`. Update `CLAUDE.md` only if its game notes mention targets.

No new UI is designed here: the new targets, banner, frost tint and bob are canvas primitives inside the world; no cover, no HUD format. If `/spec-impl` finds the new targets need a designed look, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] The spawn weights are 50, 18, 14, 4, 8, 6 for lantern, star, decoy, clock, ammo crate, frost (sum 100).
- [ ] Hitting an ammo crate with HUD ammo 2 sets ammo to 6 immediately and adds 5 points at streak 1.
- [ ] Hitting an ammo crate during a reload cancels it: ammo is 6 and fire input works at once.
- [ ] Hitting frost multiplies all target speeds by 0.5 for 4 s; hitting a second frost at 2 s restarts the 4 s.
- [ ] The tint is visible only while frost is active; the HUD time keeps counting at 1 s per second.
- [ ] The first golden star appears between 10 s and 14 s of play; the following ones every 12 s to 18 s; it is worth 100 at streak 1 without bullseye.
- [ ] A golden star bullseye at the 1st scoring hit adds 200.
- [ ] A golden star does not count towards the 4-target shelf limit.
- [ ] Ammo crate, frost and golden star hits increase the streak and never reset it.
- [ ] At 20 s of play a fourth shelf at y 85 moves right to left at 260 px/s (before the ramp) and a `CASETA 2` banner shows for 1.5 s.
- [ ] At 40 s of play every target bobs ±14 px at 2 Hz and a `CASETA 3` banner shows for 1.5 s.
- [ ] A shot aimed at the center of a bobbing target hits it at any moment of its cycle.
- [ ] Booth switches happen at 20 s and 40 s of play even after decoy hits or clock hits changed `timeLeft`.
- [ ] With 20 shots and 15 hits (decoys excluded) the final score includes exactly 375 bonus points; with 9 shots the bonus is 0.
- [ ] The score sent to `onGameOver` equals the score shown in the game-over modal and the one saved by GUARDAR PUNTUACIÓN.
- [ ] JUGAR DE NUEVO resets `shots`, `hits`, `goldTimer`, frost and booth to 1.
- [ ] The catalog row, registry entry and HUD fields from JAM-gallery-01 are unchanged; no second migration is added.
- [ ] No console errors on `/juegos/gallery/jugar` during a full session.

## Decisions

- **Yes:** two timed booth changes at 20 s and 40 s. **No:** random events: runs must stay comparable on the leaderboard.
- **Yes:** the golden star is on a timer, outside the random table. **No:** a weighted random spawn: it would make some runs luckier than others.
- **Yes:** ammo crate as an ammo tool, with a small 5 points. **No:** extra time: clocks already do that.
- **Yes:** frost slows targets, not the clock. **No:** slowing the timer: it would be a free time bonus.
- **Yes:** accuracy bonus of up to 500 added once at time out, only with 10 or more shots. **No:** rewarding a run with 1 lucky shot.
- **Yes:** `shots` and `hits` stay in the engine; the bonus is part of the saved score. **No:** new database columns.
- **Yes:** no second catalog row and no shell change. **No:** duplicating the core scope.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings (`CASETA 2`, `CASETA 3`) in Spanish.

## Risks

| Risk                                                                  | Mitigation                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Bobbing targets are hit against the old position                      | Hit test uses the same drawn y (base y + bob offset); criterion checks it.              |
| Frost plus speed ramp makes targets almost still                      | Frost is ×0.5 for 4 s only and weight 6; the ramp caps at ×2.                           |
| The bonus makes the final score differ from what the player last saw | The bonus is added in the engine before `onGameOver`; the criterion compares the three. |
| Fourth shelf spawns overlapping targets at the screen edge            | Same 4-target limit and 40 px off-screen spawn rule as the core.                        |
| Golden star never appears if the game is paused for a long time       | The timer only counts play time; it resumes after pause with `dt = 0` on the first frame. |
| Score exceeds the 10,000,000 limit                                    | Impossible: 60 s of play cannot approach it.                                            |

## What is **not** in this spec

- More target kinds or hazards.
- Sound and music.
- Touch controls and gamepad.
- Neon recolor skins.
- Saving accuracy or streak statistics.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
