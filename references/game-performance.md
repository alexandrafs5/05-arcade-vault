# Game performance reviews

Last update: 2026-11-17

Owned by `@game-performance-booster`. One row per game.

## Playbook (from SPEC 14)

- Measure first. A static-read plan (background cache, glow batching) measured no faster than baseline in SPEC 14. Keep only what the same-session A/B supports.
- Neon cost is `shadowBlur` rasterisation, not stroke count or background. Fix: bake glowing entities into `ImageBitmap` sprites, draw with `drawImage`.
- Harness uses a software canvas (`willReadFrequently: true`). A GPU canvas with per-frame `getImageData` makes `drawImage` look ~35 ms slower.
- Absolute numbers drift up to 2x between sessions (and within one run at 4x on a busy machine, n < 140). Use relative A/B against the base branch in the same session.
- Sprites only pay off when many glowing entities are drawn per frame. With few entities (Asteroids), the neon gap is small and not worth the rotation/rebuild complexity.
- Idle skip (paused / game over) is not visible in the frame-cost harness; prove it with a draw-call spy (expect 0).
- Worktree note: a `node_modules` junction breaks Turbopack dev (500, missing `build-manifest.json`); run `npm ci` in the worktree and use another port (`next dev -p 3100`). `next dev` rewrites `AGENTS.md`: `git checkout AGENTS.md` before committing.

## Summary

| Game        | Skins reviewed       | Problem found                                                                                  | Fix                                                                          | Worst skin avg 1x / 4x before | after                                                          | Branch           | Date       |
| ----------- | -------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- | ---------------- | ---------- |
| `asteroids` | classic, neon, retro | Idle redraw every frame while paused and after game over; neon only mildly slower than classic | Idle skip (repaint once on pause, setSkin, restart, last game-over particle) | neon 3.8 / 20.3 ms (noisy)    | active play unchanged (draw path untouched); idle draw calls 0 | `perf-asteroids` | 2026-11-17 |

## asteroids

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
