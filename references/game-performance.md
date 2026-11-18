# Game performance

Last update: 2026-11-17

Per-frame cost of each game, measured with `scripts/perf/frame-cost.js` (SPEC 14). Games are reviewed one at a time by `@game-performance-booster`, only the game the user names. This file is owned and edited by that agent.

## Playbook (from SPEC 14 and the four 2026-11-17 reviews)

- Measure before changing. Static reads mislead: background cache and glow batching looked right and measured slower.
- Cost of glow skins is `shadowBlur` rasterisation. Fix: bake glowing entities into `ImageBitmap` sprites (margin `ceil(glow*1.5)+2`, lazy build, live fallback until ready, close on `setSkin` and `stop()`), one `drawImage` per entity. Only pays off with many glowing entities per frame (Tetris, Arkanoid, Frogger yes; Asteroids, Snake no).
- Harness uses a software canvas (`willReadFrequently: true`); a GPU canvas wrongly punishes `drawImage`.
- Compare against `main` in the same session. Numbers drift up to 2x between sessions; < 8 ms at 4x is not reachable for any skin with this harness. Use 8 s runs at 4x (n > 90), warm up >= 5 s, and run no other CPU work during a measurement.
- The harness sends random keys. Games where a key ends the run (Tetris Space = hard drop) reach game over in warm-up and measure idle instead: adapt the pasted copy and build a busy state first.
- Idle skip (paused, game over): repaint once on pause / game over / `setSkin` / `restart`, then skip `draw()`. Not visible in the harness; prove it with a draw-call spy (expect 0).
- Also fix per-frame allocations.
- Worktree: a `node_modules` junction breaks Turbopack (500). Copy or `npm ci` in the worktree, copy `.env.local`, use a free port. `next dev` rewrites `AGENTS.md`: restore it before committing.

## Games

| Game        | Skins reviewed       | Problem                                                                                                                          | Fix                                                                          | Avg 1x before → after                                                  | Avg 4x before → after                                          | Branch                             | Date       |
| ----------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- | ---------- |
| `frogger`   | neon                 | `shadowBlur` on every stroke, idle redraws, per-frame allocations                                                                | Baked neon sprites, idle skip, hoisted constants                             | 8.3 → 3.8 ms                                                           | 39.7 → 31.0 ms                                                 | `spec-14-frogger-neon-performance` | 2026-11-17 |
| `asteroids` | classic, neon, retro | Idle redraw every frame while paused and after game over; neon only mildly slower than classic                                   | Idle skip (repaint once on pause, setSkin, restart, last game-over particle) | neon 3.8 / 20.3 ms (noisy)                                             | active play unchanged (draw path untouched); idle draw calls 0 | `perf-asteroids`                   | 2026-11-17 |
| `tetris`    | classic, neon, retro | neon: one `shadowBlur` stroke per block per frame (board, ghost, piece, preview); frozen frames redrawn while paused / game over | baked neon block sprites (8 colors); idle skip                               | 3.7-3.9 -> 1.6-1.7 ms                                                  | 46.4 -> 10.5 ms (run 1), 14.5 -> 11.7 ms (run 2)               | `perf-tetris`                      | 2026-11-17 |
| `arkanoid`  | classic, neon, retro | neon `shadowBlur` on ~60 blocks + paddle + ball per frame; idle redraw                                                           | baked glow sprites, idle skip, in-place explosion aging                      | 4.5 -> 1.4 ms                                                          | 28.4 -> 12.5 ms                                                | `perf-arkanoid`                    | 2026-11-17 |
| `snake`     | classic, neon, retro | idle redraw (paused, game over) every frame                                                                                      | idle skip, no per-frame allocations in draw                                  | play: 2.8 / 14.9 -> 2.2 / 16.0 (noise); idle: 2.3 / 14.8 -> 0.25 / 1.0 | `perf-snake`                                                   | 2026-11-17                         |

## Notes per game

### frogger

See `specs/14-frogger-neon-performance.md` (Findings, Results, Decisions). Rejected: offscreen background cache and glow batching per color group or lane (no gain).

### asteroids

Audit (`lib/games/asteroids/engine.ts`, `entities.ts`):

- `shadowBlur` set per entity in `draw` (Bullet, Asteroid, PowerUp, Ship, Particle, all with `pal.glow`); one `save`/`restore` per asteroid, ship, power-up. Entity counts are small (4-10 asteroids, few bullets/particles).
- Paused loop called `draw()` every frame (engine.ts, old line 256); after game over `draw()` also ran every frame forever.
- Minor allocations: `filter` on bullets/particles/power-ups each update, `bullets.push(...)` only when shooting. `onChange` already fires only on snapshot changes. No images, gradients or offscreen canvases.

Numbers (avg / p95 ms, n frames; same session, port 3100, base code):

| Skin    | 1x run 1          | 1x run 2         | 4x run 1          | 4x run 2          |
| ------- | ----------------- | ---------------- | ----------------- | ----------------- |
| classic | 2.7 / 4.9, n=129  | 2.6 / 4.0, n=157 | 13.1 / 21.0, n=58 | 15.2 / 34.6, n=71 |
| neon    | 5.1 / 10.5, n=130 | 3.8 / 4.9, n=167 | 17.8 / 50.3, n=61 | 20.3 / 34.3, n=71 |
| retro   | 2.8 / 4.2, n=123  | 2.3 / 3.6, n=177 | 18.5 / 53.3, n=11 | 15.3 / 24.1, n=21 |

Branch (idle skip, same session): classic 1.5 / 2.4, neon 2.8 / 3.9, retro 1.4 / 2.1 at 1x; 4x classic 8.2, neon 23.6 (n=72), retro 11.3. Active-play code is identical, so the differences are session drift; 4x counts (n < 140) are not reliable on this machine.

Decision: neon is 1.4-1.9x classic at 1x (absolute gap about 1-2 ms), no skin over budget at 1x, so no glow sprite work (SPEC 14 neon was 2.7x classic). Only the idle redraw was a real, provable waste.

Changes kept:

- `perf(asteroids): skip idle redraws while paused and after game over`: draw calls per second while paused 0 (was one full scene per frame, ~130/s in play), after game over 0 once particles fade. Repaint verified on pause, skin switch while paused, restart (canvas count stays 1). Side effect: power-up pulse and the invincibility blink are frozen while paused / after game over (the pause overlay covers the canvas).

Rejected:

- Baked glow sprites for neon: not implemented. Expected gain at most ~1-2 ms at 1x (below the +/-25% noise), asteroids rotate every frame (sprite + rotate per draw) and are rebuilt on split.
- Per-frame `filter` hoisting: not measurable at these entity counts.

Open items:

- 4x runs are dominated by dev-server noise; re-measure on a quiet machine if neon at 4x matters.
- Harness `frame-cost.js` expects port 3000; this run used a pasted copy with port 3100 (worktree dev server).

### tetris

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

### arkanoid

Audit (hypotheses, `lib/games/arkanoid/engine.ts` before the change):

- `drawBlock` set `shadowBlur` per block (stroke) in neon: up to 60 blocks + paddle + ball shadowed per frame.
- `draw()` ran every frame while paused and after game over.
- `explosions.filter(...)` allocated a new array every frame in `update`.
- Fine: sprite sheet loaded in `start()` and ignored after `stop()`, `onChange` only on snapshot change, no per-frame gradients or `getImageData`.

Numbers (same session, `main` on :3000 vs branch on :3002, software canvas, 8 s runs, key presses every 80 ms; avg / p95 ms, n):

| Skin and rate | `main` avg / p95 (n) | branch avg / p95 (n) |
| ------------- | -------------------- | -------------------- |
| neon 1x       | 4.5 / 7.3 (363)      | 1.4 / 3.0 (386)      |
| neon 4x       | 28.4 / 71.2 (99)     | 12.5 / 17.8 (161)    |
| classic 1x    | 2.9 / 4.5 (283)      | 2.2 / 4.6 (316)      |
| classic 4x    | 15.8 / 25.4 (174)    | 16.6 / 26.7 (172)    |
| retro 1x      | 1.5 / 2.7 (351)      | 1.1 / 2.2 (324)      |
| retro 4x      | 6.9 / 10.6 (142)     | 6.0 / 9.5 (148)      |

Earlier runs (4 s, 4 s warm-up under CPU load) agreed on direction: neon 1x 5.2 -> 2.7, neon 4x 77.1 -> 23.3 (n 44 -> 91). Classic and retro run the same draw path as `main`, so their differences are noise.

Changes kept (one commit each):

1. `perf(arkanoid): bake neon glow into sprites`: one sprite per block color, paddle and ball (neon only). Explosions stay live (short, size changes every frame).
2. `perf(arkanoid): skip draw while paused and after game over`: 0 canvas calls (spy on `fillRect`, `strokeRect`, `stroke`, `fill`, `drawImage`, `clearRect`) while paused and at game over, in all skins; skin switch while paused repaints correctly (all pairs).
3. `perf(arkanoid): age explosions in place, no per-frame array`: allocation fix, not measurable, behavior identical.

Visual check: block region at the same game state, `main` vs branch: classic and retro 0 differing channels (pixel-identical); neon max channel delta 4/255 (sprite resampling). Screenshots are in the scratchpad of the run, not in the repo.

Other checks: `npm run lint`, `npx tsc --noEmit`, `npm run build` pass; restart keeps 1 canvas and correct sprites; played to natural game over (score 70-80) and restarted; 30 s per skin with no console errors.

Rejected: none (the three changes above were the only ones tried; background cache and glow batching were not retried, SPEC 14 already measured them slower).

Open items:

- Neon explosions still use live `shadowBlur` (up to a few at once for 150 ms). Not worth baking: size and alpha change every frame.
- Neon 4x p95 17.8 ms is at the frame budget; classic at 4x (16 ms) is the harness floor, not a game problem.
- The ball/paddle are drawn at fractional x with `drawImage`; no visible softening was seen.
- Harness: the committed script is unchanged; the run used a pasted copy with `BASES` (two origins) and a longer window for 4x.

### snake

Audit (`lib/games/snake/engine.ts`, before):

- `draw()` ran every frame in every state, including paused, game over and waiting for the first key (the board is 255 `fillRect` + grid strokes + snake, about 2600 canvas calls/s).
- `drawSnake`: `center` closure returning an object per cell per frame, `[-1, 1]` literal per frame.
- Neon `shadowBlur` 16 on the snake body and the apple orb: one shadowed stroke + one fill + one apple fill per frame. Cost is small here (see numbers), no baked sprites: the snake changes shape every step and the apple is one tiny orb.
- Sprite loading and `stop()` are already correct. `onChange` already fires only on change.

Numbers (software canvas, one session, `main` on :3000 vs branch on :3001, 6 s runs, 5 s warmup; ms per rAF callback + flush):

| Scenario     | Skin    | avg main | avg branch | p95 main | p95 branch | n main / branch |
| ------------ | ------- | -------- | ---------- | -------- | ---------- | --------------- |
| play 1x      | classic | 1.7      | 1.8        | 2.7      | 3.3        | 293 / 243       |
| play 1x      | neon    | 2.8      | 2.2        | 4.9      | 3.5        | 253 / 251       |
| play 1x      | retro   | 1.5      | 0.8        | 2.8      | 2.3        | 291 / 253       |
| play 4x      | classic | 11.4     | 3.4        | 16.2     | 11.7       | 108 / 143       |
| play 4x      | neon    | 14.9     | 16.0       | 21.4     | 21.8       | 139 / 93        |
| play 4x      | retro   | 9.4      | 9.6        | 13.2     | 16.4       | 113 / 76        |
| game over 1x | classic | 2.46     | 0.22       | -        | -          | 229 / 485       |
| game over 1x | neon    | 2.34     | 0.25       | -        | -          | 234 / 234       |
| game over 1x | retro   | 1.59     | 0.22       | -        | -          | 491 / 239       |
| game over 4x | classic | 26.4     | 0.87       | -        | -          | 88 / 188        |
| game over 4x | neon    | 14.8     | 1.03       | -        | -          | 158 / 107       |
| game over 4x | retro   | 9.9      | 0.95       | -        | -          | 149 / 111       |

"play" rows are the standard harness (random keys, mixed play and idle): inside noise, as expected since active frames are unchanged. "game over" rows: ArrowUp into the wall, then 4 s measured.

Canvas draw calls (`fillRect`+`stroke`+`fill`+`drawImage`) per second: playing 2640, waiting for first key 528 (before: same as playing, ~2640), paused 0, game over 0.

Changes kept: idle skip (repaint once on pause, skin change, restart, sprite ready, game over); hoisted `EYE_SIDES`, removed the `center` closure.

Rejected: baked glow sprites for neon (not tried: neon is only about 1.3x classic at 1x, 8.3 vs 3.1 ms in Frogger was the trigger; here the snake changes shape every step). Static board cache (SPEC 14 measured it slower).

Open items:

- While waiting for the first key the board is still redrawn every frame (could use the same idle flag; left out to keep the change minimal).
- The skin picker is inert at game over (shell behaviour, same on `main`).
- Harness mixed-state noise: a dedicated "keep playing" key script would make play-state A/B cleaner.
