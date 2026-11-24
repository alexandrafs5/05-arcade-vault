# SPEC JAM-bubbles-02 — Fairground prizes: patterns, special bubbles, swap and combos for BUBBLE BURST

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-bubbles-01
> **Date:** 2026-11-24
> **Objective:** Add hand-made level patterns, bomb and rainbow bubbles, a loaded-bubble swap and a burst combo multiplier to BUBBLE BURST, so levels differ from each other and high scores reward skill.

## Why this spec exists

JAM-bubbles-01 ships a complete game, but its fields are random and every shot is the same kind of bubble. This spec adds the "fairground prize" layer: six authored field patterns, two special bubbles, a swap to choose between the loaded and next bubble, and a combo multiplier. It only adds or changes what is listed below. It does not insert a second catalog row, does not change the registry entry, the HUD fields or the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it follows the promoted core spec and the file names below are re-checked.

## Scope

**In:**

- New file `lib/games/bubbles/levels.ts`: 6 authored patterns. Levels 1–6 use pattern `level − 1`; level 7 and above use pattern `(level − 1) % 6` with the level parameters of JAM-bubbles-01 (`colors`, `dropEvery`). `rows` of the core formula no longer applies; the pattern defines the rows.
- Pattern data: an array of strings, one per row, one character per cell: `A`–`F` = color index 0–5, `.` = empty. Row 0 is the ceiling row. Constraints checked by the criteria: 6 to 9 rows; row strings have length 12 on even rows and 11 on offset rows (`topParity = 0` at level start); every bubble is connected to row 0 (no floating bubble at the start); a pattern uses at most `colors` distinct letters for its level (letters above the level's color count are remapped to `letter % colors`).
- Pattern themes (names are code comments only): `1 flat` (solid rows), `2 stripes` (alternating color columns), `3 pyramid` (narrow at the bottom), `4 arches` (gaps that hide bubbles), `5 hanging chains` (one-bubble-wide chains that fall when cut), `6 checker` (alternating colors).
- Special bubbles: a loaded bubble is special every `SPECIAL_EVERY = 12`th shot of a level, alternating bomb, rainbow, bomb, ... (the counter resets on each new level; the first special is shot 12).
  - **Bomb:** on landing, removes itself and every occupied cell among its 6 neighbors, +15 points each (itself included), then the normal drop check runs on what remains (+20 per fallen bubble). It does not need a color match.
  - **Rainbow:** on landing, it takes the color of the field bubble it touched first (the closest one within 38 px when the shot stopped; on a ceiling stop with no contact, a random present color), then the normal burst rule applies.
  - Special bubbles are drawn with canvas primitives (bomb: dark disc with a fuse spark; rainbow: segmented disc), never counted as a color for the "present colors" rule.
- Swap: key `↓`, `S` or `X`, or a mouse click within 20 px of the next bubble preview at `(60, 600)`, swaps the loaded and next bubbles. Allowed only when no shot is in flight. One swap per shot (it re-arms after firing). The mouse click on the preview does not fire.
- Combo: `streak` counts consecutive shots that burst something. Multiplier `min(streak, 5)` applies to burst, drop and bomb points of that shot (`streak` already includes the current shot: first burst ×1, second consecutive ×2, up to ×5). A shot that bursts nothing sets `streak = 0`. The level-clear bonus is not multiplied. A new level keeps the streak.
- A small tag `×N` is drawn in the world next to the cannon when `streak ≥ 2`.
- Preventing `ArrowDown` scroll and `KeyS`/`KeyX` swap are added to the core input handling, with the same cleanup on pause, blur and stop.

**Out of scope (for future specs):**

- More special bubbles (lightning, freeze, color change).
- Sound and music.
- Touch controls, gamepad.
- Neon recolor skins.
- A level select or practice mode.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no catalog row, no HUD changes (`lives`, `level` stay as in JAM-bubbles-01).

```ts
// lib/games/bubbles/levels.ts (shape only; the 6 patterns are written in the implementation)
export const PATTERNS: string[][] = [
  // each entry: rows from the ceiling down, "A".."F" = color, "." = empty
];
```

```ts
// lib/games/bubbles/constants.ts additions
const SPECIAL_EVERY = 12;
const BOMB_POINTS = 15;
const COMBO_MAX = 5;
const SWAP_HIT_RADIUS = 20;
```

```ts
// engine state additions (closure)
// shotsThisLevel: number, streak: number, swapUsed: boolean
// loaded / next: { kind: "color" | "bomb" | "rainbow", color: number }
```

Conventions:

- Score formula for one shot: `(burst × 10 + bombRemoved × 15 + dropped × 20) × min(streak, 5)`. Level-clear bonus `500 × level` is added after, unmultiplied.
- Mouse coordinates use the same `getBoundingClientRect` conversion as the core.
- The snapshot shape does not change.

## Implementation plan

1. Create `lib/games/bubbles/levels.ts` with the 6 patterns and a `buildPatternGrid(level, colors)` helper that remaps letters. Manual check: `npm run lint` and `npx tsc --noEmit` pass; every pattern has 6–9 rows and the right row lengths.
2. Use the pattern in `buildLevel` in `engine.ts` instead of random rows. Manual check: level 1 shows the `flat` pattern; after clearing it, level 2 shows `stripes`.
3. Add the loaded and next `kind`, the special schedule (`shotsThisLevel`) and the bomb and rainbow landing rules. Manual check: shot 12 loads a bomb; it removes itself and its neighbors; shot 24 loads a rainbow that takes the touched color.
4. Add the swap (keys and preview click) with the one-swap-per-shot rule. Manual check: `↓` swaps the two bubbles once; a second `↓` before firing does nothing; after a shot it works again.
5. Add the combo (`streak`, multiplier, `×N` tag). Manual check: three consecutive bursts of 3 score 30, 60, 90.
6. Run `npm run lint` and `npm run build`. Update `CLAUDE.md` only if its game notes mention level data (add `levels.ts` to the BUBBLE BURST row notes).

No new UI is designed here: the bomb, rainbow and `×N` tag are canvas primitives inside the world; no cover, no HUD format. If `/spec-impl` finds the special bubbles need a designed look, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `PATTERNS` has exactly 6 entries; each has between 6 and 9 rows; each row string has length 12 on even rows and 11 on offset rows.
- [ ] In every pattern, every bubble is connected to row 0 at level start (no bubble falls before the first shot).
- [ ] Level 1 uses pattern 1 and level 7 uses pattern 1 again; level 8 uses pattern 2.
- [ ] At level 7 the pattern uses at most 6 colors and the field drops every 5 empty shots (core formula kept).
- [ ] Shot 12 of a level loads a bomb, shot 24 a rainbow, shot 36 a bomb; the counter restarts at level start.
- [ ] A bomb landing on a field removes itself and all occupied neighbor cells (up to 7 bubbles), scoring 15 each with streak 1.
- [ ] A rainbow landing next to a group of two bubbles of one color takes that color and bursts the group (3 bubbles, 30 points with streak 1).
- [ ] A bomb or rainbow bubble is never chosen as the "present colors" source when the next color is drawn.
- [ ] `↓`, `S` and `X` swap loaded and next bubbles; a second swap before firing is ignored; after firing it is allowed again.
- [ ] Clicking the next-bubble preview (within 20 px of `(60, 600)`) swaps and does not fire.
- [ ] Three consecutive shots that each burst a group of 3 score 30, 60 and 90.
- [ ] The multiplier stops at ×5: the sixth consecutive burst of 3 scores 150.
- [ ] A shot that bursts nothing resets the streak; the tag `×N` is drawn only when the streak is 2 or more.
- [ ] The level-clear bonus stays `500 × level` at any streak.
- [ ] `↓` does not scroll the page while the game is mounted; typing in an `INPUT` is not blocked.
- [ ] JUGAR DE NUEVO resets `shotsThisLevel`, `streak` and `swapUsed`.
- [ ] The catalog row, registry entry and HUD fields from JAM-bubbles-01 are unchanged; no second migration is added.
- [ ] No console errors on `/juegos/bubbles/jugar` during a full session.

## Decisions

- **Yes:** authored patterns in `levels.ts`, reused with core formulas for colors and drop speed from level 7. **No:** 30 patterns: six is enough to feel varied and keeps the data small.
- **Yes:** two special bubbles on a fixed schedule (every 12th shot). **No:** random specials: they would make runs harder to compare on the leaderboard.
- **Yes:** the bomb scores 15 per bubble, less than a drop (20), so a bomb is a rescue tool and not the best point source.
- **Yes:** one swap per shot. **No:** unlimited swapping: it would remove any pressure from choosing.
- **Yes:** combo capped at ×5, applied to burst, drop and bomb points only. **No:** multiplying the level bonus: it would make level clears dwarf the rest of the score.
- **Yes:** the streak survives a level change. **No:** resetting it: clearing a level should not punish skill.
- **Yes:** the `×N` tag and the specials are drawn in the world. **No:** a new HUD field: the HUD contract is unchanged and the shell is not touched.
- **Yes:** no second catalog row and no shell change. **No:** duplicating the core scope.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A pattern leaves a floating bubble at the start                         | Criterion checks every pattern; `findFloating` on a fresh level must return an empty list.        |
| Pattern strings have the wrong length for offset rows                   | Criterion checks 12 / 11 lengths; `buildPatternGrid` throws a visible console error otherwise.    |
| Bomb removes bubbles and leaves floating ones                           | The normal drop check always runs after a bomb.                                                   |
| Rainbow with no contact (ceiling stop) has no color to take             | Defined: a random present color.                                                                  |
| Swap click on the preview is read as a fire                             | Preview hit test runs before the fire test and consumes the click.                                |
| Special bubbles make the "present colors" rule pick a special as a color | Specials carry `kind`; the color picker reads only `kind: "color"` cells.                         |
| Streak multiplier makes the score unbounded                             | Capped at ×5; score stays far below 10,000,000.                                                   |

## What is **not** in this spec

- More special bubbles.
- Sound and music.
- Touch controls and gamepad.
- Neon recolor skins.
- Level select or practice mode.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
