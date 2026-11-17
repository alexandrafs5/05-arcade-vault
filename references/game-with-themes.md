# Games with skins

Last update: 2026-11-16

Every game must offer three skins. They are applied one game at a time by `@skin-designer`, only to the game the user names. This file is owned and edited by that agent.

- **classic (default):** the look the game ships with. No change.
- **neon:** near-black background, saturated site colors, glow.
- **retro:** 4-8 colors, flat fills, no glow, low-fidelity feel.

Each skin must look good on the dark site. The player picks the skin in the HUD of `/juegos/<id>/jugar`; the choice is saved per game in `localStorage` (`av_skin_<id>`).

| Game        | classic | neon | retro | Branch            | Date       |
| ----------- | ------- | ---- | ----- | ----------------- | ---------- |
| `asteroids` | ✓       | ✓    | ✓     | `skins-asteroids` | 2026-11-16 |
| `tetris`    | —       | —    | —     | —                 | —          |
| `arkanoid`  | —       | —    | —     | —                 | —          |
| `snake`     | ✓       | ✓    | ✓     | `skins-snake`     | 2026-11-16 |

## Notes per game

### asteroids

- classic: black bg, white vectors, cyan power-up, orange flame (verbatim).
- neon: near-black bg, cyan ship, magenta rocks, yellow bullets, green power-up, shadowBlur 14.
- retro: dark green bg, phosphor-green rocks with flat dark-green fill, amber filled ship, 3px miter lines, square bullets and particles, no glow.
- Technique: pure vector redraw, each entity draws with the active palette; no sprites.

### snake

- classic: lime-green checkerboard, blue snake, sprite apple (verbatim).
- neon: near-black board with faint cyan grid, green glowing snake with cyan eyes, magenta glowing orb apple with yellow stem, shadowBlur 16.
- retro: 5 colors, dark-green checkerboard, flat phosphor-green square blocks, amber pixel-art apple, square eyes, no glow.
- Technique: apple sprite only in classic; neon and retro redraw the apple as vector shapes, so no tinting or new assets.
