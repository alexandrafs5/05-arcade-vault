# SPEC JAM-jumper-02 — Neon Jump springs, moving platforms and drones

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-jumper-01
> **Date:** 2026-11-18
> **Objective:** Add spring pads, sliding platforms and stompable drones to NEON JUMP, keeping every spine jump reachable, so a climb has boosts, moving targets and a hazard to avoid or squash.

## Why this spec exists

`JAM-jumper-01` ships a playable climber with static platforms and crumbling decoys. After a few hundred metres it plays the same. This spec is the theme layer: a spring that rewards finding it with a big boost, platforms that slide and force a timing decision, and a drone the player can stomp for bonus points or lose to on contact.

The result is a distinct ruleset of the same game: same spark, steering, camera and spine generator, plus three elements that all obey the reachability rules of the core. It only changes files under `lib/games/jumper/` and the `jumper` entry in `lib/games/registry.ts`. It inserts no catalog row and does not touch the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it is re-checked against the promoted core spec.

## Scope

**In:**

- **Spring pad.** A 24 × 10 px pad on top of a platform. Landing on it gives `vy = −JUMP_V × SPRING_MULT` with `SPRING_MULT = 1.5` (1,350 px/s, a 414 px peak) instead of the normal bounce. It appears on spine and decoy `normal` platforms from `score ≥ 150`, with probability 10 % per platform, at a random offset within the platform width, and never on a `crumble` or `moving` platform. A spring is always optional: skipping it leaves the climb reachable.
- **Moving platform.** A new kind `moving`, 72 × 14 px, sliding horizontally around its center `cx` at `MOVE_PLATFORM_SPEED = 70` px/s with an amplitude of `±60` px (triangle motion, reversing at the ends; the platform may wrap at the canvas edge like the spark). Unlock at `score ≥ 200`; 20 % of spine platforms from then on are `moving`.
  - Reachability: the spine offset rule uses the **center of travel** `cx`. When either end of a spine step is `moving`, `MAX_DX` for that step is 80 px instead of 140 px (80 + 60 = 140, the core limit, measured to the moving end). A `moving` platform is never a decoy and never carries a spring.
- **Drone.** A 40 × 28 px enemy that hovers in place in world space. Unlock at `score ≥ 250`. At most one drone per 600 px of climb.
  - Placement rule: its center `x` is at least 100 px (wrapped distance) from the centers of both adjacent spine platforms, and its `y` is between the two. This keeps the straight path between the two spine platforms free, so a drone never blocks the spine.
  - Contact: if the spark's feet are above the drone's center and `vy > 0` at the moment of overlap, it is a **stomp**: the drone is destroyed, the spark bounces with the normal `JUMP_V`, and `stomps + 1`. Any other overlap kills the spark: `state = "gameover"` and `onGameOver(score)` fires once.
  - Drones are removed when they fall 100 px below the camera bottom, like platforms.
- **Score.** `score = floor(riseMax / 10) + 10 × stomps`. The HUD `height` shows only `floor(riseMax / 10)`; the shell score includes the stomp bonus. New HUD field `stomps` (`number`, `initial: 0`). Registry entry updated with a second field after `height`; nothing else in the shell.
- **Generation limits** that the spring and the moving platform use: the spine gap cap `spineGapMax(score)` and `SPINE_GAP_MIN` do not change (150 / 60 px). A spring does not enlarge the gap range, so the spine stays solvable with no spring.
- Drawing (primitives only): spring as a yellow coil (compressed for 0.1 s after use); `moving` platform as a cyan bar with magenta end caps; drone as a magenta diamond with a cyan eye and a 4 px bobbing at 2 Hz; a +10 text over the drone for 0.5 s after a stomp. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: Games table row `jumper`, HUD column now height (`number`), stomps (`number`).

**Out of scope (for future specs):**

- Jetpack, shield, propeller and other power-ups.
- Drones that move, shoot or chase.
- More than one enemy type.
- Mouse steering.
- Sound and music.
- Touch mapping (done later by `@mobile-porter`).
- Skins and bitmap sprites.
- Realtime scores, auth-linked scores.
- New catalog copy: the core `long` text stays.

## Data model

No new tables, no new catalog row, no new `localStorage` keys.

```ts
// HUD fields in lib/games/registry.ts (replaces the core list)
hud: [
  { key: "height", label: "Altura", format: "number", initial: 0 },
  { key: "stomps", label: "Derribos", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { height, stomps } }
```

```ts
// lib/games/jumper/constants.ts (additions)
const SPRING = { w: 24, h: 10, mult: 1.5, chance: 0.1, from: 150 };
const MOVING = { speed: 70, amp: 60, chance: 0.2, from: 200, maxDx: 80 };
const DRONE = { w: 40, h: 28, from: 250, minSpacingPx: 600, minDxFromSpine: 100 };
const STOMP_BONUS = 10;
```

Conventions:

- Score = `floor(riseMax / 10) + 10 × stomps`, an integer far below 10,000,000. The engine keeps `riseMax` and `stomps` separately; `hud.height` is `floor(riseMax / 10)`.
- Unlock thresholds use `floor(riseMax / 10)` (the height without the stomp bonus), so stomps do not make the climb harder.
- Platform data adds `kind: "moving"` and, for a moving one, `cx`, `phase`; a platform may carry `spring: { offset }`. Drones are a separate list `{ x, y }`.
- The state `dead` stays unused.

## Implementation plan

1. Extend `constants.ts` with the spring, moving and drone data. Manual check: `npm run lint` passes.
2. Extend `platforms.ts`: `moving` spine platforms with the 80 px `maxDx` rule, springs, drone placement with the 100 px rule. Manual check: `npx tsc --noEmit` passes; a temporary run of 10,000 spine steps with moving ends never gives a travel-center offset above 80 px, and 10,000 drone placements never put a drone within 100 px of an adjacent spine center (remove the log after).
3. Extend `engine.ts`: moving platform motion, spring bounce, drone overlap (stomp or death), new score formula and snapshot with `hud.stomps`. Manual check: lint and tsc pass.
4. Extend the draw: spring, moving platform, drone, stomp text. Manual check: lint and tsc pass; each element is visible at its unlock height.
5. Add the second field to the `registry.ts` entry. Manual check: `/juegos/jumper/jugar` shows a second HUD item `Derribos` at 0 and it rises on a stomp.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

No new UI beyond canvas drawing of primitives; the shell is unchanged. If `/spec-impl` decides the spring or drone art needs a designed look, it must use `/frontend-design`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No second `games` row is inserted and no file outside `lib/games/jumper/`, `lib/games/registry.ts` and `CLAUDE.md` changes.
- [ ] The HUD shows `Altura` and `Derribos`; both are 0 at the start and after JUGAR DE NUEVO.
- [ ] No spring appears before height 150; a spring is 24 × 10 px and about 10 % of `normal` platforms from then on carry one.
- [ ] Landing on a spring gives `vy = −1350` px/s and a peak of 414 px (±6 px); a normal landing still peaks at 184 px.
- [ ] No spring appears on a `crumble` or `moving` platform.
- [ ] No `moving` platform appears before height 200; it slides at 70 px/s with an amplitude of ±60 px around its center.
- [ ] For every spine step where either platform is `moving`, the offset between travel centers is at most 80 px (wrapped); other spine steps still allow up to 140 px.
- [ ] No drone appears before height 250, and there is at most one per 600 px of climb.
- [ ] Every drone center is at least 100 px (wrapped) from the centers of both adjacent spine platforms.
- [ ] Landing on a drone from above while falling destroys it, bounces the spark at 900 px/s, adds 10 to the score and 1 to the HUD `Derribos`; the HUD `Altura` does not change from it.
- [ ] Touching a drone from the side, from below or while rising opens the game-over modal with the final score once.
- [ ] A run reaching height 120 with 2 stomps gives score `120 + 20 = 140`, HUD height 120 and HUD stomps 2.
- [ ] A scripted climb that ignores springs and drones can still climb 2,000 m using only spine platforms (core reachability criterion still holds).
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'jumper'` and the final score including the stomp bonus.
- [ ] PAUSA, `P` and `Esc` freeze the moving platforms and drones; resuming continues from the same positions.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/jumper/jugar` during a full session.

## Decisions

- **Yes:** a spring is a reward, never needed. **No:** springs in the spine path: a missed spring would not block the run, but a required one would.
- **Yes:** spring multiplier 1.5 (414 px peak). **No:** a larger boost: the generator would need to place platforms much higher, and falls from a spring would feel arbitrary.
- **Yes:** `moving` platforms may be in the spine, with `maxDx` 80 px from the travel center (80 + 60 amplitude = 140). **No:** keeping them decoys: they would never matter. **No:** the full 140 px: the far end would exceed the reachable offset.
- **Yes:** a drone is placed at least 100 px from both adjacent spine centers, so the spine path between them stays free. **No:** random drone positions: they could block the only reachable route.
- **Yes:** stomp bonus 10 points, the same as 10 m, so a drone is worth a short climb. **No:** a large bonus: the leaderboard would reward drone farming over height.
- **Yes:** HUD `height` shows metres only and the shell score includes stomps. **No:** merging them: the player would lose track of each source.
- **Yes:** unlock thresholds use the height without bonus. **No:** thresholds on the score: stomping would speed up difficulty.
- **Yes:** the new HUD field `stomps` uses the `number` format. **No:** a new format: only `number`, `hearts`, `pad2` exist.
- **Yes:** no second catalog row; `sort_order` and cover do not change.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Moving spine platforms make a jump unreachable at their far end         | `maxDx` 80 px from the travel center plus ±60 amplitude stays inside the 140 px core limit; step 2 checks it.   |
| A drone blocks the spine path                                           | 100 px minimum distance from both adjacent spine centers; step 2 checks 10,000 placements.                      |
| A spring launches the spark past the generated platforms                | Generation keeps platforms 1,440 px above the camera top; a 414 px peak is well inside it.                      |
| Stomp versus death is ambiguous at the edges                            | Rule is exact: feet above the drone center and `vy > 0` is a stomp; any other overlap is death.                 |
| Difficulty ramps by score would shift with stomp bonus                  | Thresholds use the height without bonus.                                                                        |
| Spring bounce hides the wrap behaviour of the moving platform           | Moving platforms wrap like the spark; criterion keeps the 80 px rule measured on wrapped distance.              |
| Next.js 16 differs from training data                                   | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- Jetpack, shield, propeller and other power-ups.
- Drones that move, shoot or chase, more than one enemy type.
- Mouse steering.
- Sound and music.
- Touch mapping.
- Skins and bitmap sprites.
- Realtime scores and auth-linked scores.
- New catalog copy.

Each one of those, if it lands, goes in its own spec.
