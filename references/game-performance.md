# Game performance reviews

Last update: 2026-11-17

Owned by `@game-performance-booster`. One row per game.

## Playbook

- Measure first, A/B against the base branch in the same session. Absolute numbers drift up to 2x; the 4x floor is above 8 ms for every skin.
- Neon cost is `shadowBlur` rasterisation, not stroke count or background. Fix: bake glowing entities once into `ImageBitmap` (margin `ceil(glow*1.5)+2`, lazy build, live fallback until ready, close on skin change and `stop()`, never attached to the DOM) and `drawImage` them.
- Harness must be a software canvas (`willReadFrequently: true`).
- The generic harness presses random keys; for games where a key ends the run quickly (Tetris Space = hard drop) the board fills and the game ends, so the measurement becomes idle. Adapt the pasted copy so the state stays alive, and build a representative (busy) state first. A near-empty board hides the glow cost.
- Idle skip: repaint once on pause / game over / `setSkin` / `restart`, then skip `draw()`.
- A worktree has no `node_modules`: a junction to the main checkout breaks Turbopack (500, missing build-manifest). Copy the folder instead, and use a free port.

| id     | skins                | problem                                                                                                                          | fix                                            | neon avg 1x before -> after | neon avg 4x before -> after                      | branch        | date       |
| ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------- | ------------------------------------------------ | ------------- | ---------- |
| tetris | classic, neon, retro | neon: one `shadowBlur` stroke per block per frame (board, ghost, piece, preview); frozen frames redrawn while paused / game over | baked neon block sprites (8 colors); idle skip | 3.7-3.9 -> 1.6-1.7 ms       | 46.4 -> 10.5 ms (run 1), 14.5 -> 11.7 ms (run 2) | `perf-tetris` | 2026-11-17 |

## tetris

Audit (`lib/games/tetris/engine.ts`, before):

- `drawBlock` neon branch: `shadowBlur` stroke per non-empty cell, every frame (up to 200 board cells + 4 ghost + 4 piece + 4 preview).
- `frame()` called `draw()` every frame, also while paused and after game over.
- No per-frame allocation in the hot path (`emitIfChanged` compares fields; `rotate` kick array only on key press). `onChange` already fires only on change. No images, no `getImageData`.

Harness note: pasted copy used keys `ArrowLeft/Right/Up/Down` (Down twice) without `Space`, and first pressed `Space` 11 times with spread columns to build a busy board (about 40 blocks). Plain random keys with Space reach game over within the warm-up. Seeded runs showed the near-empty board gives neon 2.4 vs classic 1.8 ms at 1x (hidden cost).

Numbers (busy board, software canvas, 5 s, `main` vs branch in the same session; two sessions):

| skin, rate           | avg main  | avg branch | p95 main    | p95 branch  | n main / branch |
| -------------------- | --------- | ---------- | ----------- | ----------- | --------------- |
| neon 1x (run 1)      | 3.9       | 1.6        | 5.1         | 2.3         | 202 / 213       |
| neon 1x (run 2)      | 3.7       | 1.7        | 5.1         | 2.5         | 215 / 235       |
| neon 4x (run 1)      | 46.4      | 10.5       | 63.5        | 14.8        | 45 / 69         |
| neon 4x (run 2)      | 14.5      | 11.7       | 18.4        | 15.5        | 97 / 105        |
| classic 1x (r1 / r2) | 1.3 / 1.4 | 1.4 / 1.2  | 2.3 / 2.4   | 2.3 / 1.9   | ~215            |
| classic 4x (r1 / r2) | 8.9 / 7.8 | 9.5 / 9.4  | 12.4 / 10.6 | 13.5 / 14.0 | 71-101          |
| retro 1x (r1 / r2)   | 1.2 / 1.3 | 1.2 / 1.1  | 1.9 / 1.9   | 2.0 / 1.8   | ~205-240        |
| retro 4x (r1 / r2)   | 8.9 / 9.3 | 9.7 / 10.1 | 14.5 / 20.0 | 14.2 / 13.1 | 76-104          |

Classic and retro run unchanged draw code (within noise). The 4x neon main number varied 14.5 to 46 between runs (n < 100); the branch stayed at 10.5 to 11.7, i.e. about the classic/retro floor.

Changes kept:

1. Baked neon block sprites (`dd1dae3`): one `ImageBitmap` per piece color, 70x70 px (margin 20), drawn with `drawImage` and `globalAlpha` for the ghost. Pixel check vs `main` with a seeded `Math.random` and same game state: classic and retro identical (0 differing channels), neon max channel delta 19/255 (sub-pixel resampling).
2. Idle skip (`a97b591`): 0 canvas draw calls while paused and after game over (spy on `fillRect`, `stroke`, `strokeRect`, `drawImage`, `fillText`); skin switch while paused repaints once with the right look for all pairs; restart repaints; one `<canvas>` before and after.

Rejected: none tried (static layer cache for the board not tried: no measured reason, neon is now at the classic floor).

Open items:

- 4x absolute avg stays above 8 ms for all skins in this harness (classic 8-9 ms on `main`).
- Per-frame cost left is plain grid line strokes (28 `stroke()` per frame) in all skins; not worth a layer cache unless a measurement says so.
