# SPEC JAM-gems-02 — Special gems: Blast Core and Prism

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-gems-01
> **Date:** 2026-11-18
> **Objective:** Add two special gems to GEM SWAP, the Blast Core (from lines of 4 and L/T shapes) and the Prism (from lines of 5), so bigger matches create tools that clear more of the board.

## Why this spec exists

The core spec rewards longer lines only with a flat bonus. Special gems give the player a reason to plan a match of 4 or 5 and make cascades bigger, which is what drives high-score competition in this genre. The names, looks and rules here are original to this game.

This spec changes only the engine in `lib/games/gems/` and adds no catalog row, no shell change and no assets. It needs the core spec (`JAM-gems-01`) implemented first. Where the core criteria give the points of a line of 4 (60) or of 5 (100), this spec replaces them with the values below, because one gem of the line is kept as a special.

## Scope

**In:**

- Two special gem types stored next to the kind in the board: `board[row][col]` stays a kind id 0..5, and a parallel `specials[row][col]` holds `0` (none), `1` (Blast Core) or `2` (Prism). A Prism has no kind (kind `-2` in its cell, matches nothing by itself).
- Creation, evaluated in the first resolve step of a swap only (cascade steps create none):
  - A line of exactly 4 leaves one Blast Core of that kind. An L or T shape (a horizontal line of 3+ crossing a vertical line of 3+) leaves one Blast Core of that kind at the crossing cell.
  - A line of 5 or more leaves one Prism at the cell.
  - The special spawns at the cell the player moved into (the swapped cell that belongs to the line); if neither swapped cell is in the line, at the first cell of the line (top-most, then left-most). That cell is not cleared: all other cells of the line are.
- Blast Core behaviour: a Blast Core is a normal gem of its kind for matching. When any step clears it, it also clears the 3×3 area centered on it. Cells cleared this way can contain other Blast Cores, which also explode in the same step (chain, each only once per step).
- Prism behaviour: swapping a Prism with any adjacent gem (including a Blast Core) is always a valid swap and costs 1 move. The Prism and every gem of the partner's kind on the board are cleared in step 1. If the partner is a Blast Core, its 3×3 explosion also applies. A Prism swapped with another Prism clears the whole board (64 gems). A Prism is never cleared by a normal line (it has no kind) but is cleared by a Blast Core explosion.
- Scoring (core formula unchanged): step points are `(10 × gemsCleared + line bonuses) × k`. Gems cleared by a Blast Core or a Prism count in `gemsCleared`. The core line bonuses (0, 20, 50) still apply to the lines that created the specials. Clearing the whole board with two Prisms adds `10 × 64 = 640` for step 1, then cascades follow.
- `hasValidMove` also returns true when any Prism is on the board with at least one neighbor. The reshuffle rule keeps specials: the specials move with their gems (a Prism is permuted like any gem).
- Drawing: a Blast Core is its gem with a bright ring and a pulsing core; a Prism is a white-to-spectrum faceted gem with a slow color shift. Both are drawn with primitives. Clear effect: a Blast Core shows an expanding 3×3 flash for `CLEAR_S`; a Prism shows lines of light from the Prism to each cleared gem. Exact look is a detail for `/spec-impl` using `/frontend-design`.
- Constants added to `lib/games/gems/constants.ts`: `SPECIAL_NONE = 0`, `SPECIAL_CORE = 1`, `SPECIAL_PRISM = 2`, `BLAST_RADIUS = 1`.

**Out of scope (for future specs):**

- Obstacle blocks, locked gems, timed gems.
- Sound and music.
- New HUD fields, level goals or move counts: unchanged from the core spec.
- Skins and touch mapping.
- Any other game.

## Data model

No new tables, no catalog row, no migration, no registry change, no new `localStorage` keys. The snapshot and the HUD fields (`moves`, `level`) are the same as in `JAM-gems-01`.

```ts
// lib/games/gems/constants.ts (added)
const SPECIAL_NONE = 0, SPECIAL_CORE = 1, SPECIAL_PRISM = 2;
const BLAST_RADIUS = 1; // 3x3 area
// board.ts (changed shapes)
// board: number[][]      kind ids 0..5, -2 for a Prism, -1 for an empty cell
// specials: number[][]   0 | 1 | 2, same dimensions as board
```

Conventions:

- A cell is empty only while gems fall; `specials` is cleared with the cell.
- Resolve steps process in this order: find lines, add special creation (step 1 of a swap only), apply Blast Core and Prism clears, score, clear, fall, refill.
- Refilled gems are always plain (`specials = 0`).

## Implementation plan

1. Add the constants and extend `board.ts` with the `specials` grid, `findMatches` returning the line shapes (length, orientation, crossing cell), and the 3×3 expansion helper. Manual check: `npm run lint` and `npx tsc --noEmit` pass; the game still plays exactly as `JAM-gems-01`.
2. Extend `engine.ts`: create specials on step 1 of a valid swap (4, L/T, 5+), spawn them at the rules' cell, and clear all the other cells of the line. Manual check: a line of 4 leaves exactly one Blast Core and clears 3 gems; a line of 5 leaves one Prism.
3. Extend `engine.ts`: Blast Core explosion and chains, Prism swaps (kind clear, Prism + Core, Prism + Prism), scoring with the unchanged formula. Manual check: a Blast Core cleared in the middle of the board clears 9 cells.
4. Extend `hasValidMove` and `reshuffle` to keep specials and to count Prism moves. Manual check: a board with a Prism and no other move does not reshuffle.
5. Extend the draw code for both specials and their clear effects. Use `/frontend-design` for the look of the two specials (new UI element in the canvas). Manual check: both are distinguishable from plain gems at 375 px width.
6. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] A swap that makes a line of exactly 4 clears 3 of the 4 gems and leaves one Blast Core of that kind at the cell the player moved into; the step adds `(10 × 3 + 20) = 50` points.
- [ ] A swap that makes an L or T shape of 5 gems leaves one Blast Core at the crossing cell and clears the other 4 gems of the shape (40 points before the cascade multiplier).
- [ ] A swap that makes a line of 5 clears 4 gems and leaves one Prism; the step adds `(10 × 4 + 50) = 90` points.
- [ ] Specials are created only on step 1 of a swap: a line of 4 formed by a cascade creates no special.
- [ ] Clearing a Blast Core by any line also clears the 3×3 area around it; a Blast Core inside that area explodes in the same step, once.
- [ ] Swapping a Prism with a plain gem of kind K clears the Prism and all gems of kind K, costs exactly 1 move and adds `10 × count` points on step 1.
- [ ] Swapping a Prism with a Blast Core clears the Prism, all gems of the Core's kind, and the 3×3 area of every cleared Blast Core.
- [ ] Swapping two Prisms clears all 64 gems and adds 640 points on step 1.
- [ ] A Prism is not cleared by a plain line and is cleared by a Blast Core explosion.
- [ ] A Prism on the board makes `hasValidMove` true; no reshuffle happens while a Prism has a neighbor.
- [ ] A reshuffle keeps the same number of Blast Cores and Prisms on the board.
- [ ] Refilled gems are plain: after any clear, the number of specials never grows except through the creation rules.
- [ ] Blast Core and Prism are visibly different from plain gems and from each other.
- [ ] Level goals (1000 + 300 per level), moves per level (25), HUD fields and game over behave exactly as in `JAM-gems-01`.
- [ ] No file outside `lib/games/gems/` changes (no shell, registry, CSS or migration change).
- [ ] The other five games still play exactly as before.
- [ ] No console errors on `/juegos/gems/jugar` during a full session.

## Decisions

- **Yes:** two specials only (Blast Core and Prism). **No:** a larger zoo: balance and drawing grow faster than the value.
- **Yes:** create specials only on step 1 of a swap. **No:** creating them in cascades: the player could not plan them and the board would fill with specials.
- **Yes:** the special spawns where the player moved. **No:** a random cell: it breaks planning.
- **Yes:** a Prism swap always counts as valid. **No:** requiring a line: a Prism would be stuck on the board.
- **Yes:** specials keep the core scoring formula. **No:** extra points per special: the cleared gems already pay.
- **Yes:** specials survive reshuffle. **No:** destroying them: it would punish the player for a board state they did not cause.
- **Yes:** this spec does not touch the HUD, the registry, the cover or the catalog row. **No:** a second catalog row: one game has one row.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file (done in the core spec). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Chain explosions loop forever                                             | Each Blast Core explodes once per step; the cleared set is a boolean grid.                             |
| Two lines in one swap create two specials on the same cell                | Each line shape creates its own special at its own cell; if two cells collide, the first one wins (top-most, then left-most). |
| Prism swap with an empty or falling cell                                  | Input is locked while the board animates, so every swap happens on a full, stable board.               |
| Too many specials make levels trivial                                     | Specials only come from swaps; the goal grows 300 per level; check by hand at level 6 to 10.           |
| Reshuffle loses a special                                                 | Permute `board` and `specials` together as one gem; a criterion checks the counts.                     |
| Two Prisms clear the board and give a big score                           | Bounded: 640 points on step 1 plus normal cascades; the score clamp of 10,000,000 still applies.       |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components. |

## What is **not** in this spec

- Obstacle blocks, locked gems and timed gems.
- Sound and music.
- New HUD fields, goals or move counts.
- Skins and touch mapping.
- Any other game.

Each one of those, if it lands, goes in its own spec.
