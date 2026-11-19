# SPEC JAM-neonrace-02 — Neon Racer near-miss combos and nitro pads

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-neonrace-01
> **Date:** 2026-11-19
> **Objective:** Add a near-miss combo multiplier and collectable nitro pads to NEON RACER, so skilled players score far more than players who only hold the throttle.

## Why this spec exists

The core game rewards speed, but a player can hold `↑` and steer calmly. This feature adds a risk and reward layer: passing very close to traffic builds a combo, and nitro pads give a short burst that doubles the score rate. Both are rules inside the existing engine; the shell, the catalog row and the HUD fields do not change.

This is a jam spec: it is not numbered yet. It can only be promoted after the core spec (JAM-neonrace-01) is implemented.

## Scope

**In:**

- Near-miss detection and a combo multiplier in `lib/games/neonrace/engine.ts`.
- Nitro pads: a new road object, a nitro state and its drawing.
- New constants in `lib/games/neonrace/constants.ts` (listed in the data model).
- World feedback drawn in the canvas: a floating text `+50 x3` that rises 40 px and fades over 0.8 s at the car position, and a blue flame behind the car while nitro is on. These are world effects, not HUD.
- Rules:
  - Near miss: at the moment a car is overtaken (the same event that gives the 25 overtake points), if the horizontal distance between the centers is less than `NEAR_MISS_DX = 46` px and no collision happened, it is a near miss. Overtakes with a larger distance are normal overtakes.
  - Near-miss points: `NEAR_MISS_POINTS = 50` multiplied by the current combo. The combo starts at 1. Each near miss raises it by 1 (maximum `COMBO_MAX = 5`) if the previous near miss was less than `COMBO_WINDOW_S = 4` s ago; otherwise it restarts at 1 (the new near miss is paid at x1). The combo resets to 1 after 4 s with no near miss and on any collision.
  - Nitro pads: a pad is 40×40 px, centered in a lane. One pad spawns every `PAD_GAP_PX = 6000` px of accumulated scroll, at `y = -70`, in a lane that holds no car of the row spawned at that moment. Pads scroll with the road (their speed is the player's speed, so they do not move relative to the road) and are removed at `y > 720`.
  - Collecting: the player hitbox overlaps the pad. The pad disappears and nitro starts for `NITRO_S = 3` s: the target speed is `NITRO_MAX = 380` km/h regardless of the keys (`↓` still brakes), and the score rate is multiplied by `NITRO_SCORE_MULT = 2`. Picking another pad during nitro resets the timer to 3 s (no stacking). A collision ends nitro at once.
  - The HUD `speed` can now show up to 380 (still in steps of 5). Nothing else in the snapshot changes.
- `CLAUDE.md` update: add "near-miss combo, nitro pads" to the `neonrace` canvas notes in the Games table.

**Out of scope (for future specs):**

- Sound and music.
- Touch controls, gamepad.
- Skins.
- Other power-ups (shield, extra life, magnet).
- A combo or nitro HUD field (the registry HUD stays `speed` and `lives`).
- Realtime scores, auth-linked scores.
- Automated tests.

## Data model

No catalog row, no migration, no new tables, no new `localStorage` keys, no registry change.

```ts
// Added to lib/games/neonrace/constants.ts
const NEAR_MISS_DX = 46;        // px between car centers
const NEAR_MISS_POINTS = 50;
const COMBO_MAX = 5, COMBO_WINDOW_S = 4;
const PAD_SIZE = 40, PAD_GAP_PX = 6000;
const NITRO_S = 3, NITRO_MAX = 380, NITRO_SCORE_MULT = 2;
```

```ts
// Engine state added to the closure
// combo: number; comboTimer: number; nitroTimer: number; pads: { x: number; y: number }[]
// popups: { x: number; y: number; text: string; age: number }[]
```

Conventions:

- The overtake event of the core spec still adds 25 points; a near miss adds `50 × combo` on top.
- The score accumulator rate becomes `speed / 10 × (nitro ? 2 : 1)` points per second.
- The snapshot shape is unchanged: `{ score, state, hud: { speed, lives } }`.

## Implementation plan

1. Add the constants above to `lib/games/neonrace/constants.ts`. Manual check: `npm run lint` passes.
2. Engine: near-miss detection at overtake, combo and its timers, popups. Manual check: passing a car at a center distance of about 40 px shows `+50 x1`, then `x2` on the next near miss within 4 s.
3. Engine: pad spawning by scroll distance, pickup, nitro timer, target speed 380, score multiplier, nitro end on collision. Manual check: taking a pad raises the speed to 380 km/h for 3 s and then returns to the normal target.
4. Draw: pad sprite (primitives), popups, nitro flame. Manual check: no frame drops; no `shadowBlur` in the loop.
5. Update `CLAUDE.md`.
6. Run `npm run lint` and `npm run build`.

The pad, popup and flame are small in-canvas effects drawn with primitives, so `/frontend-design` is not required. If `/spec-impl` decides to change shell UI to show the combo, it must use `/frontend-design` and that change belongs in its own spec.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Overtaking a car whose center is 45 px away horizontally adds 25 + 50 points at combo 1; at 46 px it adds only 25.
- [ ] A second near miss 3.9 s after the first adds `50 × 2`; one 4.1 s after the first adds `50 × 1`.
- [ ] The combo never exceeds 5: the sixth consecutive near miss within the window adds 250 points.
- [ ] A collision sets the combo to 1.
- [ ] The popup text rises 40 px and disappears after 0.8 s.
- [ ] A pad appears every 6000 px of scroll, 40×40 px, in a lane with no car of that row.
- [ ] Touching a pad starts nitro: the HUD speed reaches 380 km/h and the score rate doubles (holding 380 km/h for 3 s adds 228 ± 5 points from the rate, versus 114 without nitro).
- [ ] Nitro lasts 3.0 s, a second pad during nitro resets the timer to 3.0 s, and a collision ends it immediately.
- [ ] `↓` / `S` still brakes during nitro.
- [ ] The registry HUD fields are still `speed` and `lives`; the shell is unchanged.
- [ ] Score, game over, pause, restart and unmount behave as in the core spec; after 3 restarts the combo, nitro and pads are reset.
- [ ] No console errors during a full session.

## Decisions

- **Yes:** near miss is checked only at the overtake event with `|dx| < 46`. **No:** continuous proximity scoring: it would reward driving alongside traffic.
- **Yes:** combo capped at x5 with a 4 s window. **No:** an unbounded multiplier: it would dominate the leaderboard.
- **Yes:** a collision resets the combo. **No:** keeping it: risk would have no cost.
- **Yes:** nitro doubles the score rate for 3 s and raises the speed cap to 380. **No:** invulnerability during nitro: it would remove the dodge skill.
- **Yes:** pads spawn by scroll distance in a free lane. **No:** random time spawns: unfair at low speed and rare at high speed.
- **Yes:** combo shown as a floating world text. **No:** a new HUD field: the brief fixes the HUD to speed and lives, and a new field would need shell work.
- **Yes:** no second catalog row; this spec reuses the core row and cover. **No:** a new game entry.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data; code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Near-miss threshold too tight or too loose                                | The value lives in `NEAR_MISS_DX`; tune it from play, keep the criteria values in sync.                     |
| Nitro makes cars unavoidable at 380 km/h (760 px/s scroll)                | Nitro lasts 3 s and the player keeps full steering; rows keep a free lane.                                  |
| Combo hides in a world text the player may miss                           | The popup includes the multiplier (`x3`); a HUD field is a future spec.                                     |
| Popup and flame cost frame time                                           | Popups are plain `fillText` (max 5 alive); no `shadowBlur`.                                                 |
| Input stuck or loops duplicated on pause, restart, unmount                | Same handling as the core spec; criteria check the reset after 3 restarts.                                  |

## What is **not** in this spec

- Sound and music.
- Touch controls and gamepad.
- Skins.
- Other power-ups.
- A combo or nitro HUD field.
- Realtime scores and auth-linked scores.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
