# Game performance reviews

Last update: 2026-11-17

Owned by `@game-performance-booster`. Source of truth for the method: `specs/14-frogger-neon-performance.md`.

## Playbook

- Measure first, same session, A/B against `main`. Never keep a change the numbers do not support.
- Neon cost is `shadowBlur` rasterisation. Fix that works: bake glowing entities into `ImageBitmap` sprites (SPEC 14, Frogger). Background cache and glow batching measured slower; do not retry without a reason.
- Harness must use a software canvas (`willReadFrequently: true`).
- Absolute numbers drift up to 2x; use relative targets. First load at 4x on a cold dev server gives junk (n < 20): warm both servers first and use warmup >= 5 s.
- The harness sends random keys, so most games die quickly: the measured window mixes play and idle. Measure idle (paused / game over) separately to see idle-skip gains.
- A dev server in a worktree needs a real `node_modules` copy (a junction outside the root breaks Turbopack). Use a second port for the branch and `main` on 3000.

## Games

| id    | skins reviewed       | problem                                     | fix                                         | worst skin (neon) avg 1x / 4x before -> after                          | branch       | date       |
| ----- | -------------------- | ------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- | ------------ | ---------- |
| snake | classic, neon, retro | idle redraw (paused, game over) every frame | idle skip, no per-frame allocations in draw | play: 2.8 / 14.9 -> 2.2 / 16.0 (noise); idle: 2.3 / 14.8 -> 0.25 / 1.0 | `perf-snake` | 2026-11-17 |

## snake

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
