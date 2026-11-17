# SPEC 14 — Frogger neon skin performance

> **Status:** Approved
> **Depends on:** SPEC 12
> **Date:** 2026-11-17
> **Objective:** Cut Frogger's per-frame cost below 8 ms at 4× CPU throttle in all three skins (cache the static background, batch the neon glow, skip idle redraws, remove per-frame allocations), with no visual change.

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
  - Static layer cache, all skins: draw the static background (river, waves, road, road dashes, median and start strips, goal-row walls) once into an offscreen canvas (`document.createElement("canvas")`, 640×560) and blit it with one `drawImage` per frame. Built lazily on first draw and rebuilt in `setSkin` and on `restart`. Never created at module level.
  - Batched glow, neon only: entities are drawn so that the shadowed stroke happens once per group (all cars of one color, all logs of a lane, and so on) or once per sprite, not once per shape: build one path per group with `beginPath` + repeated sub-paths, then one `fill` and one shadowed `stroke`. Remove the per-shape `save()`/`restore()` pairs from the neon path of `paint()`.
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
let bgCache: HTMLCanvasElement | null = null; // static background for the current skin, W×H
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
2. In `engine.ts`, add the offscreen cache for the static background (neon only): build function, one `drawImage` in `draw()`, invalidate in `setSkin` and `restart`. Check: neon looks identical to before in a screenshot; switching skins live (HUD picker) still repaints correctly, also while paused.
3. In `engine.ts`, batch the neon glow for road entities (cars, trucks): one path and one shadowed stroke per color group. Remove the per-shape `save()`/`restore()` from the neon path of `paint()` where no longer needed. Check: cars and trucks look identical; classic and retro untouched.
4. In `engine.ts`, batch the neon glow for river entities (logs, turtles) and for bay borders, frog and death marker. Check: visual diff against a baseline screenshot at the same game state; lint and `npx tsc --noEmit` pass.
5. Run the script again for all three skins at 1× and 4×, record the after-numbers in the commit message and in "Results" below the Acceptance criteria (added by `/spec-impl`). Run `npm run lint` and `npm run build`.
6. Extend the cache to classic and retro, add the idle-redraw skip (paused, game over) and remove the per-frame allocations listed in Scope. Check: classic and retro pixel-identical to a baseline screenshot; pausing stops canvas draws (count `drawImage` calls via a spy or check frame cost ≈ 0 while paused); resume and skin switch while paused still repaint.
7. Re-run the script (step 5 numbers must include classic and retro), then update `CLAUDE.md` with the Performance measurement bullet.

## Acceptance criteria

- [ ] `scripts/perf/frame-cost.js` exists and, run through the Playwright MCP, prints one `n/avg/p95/max` line per game, skin and rate, with no manual edits.
- [ ] Before the change the script reports frogger/neon avg ≥ 10 ms at 1× and ≥ 20 ms at 4× (the baseline reproduces).
- [ ] After the change frogger/neon avg frame cost is < 8 ms at 4× CPU throttle and < 4 ms at 1×.
- [ ] After the change frogger/neon p95 is < 16 ms at 4×.
- [ ] After the change frogger/classic and frogger/retro avg frame cost is < 8 ms at 4× (classic baseline 9.3 ms) and not above baseline at 1×; output pixel-identical.
- [ ] While paused or after game over the frame loop issues no canvas draw calls (frame cost ≈ 0), and resume, skin switch and restart repaint correctly.
- [ ] No object/array literal is allocated per frame in `draw()`, `laneAt` or `emitIfChanged` (code review of the diff).
- [ ] A neon screenshot of the start screen (same state) before and after is visually identical: same colors, same glow, same shapes (side-by-side check, no unintended differences).
- [ ] Switching skin from the HUD picker `neon` → `classic` → `neon`, live and while paused, repaints the right background each time (no stale cached background).
- [ ] After "JUGAR DE NUEVO" the neon background is still correct and the number of canvases in the DOM does not grow (the cache is offscreen and not attached).
- [ ] Gameplay is unchanged: hop, river carry, turtles, bays, timer bar and game over behave as in SPEC 12 (manual playthrough of at least one bay fill and one death).
- [ ] No console errors on `/juegos/frogger/jugar` in all three skins during a 30 s session.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` and `/juegos/snake/jugar` are untouched (`git diff --stat` shows no file under their folders).
- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.

## Decisions

- **Yes:** one game (Frogger) and one skin (neon) per spec. **No:** fixing every borderline game at once: a single-cause spec stays small and works as a template for a repeatable review.
- **Yes:** cache the static background in an offscreen canvas, rebuilt on skin change. **No:** redrawing it every frame: it never changes within a skin.
- **Yes:** batch the glow per color/lane group (fewer shadowed strokes). **No:** per-entity offscreen sprites: bigger win but more code and memory, and the glow is baked at creation; revisit only if the 8 ms target is missed.
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
| Cache not invalidated on skin change leaves a stale background          | Rebuild in `setSkin` and `restart`; criterion switches skins live and while paused.                 |
| Offscreen canvas created during SSR or at module load                   | Create lazily inside `draw()` (client only, after `start()`), never at module level.                |
| Dev-server numbers vary between runs and machines                       | Compare before/after on the same machine, same session; 3 s runs, report avg and p95, rerun if odd. |
| 4× throttle runs yield few frames, so p95 is noisy                      | Report `n`; rerun with 3 s runs twice and keep the worse result.                                    |
| 8 ms target is not reachable with batching alone                        | Fall back to per-entity offscreen sprites (a new decision, recorded in this spec before coding it). |
| Memory of a 640×560 offscreen canvas on low-end phones                  | About 1.4 MB per skin cache; only the current skin is kept.                                         |
| OneDrive makes the dev server serve stale files                         | See the `CLAUDE.md` gotcha: edit the file again or restart `npm run dev` before measuring.          |

## What is **not** in this spec

- Any other game.
- Skipping redraws during the death freeze.
- Per-entity sprite atlases, palette changes or a smaller `glow`.
- The performance-review agent.
- Production or real-device profiling, FPS overlay, CI perf gates.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
