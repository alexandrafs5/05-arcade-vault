# Games ready for mobile

Last update: 2026-11-17

Every game must be playable on a touch-only phone: canvas on top, on-screen gamepad below (SPEC 10). New games are ported one at a time by `@mobile-porter`, only the game the user names. This file is owned and edited by that agent.

The d-pad is fixed (arrow keys). A and B are set per game through the `touch` field in `lib/games/registry.ts`; `none` means the button is dimmed.

| Game        | A                        | B                | Source           | Date       |
| ----------- | ------------------------ | ---------------- | ---------------- | ---------- |
| `asteroids` | `Space` — "Disparo"      | none             | SPEC 10          | 2026-11-17 |
| `tetris`    | `Space` — "Caída rápida" | `KeyX` — "Rotar" | SPEC 10          | 2026-11-17 |
| `arkanoid`  | none                     | none             | SPEC 10          | 2026-11-17 |
| `snake`     | none                     | none             | SPEC 10          | 2026-11-17 |
| `frogger`   | none                     | none             | `mobile-frogger` | 2026-11-17 |

## Notes per game

### asteroids

- D-pad: left/right rotate, up thrust. A fires.

### tetris

- D-pad: left/right move, down soft drop, up rotate. A hard drops, B rotates.

### arkanoid

- D-pad: left/right move the paddle. Mouse input stays desktop-only.

### snake

- D-pad: four directions. A 180° reversal is still ignored by the engine.

### frogger

- D-pad: four directions, one press = one hop (one extra press is buffered). Engine reads `e.key` on `window` (arrows + WASD), no mouse. No buttons, no engine fix.
