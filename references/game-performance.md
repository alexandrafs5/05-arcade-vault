# Game performance

Last update: 2026-11-17

Per-frame cost of each game, measured with `scripts/perf/frame-cost.js` (SPEC 14). Games are reviewed one at a time by `@game-performance-booster`, only the game the user names. This file is owned and edited by that agent.

## Playbook (from SPEC 14)

- Measure before changing. Static reads mislead: background cache and glow batching looked right and measured slower.
- Cost of glow skins is `shadowBlur` rasterisation. Fix: bake glowing entities into `ImageBitmap` sprites, one `drawImage` per entity.
- Harness uses a software canvas (`willReadFrequently: true`); a GPU canvas wrongly punishes `drawImage`.
- Compare against `main` in the same session. Numbers drift up to 2x between sessions; < 8 ms at 4x is not reachable for any skin with this harness.
- Also fix: idle redraws (paused, game over), per-frame allocations.

## Games

| Game      | Skins reviewed | Problem                                                           | Fix                                              | Avg 1x before → after | Avg 4x before → after | Branch                             | Date       |
| --------- | -------------- | ----------------------------------------------------------------- | ------------------------------------------------ | --------------------- | --------------------- | ---------------------------------- | ---------- |
| `frogger` | neon           | `shadowBlur` on every stroke, idle redraws, per-frame allocations | Baked neon sprites, idle skip, hoisted constants | 8.3 → 3.8 ms          | 39.7 → 31.0 ms        | `spec-14-frogger-neon-performance` | 2026-11-17 |

Not reviewed yet: `asteroids`, `tetris`, `arkanoid`, `snake`. SPEC 14 noted `arkanoid` neon (6.4 / 13.9 ms) and `tetris` neon (3.7 / 10.1 ms) as borderline, not failing.

## Notes per game

### frogger

See `specs/14-frogger-neon-performance.md` (Findings, Results, Decisions). Rejected: offscreen background cache and glow batching per color group or lane (no gain).
