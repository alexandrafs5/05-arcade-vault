# Game performance reviews

Last update: 2026-11-17

Owned by `@game-performance-booster`. Method: `scripts/perf/frame-cost.js`, worked example `specs/14-frogger-neon-performance.md`.

## Playbook

- Measure first, same session, A/B against the base branch. Absolute numbers drift up to 2x between sessions; the floor at 4x is above 8 ms for every skin, so use relative targets.
- Neon cost is `shadowBlur` rasterisation, not stroke count or background. What works: bake glowing entities once into `ImageBitmap`s (`createImageBitmap` of an unattached canvas), margin `ceil(glow * 1.5) + 2`, lazy build, live fallback until ready, close on skin change and `stop()`. Batching glow and caching the background measured slower (SPEC 14).
- Harness must use `willReadFrequently: true` (software canvas).
- Idle skip: paint once on pause / game over / skin change / restart, then no canvas calls. Also repaint when a baked sprite arrives while idle.
- Never run two things on the CPU during a measurement (npm install, other dev servers): 4x runs collapse to n < 10 and are useless. Use 8 s runs at 4x for n > 90.
- A worktree has no `node_modules`: `npm ci`, copy `.env.local`, serve the branch on another port (3002) and the base on 3000, compare in one script.

## Reviewed games

| id         | Skins                | Problem                                                                | Fix                                                     | Worst skin (neon) avg 1x before -> after | avg 4x before -> after | Branch          | Date       |
| ---------- | -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- | ---------------------- | --------------- | ---------- |
| `arkanoid` | classic, neon, retro | neon `shadowBlur` on ~60 blocks + paddle + ball per frame; idle redraw | baked glow sprites, idle skip, in-place explosion aging | 4.5 -> 1.4 ms                            | 28.4 -> 12.5 ms        | `perf-arkanoid` | 2026-11-17 |

## arkanoid

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
