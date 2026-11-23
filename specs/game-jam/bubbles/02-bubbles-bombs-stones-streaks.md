# SPEC JAM-bubbles-02 — Bubble Burst bombs, stone bubbles and burst streaks (BUBBLES)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-bubbles-01
> **Date:** 2026-11-23
> **Objective:** Add bomb shots, indestructible stone bubbles, a burst-streak score multiplier and a two-bounce aim guide to BUBBLES, so boards from level 4 on need new tactics.

## Why this spec exists

`JAM-bubbles-01` is a complete game, but every board is a random fill of the same kind of bubbles: the only decision is where to aim a colored shot. This spec is the theme layer. A bomb shot clears a pocket regardless of color, stone bubbles can only be removed by cutting their support, and a streak multiplier rewards chaining bursts instead of playing safe. The longer guide makes the bounce shots that stones force readable.

Everything is engine and constants. The shell, the registry entry, the HUD fields and the catalog row stay as the core left them. This spec lists only what it adds or changes; it does not insert a second catalog row.

## Scope

**In:**

- Edit `lib/games/bubbles/constants.ts`, `lib/games/bubbles/grid.ts` and `lib/games/bubbles/engine.ts` (plus `CLAUDE.md`). No change to `lib/games/registry.ts`, the migration, the cover or the shell.
- Cell values: color indices 0 to 5 as in the core, plus `6` for a stone (`STONE`). Bomb is not stored in the grid: a bomb shot never stays on the board.
- Bomb shots:
  - From level 2, every time a new "next" bubble is chosen, there is an 8% chance it is a bomb. A bomb is never chosen while the current bubble is a bomb, so two bombs are never loaded at once.
  - A bomb flies like any shot and snaps with the same rules. On snapping it explodes instead of running the cluster rule: the bomb cell and all its occupied neighbors (up to 7 cells) are removed, whatever their color, including stones.
  - Points: `15 × removed`, counting the bomb itself as one removed bubble. After the explosion the normal drop search runs and the usual `20 × k × k` points apply to what falls.
  - A bomb counts as a burst for the miss counter (it resets it) and for the streak (it adds 1).
  - A bomb is drawn dark with a fuse spark and can be swapped with `S` / `↓` like any bubble.
- Stone bubbles:
  - Level `n` starts with `stonesFor(n) = min(max(n − 3, 0), 8)` stones placed at random free cells in rows 1 to `rows − 1`. Level 4 has 1, level 11 and above have 8.
  - A stone never belongs to a cluster, never matches a color and is never chosen as a shot color. A color burst next to it does not remove it.
  - A stone is removed when it is not supported (the drop search), by a bomb, or by the level clear rule below. Dropped stones count in `k` for `20 × k × k`.
  - New rows added by misses contain no stones.
  - Level clear: the level ends when no non-stone bubbles remain. Any remaining stones fall at that moment and add `20 × k × k` points; then `+1000 × n` as in the core.
  - Colors for the shot are drawn from the non-stone colors on the board.
- Burst streak:
  - `streak` counts consecutive shots that burst (color burst or bomb). A miss resets it to 0; losing a life, a new level and a restart reset it to 0.
  - Pop and bomb points are multiplied by `streakMul(s) = min(2.0, 1 + 0.25 × (s − 1))` where `s` is the streak including the current shot, rounded to an integer after multiplying. Drop points are not multiplied.
  - The streak is shown as up to 5 filled pips under the next bubble in the world (no text).
- Aim guide: the dotted guide shows two wall bounces instead of one (and still stops at the first bubble or the ceiling).
- `CLAUDE.md` update: the `bubbles` row Canvas notes mention bombs, stones and streaks.

**Out of scope (for future specs):**

- Rainbow or color-changing bubbles, freeze or timer power-ups.
- Handmade level patterns.
- Sound and music, touch input, gamepad, skins.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no catalog row. HUD fields and snapshot stay `lives` (`hearts`, initial 3) and `level` (`pad2`, initial 1).

```ts
// added to lib/games/bubbles/constants.ts
const STONE = 6;                                  // cell value; COLORS still has 6 entries (indices 0 to 5)
const STONE_FILL = "#6b6b80";
const BOMB_CHANCE = 0.08, BOMB_FROM_LEVEL = 2;
const BOMB_POINTS_PER_BUBBLE = 15;
const stonesFor = (n: number) => Math.min(Math.max(n - 3, 0), 8);
const streakMul = (s: number) => Math.min(2.0, 1 + 0.25 * (s - 1));
const STREAK_PIPS = 5;
const GUIDE_BOUNCES = 2;
```

Conventions:

- The `Cell` type from the core (`number | null`) is unchanged; `6` means stone. Helpers that scan colors (`floodSameColor`, the shot color picker, "colors on the board") skip `STONE`.
- The shot has a `kind`: `"color"` (with a color index) or `"bomb"`. The current and next slots store this `kind`.
- Streak multiplier values: `s = 1` gives 1.0, `s = 2` gives 1.25, `s = 3` gives 1.5, `s = 5` and above give 2.0.
- The level clear check ignores stones: `levelClear = no cell is a color index 0 to 5`.

## Implementation plan

1. Add the constants to `constants.ts`. Manual check: `npm run lint` passes and the game still plays as in the core.
2. `grid.ts` and engine: stone support in the helpers (`floodSameColor` ignores `STONE`, the color picker ignores it, `findFloating` treats it like any occupied cell), stone placement in `loadLevel`, the level clear rule. Manual check: level 4 starts with 1 stone; bursting next to it never removes it; cutting its support drops it.
3. Engine: bomb as a shot kind (8% from level 2, never two loaded), explosion rule, points, miss and streak effects, swap support. Manual check: a bomb removes up to 7 cells of any color; the drop search runs afterwards.
4. Engine: streak counter and multiplier; the two-bounce guide; draw the dark bomb with a fuse spark, the stone bubbles and the streak pips. Use `/frontend-design` for these new visual elements (project rule for UI). Manual check: the three new elements are distinct from the six colors and readable at 480×640.
5. Update `CLAUDE.md`. Manual check: the `bubbles` row reads correctly.
6. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No migration, registry or shell file changes in this spec's diff; `games` still has exactly one `bubbles` row.
- [ ] Level 1 never offers a bomb; from level 2 a bomb appears as the next bubble with a 8% chance per new next bubble (about 8 in 100 over 100 shots).
- [ ] The current and next bubble are never both bombs.
- [ ] A bomb that snaps removes its cell and every occupied neighbor (at most 7 cells), including stones and bubbles of any color, and adds `15 × removed` points (times the streak multiplier).
- [ ] After a bomb explosion, bubbles left without a path to row 0 fall and add `20 × k × k` points.
- [ ] A bomb resets the miss counter and adds 1 to the streak.
- [ ] Level 4 starts with exactly 1 stone and level 5 with 2; level 11 and later start with exactly 8.
- [ ] Stones are never placed in row 0 and never in the same cell twice.
- [ ] A burst next to a stone never removes the stone and a stone never counts toward the cluster size.
- [ ] A stone with no path to row 0 falls and counts in `k` for the drop points.
- [ ] New rows added by misses contain no stones.
- [ ] When the last non-stone bubble is removed, the remaining stones fall with `20 × k × k` points and the level ends with `+1000 × n` points.
- [ ] Shot colors are never `STONE` and always exist among the non-stone bubbles on the board.
- [ ] Streak multiplier: the first burst of a run scores the core points, the second 1.25 ×, the third 1.5 ×, the fifth and later 2.0 ×, each rounded to an integer; a 4-bubble burst as the third in a row scores `round(80 × 1.5) = 120`.
- [ ] A miss, a lost life, a new level and JUGAR DE NUEVO reset the streak to 0 and the pips to empty.
- [ ] Drop points are never multiplied by the streak.
- [ ] The guide shows two wall bounces and stops at the first bubble or the ceiling.
- [ ] The HUD still shows only score, lives and level; the snapshot has the same keys as in the core.
- [ ] PAUSA freezes the shot and effects; the streak and the loaded bomb survive pause and resume.
- [ ] JUGAR DE NUEVO resets the grid, stones, bombs and streak; no duplicate loops run.
- [ ] The core rules (aim, shoot, snap, burst, drop, misses, danger, lives, game over) behave exactly as before on levels 1 to 3.
- [ ] No console errors on `/juegos/bubbles/jugar` during a full session through level 5.

## Decisions

- **Yes:** the bomb is a shot, not a board cell. **No:** bombs sitting on the board: they would need chain-reaction rules.
- **Yes:** bombs ignore color and remove stones. **No:** bombs that skip stones: stones would have no counter besides cutting support.
- **Yes:** stones start at level 4 and cap at 8. **No:** stones from level 1: new players need the core first.
- **Yes:** stones never in row 0 and never in new rows. **No:** anywhere: a stone in row 0 could never fall and a stone in a new row would be unfair.
- **Yes:** level clear ignores stones, which then fall. **No:** requiring stones to be removed: some boards could not be cleared.
- **Yes:** streak multiplier capped at 2.0 and applied to pops only. **No:** uncapped or applied to drops: drop points (`20 × k²`) already grow fast and would dominate the leaderboard.
- **Yes:** streak shown as pips in the world. **No:** a new HUD field: the shell must not change.
- **Yes:** the guide gets two bounces. **No:** an unlimited guide: it would remove the skill of bank shots.
- **Yes:** this spec changes only engine files and `CLAUDE.md`. **No:** a second catalog row, a new cover or registry edits.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file (done in the core). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                 | Mitigation                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A color helper forgets to skip `STONE` and a stone is matched        | Helpers listed in the plan step 2; criteria check a burst next to a stone.                                   |
| Boards with stones cannot be cleared                                 | Level clear ignores stones, which fall automatically.                                                        |
| Streak plus bombs inflates scores too fast                           | Multiplier cap 2.0, pops and bombs only; score clamp 10,000,000 from the core.                               |
| Scores saved with the core formula become incomparable               | Promote this spec in the same release as the core, or before real scores exist. Flag it at promotion.        |
| Bomb 8% chance feels streaky                                         | Never two loaded at once; constants `BOMB_CHANCE` and `BOMB_FROM_LEVEL` are tunable in one place.            |
| Input stuck after pause or blur                                      | Same input clearing as the core.                                                                             |
| Next.js 16 differs from training data                                | No Next code is touched; the shell must not change.                                                          |

## What is **not** in this spec

- Rainbow or color-changing bubbles, freeze or timer power-ups.
- Handmade level patterns.
- Sound, touch input, gamepad, skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
