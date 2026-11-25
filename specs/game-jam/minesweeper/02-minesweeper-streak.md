# SPEC JAM-minesweeper-02 — Mine Sweep streak boards (MINESWEEPER)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-minesweeper-01
> **Date:** 2026-11-25
> **Objective:** Make a won board lead to a new, harder board instead of ending the game, so MINE SWEEP scores keep growing until the player hits a mine.

## Why this spec exists

In the core game a win ends the session, so the best possible score is capped by one board and clearing it ends the fun. This spec turns the game into a streak: win a board, get a bigger-risk board, keep adding to the score, and the run ends only on a mine. It changes only the engine in `lib/games/minesweeper/`; the shell, the registry entry, the HUD fields and the catalog row are untouched.

This is a jam spec: it is not numbered yet. It is promoted after `JAM-minesweeper-01`.

## Scope

**In:**

- A board counter `board` starting at 1. The mine count for board `k` is `min(40 + 6 × (k − 1), 70)`; board size stays 16×16. Board 1 is identical to the core (40 mines).
- Winning a board no longer fires `onGameOver`. Instead:
  - `banked += 5000 + 10 × (999 − t)` where `t` is that board's elapsed whole seconds (capped at 999), and the score becomes `banked`.
  - A banner "TABLERO k+1" is drawn over the cleared board in the world for 1.5 s (the canvas draws it; it is not shell UI). Clicks are ignored and the timer stays stopped during the banner.
  - After 1.5 s a fresh board starts with the new mine count, empty flags, `time` back to 0 and the HUD `mines` set to the new count. The first reveal on each board is safe with the 3×3 safe zone, as in the core.
- Loss: a mine ends the run as in the core. Final score is `banked + 10 × revealed safe cells on the current board`. `onGameOver(score)` fires once.
- In-play score is `banked + 10 × revealed safe cells on the current board`.
- The banner pauses with the game: while paused the 1.5 s timer does not advance.
- `restart` resets `board` to 1 and `banked` to 0.
- `CLAUDE.md` update: one line noting that MINESWEEPER is a streak game (win continues with the next board; only a mine ends the run).

**Out of scope (for future specs):**

- A HUD field for the board number (the HUD stays `mines` and `time`; the board number is visible only in the banner).
- Lives, shields, hints or "second chance" items.
- Boards larger than 16×16.
- Streak bonuses or multipliers.
- Sound, touch controls, skins, gamepad.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no second catalog row and no migration. The registry entry and the snapshot stay exactly as in JAM-minesweeper-01: `{ score, state, hud: { mines, time } }`.

```ts
// lib/games/minesweeper/constants.ts (added)
const STREAK_MINES_STEP = 6, STREAK_MINES_MAX = 70;
const BANNER_TIME = 1.5; // seconds
// mines(board) = Math.min(MINES + STREAK_MINES_STEP * (board - 1), STREAK_MINES_MAX)
// engine closure (added): board: number; banked: number; bannerLeft: number
```

Conventions:

- `MINES` (40) from the core becomes the mine count of board 1; the safe-cell count is computed per board as `256 − mines(board)` (216 on board 1, 186 from board 6 on).
- `state` stays `"playing"` during the banner; only a loss moves it to `"gameover"`.
- Score stays an integer between 0 and 10,000,000. Reaching that cap is not realistic (a board is worth at most 14,990), so no clamp is added beyond the 999 s time cap.
- The banner timer uses the raw frame delta and pauses with the game, like the board timer.

## Implementation plan

1. Add the streak constants and a `minesForBoard(board)` helper to `lib/games/minesweeper/constants.ts`. Manual check: `npm run lint` passes.
2. Change the win branch of `engine.ts`: bank the score, set `bannerLeft = 1.5`, no `onGameOver`. Manual check: `npx tsc --noEmit` passes; a won board does not open the modal.
3. Add board reset for the next board with the new mine count, HUD `mines` and `time` reset, and the loss formula `banked + 10 × revealed`. Manual check: after a win, board 2 shows 46 mines in the HUD.
4. Draw the banner and ignore input during it; make `restart` reset `board` and `banked`. Manual check: lint and tsc pass.
5. Update `CLAUDE.md`, then run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Board 1 has 40 mines, board 2 has 46, board 3 has 52, and board 6 and later have 70 (the cap is reached at board 6: 40 + 30 = 70).
- [ ] Clearing board 1 does not open the game-over modal; "TABLERO 2" is drawn for 1.5 s and then a new hidden 16×16 board starts.
- [ ] After a win on board 1 at t = 90 s the score is 14,090; it does not drop afterwards.
- [ ] On the new board the HUD `mines` equals its mine count (46 on board 2) and `time` is 0 until the first reveal.
- [ ] Clicks and flags during the banner do nothing, and the timer does not start.
- [ ] The first reveal on every board is safe and opens a zero cell.
- [ ] While playing board 2 the score equals `banked + 10 × revealed safe cells` (for banked 14,090 and 5 revealed cells: 14,140).
- [ ] A mine on board 2 opens the game-over modal once with `banked + 10 × revealed`; the shown board is board 2 with its mines revealed.
- [ ] Pausing during the banner freezes its 1.5 s timer; resuming completes the remaining time.
- [ ] JUGAR DE NUEVO returns to board 1 with 40 mines, score 0 and `banked` 0.
- [ ] A board-1 loss gives exactly the same score as in JAM-minesweeper-01 (`10 × revealed`).
- [ ] The HUD still shows only `Minas` and `Tiempo`; the registry entry and the `games` row are unchanged.
- [ ] `contextmenu` is still prevented only on the canvas.
- [ ] No console errors during a run of three boards.
- [ ] The five existing games still play exactly as before.

## Decisions

- **Yes:** a win continues the run; only a mine ends it. **No:** ending on win (the core): it caps the score at one board.
- **Yes:** +6 mines per board, capped at 70 (27% density). **No:** larger boards: they need a new canvas size and registry changes.
- **Yes:** the board timer resets per board and each board banks `5000 + 10 × (999 − t)`. **No:** one timer for the whole run: it would punish slow early boards on all later ones.
- **Yes:** the banner is drawn in the world for 1.5 s. **No:** a new HUD field or shell element: the shell does not change.
- **Yes:** the loss formula keeps `10 × revealed` on top of `banked`. **No:** losing the banked score: it would punish a good streak.
- **Yes:** the HUD stays `mines` and `time`. **No:** adding `board` (`pad2`): it would change the registry and diverge from the planner brief.
- **Yes:** no second catalog row and no migration. **No:** a new game row for a feature.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                   | Mitigation                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| The 70-mine board needs guessing and feels unfair                      | The cap is a constant; the first click is always safe; tuning is a later change.              |
| The banner is mistaken for a game over because the modal does not open | The banner text is "TABLERO k" and the HUD keeps running; criteria check no modal on a win.   |
| A stale click during the banner starts a reveal on the new board       | Input is ignored until `bannerLeft` reaches 0, and the board is rebuilt only then.            |
| Win rule differs from the core leaderboard rule                        | The core and streak specs are promoted and implemented before the game goes live, so scores never mix. |
| Players cannot see the board number                                    | Accepted: it appears in the banner only; a HUD field is a future spec.                        |

## What is **not** in this spec

- A HUD field for the board number.
- Lives, shields, hints or second chances.
- Boards larger than 16×16.
- Streak bonuses or multipliers.
- Sound, touch controls, skins and gamepad.
- Any other game.

Each one of those, if it lands, goes in its own spec.
