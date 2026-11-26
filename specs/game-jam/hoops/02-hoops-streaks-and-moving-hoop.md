# SPEC JAM-hoops-02 — Streaks, time bonuses and moving hoop (HOOPS)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-hoops-01
> **Date:** 2026-11-26
> **Objective:** Add a streak multiplier, a swish time bonus, bonus balls and a moving hoop to HOOPS so the high-score race rewards consistency and gets harder as baskets pile up.

## Why this spec exists

`JAM-hoops-01` ships a complete but static game: fixed hoop, 15 balls, 60 s, 45 points maximum. Once a player finds the sweet spot the game repeats. This spec adds the theme layer that creates a skill ceiling: consecutive baskets multiply points, clean shots buy time, and from the fifth basket the hoop starts moving. It changes only `lib/games/hoops/` and one registry entry; the shell is not touched and no catalog row is added.

When promoted, it is numbered right after the core spec; nothing here needs a migration.

## Scope

**In:**

- Streak: the number of consecutive baskets. A ball that ends without scoring resets it to 0.
- Multiplier: `1 + min(floor(streak / 2), 2)` using the streak before the new basket (streak 0–1 gives ×1, 2–3 gives ×2, 4 or more gives ×3). Points of a basket become `base × multiplier` with base 3 (clean) or 2.
- Swish time bonus: a clean basket adds 2 seconds, time is capped at 90 s.
- Bonus ball: each time the streak reaches 3, 6, 9, ... adds 1 ball (HUD `balls` + 1, no cap).
- Moving hoop: once `baskets >= 5` the whole hoop (rim points, backboard, scoring line) oscillates vertically around its base position with amplitude 50 px. Period 4 s when `5 <= baskets < 12`, period 2.5 s when `baskets >= 12`. The phase starts at 0 when a ball becomes ready so the hoop never jumps; the movement is a sine of the elapsed time since the hoop started moving.
- The game ends as in the core, but the "15th ball has ended" condition becomes "no balls left and no ball in flight" because bonus balls change the count.
- New HUD field `streak` (`number`, label `Racha`, initial 0).
- Drawing: the multiplier shows as a small tag above the hoop (`x2`, `x3`), and the hoop body moves with the oscillation. Visual detail for the tag is a detail for `/spec-impl`.
- `CLAUDE.md` update: the `hoops` row HUD column becomes balls, time, streak.

**Out of scope (for future specs):**

- Moving shooter spot or several shot distances.
- Sound and music.
- Touch controls, gamepad, multiplayer.
- Power-ups, special balls, daily challenges.
- Neon recolor.
- Automated tests.
- Any other game.

## Data model

No new tables, no new catalog row, no migration. The `games` row of `hoops` is unchanged. The score stays an integer and is far below 10,000,000 (a 90 s game cannot exceed roughly 400 points).

```ts
// lib/games/hoops/constants.ts (additions)
const MULT_STEP = 2, MULT_MAX = 3;            // multiplier = 1 + min(floor(streak / MULT_STEP), MULT_MAX - 1)
const SWISH_TIME_BONUS = 2, TIME_CAP = 90;
const BONUS_BALL_EVERY = 3;                    // streak 3, 6, 9...
const MOVE_FROM_BASKETS = 5, FAST_FROM_BASKETS = 12;
const HOOP_AMPLITUDE = 50, PERIOD_SLOW = 4, PERIOD_FAST = 2.5; // px, seconds
```

```ts
// HUD fields in lib/games/registry.ts (hoops)
hud: [
  { key: "balls", label: "Balones", format: "number", initial: 15 },
  { key: "time", label: "Tiempo", format: "number", initial: 60 },
  { key: "streak", label: "Racha", format: "number", initial: 0 },
],
// Snapshot: { score, state, hud: { balls, time, streak } }
```

Conventions:

- The hoop offset `hoopDy` is added to `RIM.left.y`, `RIM.right.y`, `BOARD.y` and the scoring line at `210`. The ball sees the hoop at its current offset in every physics sub-step; rim velocity is ignored (no energy transfer to the ball).
- Changing the period at 12 baskets keeps the current phase value continuous (`phase` accumulates `dt / period`), so the hoop does not jump.
- The streak is shown by the shell through the generic HUD; `number` format only, so the shell is unchanged.

## Implementation plan

1. Add the constants above to `lib/games/hoops/constants.ts`. Manual check: `npm run lint` passes.
2. In `engine.ts`, add streak, multiplier, swish time bonus and bonus balls to the scoring path and the snapshot (`streak` HUD key). Manual check: `npx tsc --noEmit` passes; scoring three baskets in a row gives HUD balls +1.
3. In `engine.ts`, add the hoop phase and `hoopDy`, apply it to the rim points, board and scoring line in the sub-step and in the draw, and change the end condition. Manual check: after 5 baskets the hoop moves; lint and tsc pass.
4. Draw the multiplier tag with `/frontend-design` guidance for the look (new UI element in the canvas). Manual check: the tag shows `x2` at streak 2 and `x3` at streak 4.
5. Add the `streak` field to the `hoops` entry in `registry.ts`. Manual check: the HUD shows `Racha` and it resets on JUGAR DE NUEVO.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] The HUD shows `Racha` starting at 0, and it resets to 0 on JUGAR DE NUEVO.
- [ ] The first two baskets of a game are worth exactly 3 (clean) or 2 (dirty) points each.
- [ ] The third and fourth consecutive baskets are worth exactly double (6 clean or 4 dirty); the fifth and later are worth triple (9 clean or 6 dirty).
- [ ] A ball that ends without scoring sets the streak to 0, and the next basket is worth ×1.
- [ ] A clean basket adds exactly 2 seconds to the timer; a dirty basket adds 0.
- [ ] The timer never shows more than 90.
- [ ] Reaching a streak of 3 raises HUD balls by exactly 1, and again at 6 and 9.
- [ ] Before the 5th basket the hoop does not move; from the 5th basket it moves ±50 px vertically with a 4 s period.
- [ ] From the 12th basket the period is 2.5 s and the hoop position stays continuous (no jump greater than 4 px between frames at 60 Hz).
- [ ] A basket is detected at the moving scoring line: the ball crossing downward inside the rim at the hoop's current height scores; the same crossing at the fixed `y = 210` when the hoop is elsewhere does not.
- [ ] The game ends when HUD balls is 0 and no ball is in flight, or when time reaches 0; the modal opens once with the final score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'hoops'` and the final score.
- [ ] The multiplier tag shows `x2` at streak 2 to 3 and `x3` at streak 4 or more, and is hidden at streak 0 to 1.
- [ ] Pause freezes the hoop movement; resuming does not jump.
- [ ] No catalog row or migration is added; `games` still has one `hoops` row.
- [ ] The five other games and the core HOOPS controls still behave exactly as before.
- [ ] No console errors during a full session.

## Decisions

- **Yes:** streak multiplier with a cap of ×3. **No:** uncapped growth: it would make scores unbounded and punish new players on the board.
- **Yes:** swish gives time, streak gives balls: two different rewards keep long streaks possible. **No:** time for every basket: it would remove the 60 s pressure.
- **Yes:** the moving hoop starts at the 5th basket and speeds up at the 12th. **No:** moving from the first shot: players need the static game to learn the physics.
- **Yes:** vertical movement only. **No:** horizontal movement: it would break the aim guide logic.
- **Yes:** ignore the rim velocity in collisions. **No:** momentum transfer: unpredictable and hard to tune.
- **Yes:** new HUD field `streak` in `number` format. **No:** a new HUD format: the shell must not change.
- **Yes:** no second catalog row and no migration. **No:** duplicating the core scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file when a row is needed (not here). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Moving hoop makes the game feel unfair                                  | Starts at the 5th basket, amplitude 50 px, slow period first; constants in one file.                 |
| Bonus balls plus time bonuses allow endless sessions                    | Time cap 90 s and streak resets on any miss; a session cannot exceed about 3 minutes in practice.    |
| Hoop jumps when the period changes                                      | Phase accumulates `dt / period`; criterion checks max 4 px per frame.                                |
| The aim guide misleads once the hoop moves                              | The guide only draws the ball path, never the hoop; unchanged from the core.                         |
| Streak HUD value desyncs from the engine after restart                  | `initial: 0` in the registry and a snapshot on restart; criterion checks the reset.                  |
| Next.js 16 differs from training data                                   | No Next code is touched; if the shell must change, stop and ask.                                     |

## What is **not** in this spec

- Moving shooter spot or several shot distances.
- Sound and music.
- Touch controls, gamepad and multiplayer.
- Power-ups, special balls and daily challenges.
- Neon recolor.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
