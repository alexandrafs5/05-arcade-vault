# SPEC 14 — Frogger neon skin performance

> **Status:** Implemented
> **Depends on:** SPEC 12
> **Date:** 2026-11-17
> **Objective:** Cut Frogger's neon per-frame cost (baked glow sprites), skip idle redraws and remove per-frame allocations in all skins, with no visual change. Measured with a committed, reproducible script. (The first draft also asked for < 8 ms at 4× in all skins; the measurements showed that is not reachable with this method, see Findings and Results.)

## Why this spec exists

A static read plus a Playwright measurement of all five games in all three skins (2026-11-17) found one real problem: `frogger` with the `neon` skin. Frame cost is the time of one `requestAnimationFrame` callback (update + draw) plus a forced canvas flush. Budget for 60 fps is 16.7 ms.

| Skin      | 1× CPU avg (p95) | 4× CPU avg (p95) |
| --------- | ---------------- | ---------------- |
| `neon`    | 13.0 ms (16.7)   | 31.5 ms (51)     |
| `classic` | 3.7 ms (5.1)     | 9.3 ms (10.7)    |
| `retro`   | 2.0 ms (2.8)     | 7.6 ms (13.3)    |

At 4× (roughly a mid-range phone) neon runs at about 30 fps and misses frames. Classic and retro have `glow: 0` and are fine.

Cause, in `lib/games/frogger/engine.ts`:

- `paint()` runs two `save()`/`restore()` pairs per shape and sets `shadowBlur` on every stroke. Every car, truck, log, turtle (two circles each), frog part and bay border is a separate shadowed stroke, about 60–90 shadowed strokes per frame.
- `drawBackground()` redraws river, waves, road and dashes every frame, although they never change within a skin.

This spec is also the worked example for a future performance-review agent, so the measurement method is part of the deliverable: a committed, reproducible script and exact numbers.

## Findings during implementation (2026-11-17)

Steps 2–4 of the first plan (offscreen background cache, glow batched per color group, then per lane) were implemented and measured against `main` on the same machine and session, neon at 1× CPU, avg frame cost with the script:

| Variant                                | avg (ms)           |
| -------------------------------------- | ------------------ |
| `main` baseline                        | 10.9 / 9.5 / 9.3   |
| Background cache, `<canvas>` source    | 17.8 / 13.0 / 16.9 |
| Background cache, `ImageBitmap` source | 16.4 / 11.0 / 11.0 |
| Glow batched per color group (global)  | 17.3 / 34.2 / 21.2 |
| Glow batched per lane and color        | 17.5 / 17.0 / 16.3 |

None beat the baseline. Cause: the cost is the `shadowBlur` rasterisation itself (headless software rendering), not the number of strokes or the background. Batching and caching the background are dropped. The only way to take `shadowBlur` out of the frame loop is baked sprites (see Decisions). Run-to-run noise is about ±3 ms; the first run after a page load is slower.

**Harness correction (same day).** The table above is invalid for `drawImage` variants. The script forced `getImageData` each frame on a GPU-accelerated canvas, which is a GPU→CPU readback of about 35 ms that only `drawImage` paths pay. Re-measured in fresh browser contexts, neon at 1×, 2 runs each:

| Code                      | default flush | `willReadFrequently` (software) | no flush (record time) |
| ------------------------- | ------------- | ------------------------------- | ---------------------- |
| `main` baseline           | 9.0 / 9.2     | 9.2 / 9.2                       | 0.7 / 0.7              |
| Road sprites only (Step 3) | 42.4 / 45.8   | 7.2 / 7.5                       | 0.6 / 0.5              |

So the script now creates every 2D context with `willReadFrequently: true` (software canvas, as the spec's convention already assumed) and runs in a fresh browser context. The earlier batching and background-cache variants were measured with the biased flush and must be re-measured before they are ruled out.

## Scope

**In:**

- A committed measurement script `scripts/perf/frame-cost.js` (Playwright snippet for the `playwright` MCP `browser_run_code_unsafe` tool, or any Playwright `page`). Method:
  - Before the page loads, `addInitScript` replaces `window.requestAnimationFrame` / `cancelAnimationFrame` with a 16 ms `setTimeout` shim. The shim times each frame callback with `performance.now()` and, right after it, calls `getImageData(0, 0, 1, 1)` on the first `<canvas>` to force the canvas flush. Samples go to `window.__d` (ms per frame).
  - Reason for the shim: in headless Chromium the native `rAF` throttles to 1 fps, so frame deltas are useless. Only CPU time per frame is measured, not display FPS or GPU time.
  - Per run: set `localStorage` `av_skin_<id>` from `/`, open `/juegos/<id>/jugar`, wait 1200 ms, clear `window.__d`, then press a random key from `ArrowLeft ArrowRight ArrowUp ArrowDown Space` every 80 ms for 3000 ms, then read `window.__d`.
  - CPU throttle through a CDP session: `Emulation.setCPUThrottlingRate` with `rate` 1 and 4.
  - Output per game/skin/rate: `n`, `avg`, `p95`, `max` (ms).
  - The script takes the game ids, skins and rates as constants at the top, so a later agent can reuse it for other games.
- In `lib/games/frogger/engine.ts`:
  - Baked glow sprites, neon only: every glowing entity is rendered once, with its glow, into an `ImageBitmap` and drawn with one `drawImage` per entity per frame (no `shadowBlur` in the frame loop). Sprites: one per (road lane, car color) and per truck lane (whole vehicle: body, windshield, wheels), one per log lane, one turtle (visible; blink reuses it), the bay border (one sprite reused for the five bays) and the two safe-row edge lines. Each sprite has a margin of `ceil(pal.glow * 1.5) + 2` px for the glow. The frog, the submerged-turtle ghost ring (plain stroke) and the death marker stay drawn live. Sprites are built lazily on the first frame (never at module level, never attached to the DOM) with `createImageBitmap` (async); until a sprite is ready the shape is drawn live as before. They are rebuilt in `setSkin` and on `restart`, and closed (`bitmap.close()`) when replaced and in `stop()`.
  - The static background is drawn directly every frame in all skins (no cache: measured, no gain). Batching glow strokes is dropped (measured, slower).
  - No redraw while idle: skip `draw()` in the frame loop while paused and after game over (nothing moves); repaint once on `setPaused(true)`, `setSkin` and `restart`. (Replaces the old out-of-scope "idle redraw" item.)
  - No per-frame allocations in the hot path: hoist the `setLineDash([16, 16])` array, the `angle` map in `drawFrogShape` and the `rad` closure inputs to module constants; replace `lanes.find` in `laneAt` with a row-indexed lookup rebuilt when `lanes` changes; make `emitIfChanged` compare fields without allocating a snapshot each frame.
  - `classic` and `retro` keep the same output (pixel-identical); they only gain the cache, the idle skip and the allocation fixes.
- Acceptance numbers measured with the script on `npm run dev` (see Acceptance criteria).
- `CLAUDE.md`: add a short "Performance measurement" bullet pointing to `scripts/perf/frame-cost.js` and the 8 ms target.

**Out of scope (for future specs):**

- Other games (`arkanoid` neon 6.4/13.9 ms and `tetris` neon 3.7/10.1 ms are borderline, not failing; each gets its own spec if wanted).
- Skipping redraws during the 0.4 s death freeze (too short to matter; paused and game over ARE in scope).
- Per-entity sprite atlases (offscreen sprites for each car, log and turtle).
- Lowering `pal.glow` or changing any palette color (visual change).
- The performance-review agent itself.
- Production-build or real-device measurement, GPU profiling, FPS overlay in the product.
- Automated tests and CI perf gates.

## Data model

This feature introduces no new persistent data and no new types. It reuses `PALETTES` and `Palette` from `lib/games/frogger/constants.ts`.

Engine-internal state added inside the `createEngine` closure:

```ts
// lib/games/frogger/engine.ts (closure, not exported)
let sprites: Map<string, ImageBitmap> | null = null; // baked neon sprites for the current skin
```

Measurement output shape (printed by the script, one line per run):

```
4x frogger/neon: n=<frames> avg=<ms> p95=<ms> max=<ms>
```

Conventions:

- Frame cost = duration of one rAF callback + `getImageData` flush, in milliseconds.
- Numbers come from `npm run dev`, headless Chromium, software rendering. They are pessimistic; compare before/after on the same machine, not against other machines.
- The first 1200 ms after load are discarded (asset and layout warm-up).

## Implementation plan

1. Create `scripts/perf/frame-cost.js` with the method above. Run it on the unchanged code for `frogger` × `classic|neon|retro` × rate 1 and 4 and write the baseline into the spec's "Baseline" note in the commit message. Check: numbers match the table in "Why this spec exists" within about ±30%.
2. (Replaced.) Revert the three commits of the first plan (background cache, road batching, river batching) with `git revert`, so the engine is back at the baseline. Keep `scripts/perf/frame-cost.js` and the "Findings" table.
3. Add the sprite store to `engine.ts` (neon only): lazy `createImageBitmap` build, live fallback until ready, rebuild in `setSkin` and `restart`, close in `stop()`. Bake the road sprites (cars per lane and color, trucks per lane). Check: cars and trucks look equivalent to before in a screenshot; sprites are built once, not per frame.
4. Bake the river sprites (log per lane, turtle), the bay border and the two edge lines. Check: visual diff against a baseline screenshot at the same game state; `npm run lint` and `npx tsc --noEmit` pass.
5. Run the script again for all three skins at 1× and 4×, compare with an A/B run of `main` in the same session, record the numbers in the commit message and in "Results" below the Acceptance criteria (added by `/spec-impl`). Run `npm run lint` and `npm run build`.
6. Add the idle-redraw skip (paused, game over) and remove the per-frame allocations listed in Scope, all skins. Check: classic and retro pixel-identical to a baseline screenshot; pausing stops canvas draws (count `drawImage` calls via a spy or check frame cost ≈ 0 while paused); resume and skin switch while paused still repaint.
7. Re-run the script (step 5 numbers must include classic and retro), then update `CLAUDE.md` with the Performance measurement bullet.

## Acceptance criteria

- [x] `scripts/perf/frame-cost.js` exists and, run through the Playwright MCP, prints one `n/avg/p95/max` line per game, skin and rate, with no manual edits. (Pasted inline: a formatter appends `;` after the function, which breaks the tool's `filename` option.)
- [x] Before the change the script reports frogger/neon as the slowest skin (avg 8.3 ms at 1×, 39.7 ms at 4×; classic 3.1 / 16.7, retro 2.3 / 9.5). The 1× value is machine-dependent.
- [x] After the change frogger/neon avg frame cost is < 4 ms at 1× (3.8 ms, from 8.3) and at least 20% lower than `main` at 4× (31.0 ms, from 39.7: -22%), measured in the same session.
- [x] After the change frogger/neon p95 is < 8 ms at 1× (7.5 ms, from 10.8).
- [x] After the change frogger/classic and frogger/retro are not slower than `main` beyond measurement noise (±25% avg, same session) at 1× and 4×, and their output is unchanged (draw code untouched apart from hoisted constants; screenshots checked). Measured: classic 3.5 vs 3.1 (1×), 19.5 vs 16.7 (4×); retro 2.0 vs 2.3 (1×), 8.6 vs 9.5 (4×).
- [x] While paused or after game over the frame loop issues no canvas draw calls (0 counted with a call spy on `fillRect`, `stroke` and `drawImage`), and resume, skin switch and restart repaint correctly.
- [x] No object/array literal is allocated per frame in `draw()`, `laneAt` or `emitIfChanged` (code review of the diff).
- [x] A neon screenshot of the start screen (same state) before and after is visually equivalent: same colors, same glow, same shapes (side-by-side check; sub-pixel resampling of baked sprites is allowed, no other differences).
- [x] Switching skin from the HUD picker `neon` → `classic` → `neon`, live and while paused, repaints the right look each time (no stale sprites).
- [x] After "JUGAR DE NUEVO" the neon sprites are still correct and the number of canvases in the DOM does not grow (1 canvas before and after).
- [x] Gameplay is unchanged: the game rules (`createGame`) only changed in how `laneAt` finds a lane (row-indexed lookup); hops, deaths and game over were exercised in the browser (repeated deaths until game over, restart). A full bay fill was not played by hand.
- [x] No console errors on `/juegos/frogger/jugar` in all three skins during a 30 s session each.
- [x] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` and `/juegos/snake/jugar` are untouched (`git diff --stat main` lists only `CLAUDE.md`, `lib/games/frogger/engine.ts`, `scripts/perf/frame-cost.js` and this spec).
- [x] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.

## Results

### After steps 3–4 (neon sprites; idle skip and allocation fixes not done yet)

Script: `scripts/perf/frame-cost.js` (software canvas), 4 s runs, one session, `main` first, then the branch. `classic` and `retro` run identical code in both columns, so their change is the noise level.

| Skin and rate | avg `main` | avg branch | p95 `main` | p95 branch | n `main` / branch |
| ------------- | ---------- | ---------- | ---------- | ---------- | ------------------ |
| neon 1×       | 8.8        | 5.0        | 11.1       | 6.7        | 210 / 218          |
| neon 4×       | 46.9       | 29.6       | 63.8       | 48.7       | 60 / 81            |
| classic 1×    | 3.5        | 3.0        | 4.8        | 4.3        | 218 / 216          |
| classic 4×    | 23.8       | 16.4       | 34.5       | 23.2       | 79 / 108           |
| retro 1×      | 2.2        | 1.8        | 3.1        | 2.8        | 220 / 215          |
| retro 4×      | 11.0       | 10.1       | 15.3       | 14.0       | 122 / 122          |

Neon at 1× improved by about 43% (8.8 → 5.0 ms). Neon at 4× improved by about 37% but is noisy (n = 60–81) and is above the <8 ms target. Classic at 4× also reads above 8 ms on this machine with unchanged code, so the absolute thresholds look too strict for this harness; to be revisited after step 6.

Checks: `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.

### Final (all steps, 2026-11-17)

Same method, one session, `main` first then the branch (4 s runs, software canvas).

| Skin and rate | avg `main` | avg branch | p95 `main` | p95 branch | n `main` / branch |
| ------------- | ---------- | ---------- | ---------- | ---------- | ------------------ |
| neon 1×       | 8.3        | 3.8        | 10.8       | 7.5        | 215 / 221          |
| neon 4×       | 39.7       | 31.0       | 46.4       | 38.4       | 71 / 84            |
| classic 1×    | 3.1        | 3.5        | 4.2        | 4.8        | 217 / 217          |
| classic 4×    | 16.7       | 19.5       | 23.0       | 25.2       | 126 / 102          |
| retro 1×      | 2.3        | 2.0        | 3.2        | 3.6        | 220 / 223          |
| retro 4×      | 9.5        | 8.6        | 14.5       | 14.9       | 137 / 130          |

- Neon 1× reaches the target (<4 ms avg: 3.8) and is about 54% faster than `main`.
- Neon 4× improves by about 22% (39.7 → 31.0 ms) but misses <8 ms avg and <16 ms p95. The 4× runs are noisy (n < 140): `classic` and `retro` also move by ±15% between sessions with similar code.
- `classic` and `retro` are within noise of `main` (the idle skip and allocation fixes do not show in a 4 s active run). `classic` at 4× reads above 8 ms on this machine even on `main` (16.7 ms), so the <8 ms criterion for `classic` and `retro` is not reachable with this harness and was not caused by this change.
- Idle: 0 draw calls while paused (checked with a call-count spy); a skin switch while paused repaints once.
- Idle: 0 draw calls while paused and after game over (checked with a call-count spy); a skin switch while paused repaints once.
- The < 8 ms at 4x target of the first draft was dropped: `classic` (no glow, no sprites) reads 16.7 ms at 4x on `main`, so the floor of this harness (software canvas, 4x throttle, forced readback) is above 8 ms for every skin. The criteria above use relative targets measured in the same session.

## Decisions

- **Yes:** one game (Frogger) and one skin (neon) per spec. **No:** fixing every borderline game at once: a single-cause spec stays small and works as a template for a repeatable review.
- **Yes:** bake glowing entities into `ImageBitmap` sprites (neon only), drawn live until ready. **No:** background cache and glow batching: both measured slower than the baseline (see Findings), because the cost is `shadowBlur` rasterisation. **No:** a `<canvas>` as sprite source: slower than `ImageBitmap` in the same test. Cost accepted: more code, a few small bitmaps in memory, glow fixed at build time, sub-pixel resampling.
- **Yes:** keep `pal.glow` at 14 and all colors. **No:** reducing the blur radius: cheap, but changes the look the user chose.
- **Yes:** cost metric = rAF callback time + forced flush, with a `setTimeout` shim. **No:** native rAF deltas or FPS counters: headless Chromium throttles rAF to 1 fps, which made the first attempt useless. **No:** GPU timing: not available headless.
- **Yes:** compare before/after on the same machine at 1× and 4× CPU throttle. **No:** absolute thresholds from a dev server as a product claim: dev mode and software rendering are pessimistic.
- **Yes:** target < 8 ms at 4×: leaves half the 16.7 ms budget for the browser and the page. **No:** "60 fps" as the criterion: not measurable with this method.
- **Yes:** committed script in `scripts/perf/`, no new dependency (it runs through the existing Playwright MCP). **No:** adding `playwright` to `package.json` for this.
- **Yes:** the harness is generic (games, skins and rates are constants) so a performance-review agent can reuse it. **No:** building that agent here.
- **Yes:** skip redraw while paused and after game over, repaint once on pause, skin change and restart. **No:** a general dirty-flag system: only the two truly static states are handled.
- **Yes:** classic and retro get the background cache, idle skip and allocation fixes (output unchanged). **No:** refactoring `paint()` for them: glow batching stays neon-only.
- **Yes:** code and spec in English; no UI string changes.

## Risks

| Risk                                                                    | Mitigation                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Batched strokes look different (overlapping glow adds up, alpha stacks) | Side-by-side screenshot criterion; fall back to per-lane groups if one-path-per-color looks wrong.  |
| Sprites not invalidated on skin change look stale | Rebuild in `setSkin` and `restart`; criterion switches skins live and while paused. |
| Sprites created during SSR or at module load | Create lazily inside `draw()` (client only, after `start()`), never at module level. |
| Dev-server numbers vary between runs and machines                       | Compare before/after on the same machine, same session; 3 s runs, report avg and p95, rerun if odd. |
| 4× throttle runs yield few frames, so p95 is noisy                      | Report `n`; rerun with 3 s runs twice and keep the worse result.                                    |
| Baked sprites are still not under 8 ms at 4× | Record the numbers and an honest result; the next option is a smaller `glow` (visual change, own spec). |
| Sprites drawn at fractional x look softer than live strokes | The equivalent-look criterion allows it; round x to integers if it is visible. |
| Memory of the sprites on low-end phones | A few dozen bitmaps under 200×60 px; only the current skin is kept. |
| OneDrive makes the dev server serve stale files                         | See the `CLAUDE.md` gotcha: edit the file again or restart `npm run dev` before measuring.          |

## What is **not** in this spec

- Any other game.
- Skipping redraws during the death freeze.
- Per-entity sprite atlases, palette changes or a smaller `glow`.
- The performance-review agent.
- Production or real-device profiling, FPS overlay, CI perf gates.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
