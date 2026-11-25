# SPEC JAM-arena-02 — Arena enemy variety and power-ups (ARENA)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-arena-01
> **Date:** 2026-11-25
> **Objective:** Add two new enemy types (rusher and tank) and three timed power-ups to ARENA, so later waves have more variety and a higher score ceiling.

## Why this spec exists

The core game has one enemy, the drone, so every wave plays the same with more bodies. This spec adds the layer that gives waves a shape: fast fragile rushers, slow armored tanks, and pickups that change how the player shoots for a few seconds. It builds only on `lib/games/arena/` from JAM-arena-01 and never changes the shell, the registry entry, the HUD or the catalog row.

This is a jam spec: it is not numbered yet. It is promoted after `JAM-arena-01`.

## Scope

**In:**

- New constants in `lib/games/arena/constants.ts` and an `entities.ts` file in `lib/games/arena/` holding the enemy type table and the power-up table (data only).
- Wave composition: the wave size stays `min(5 + 3 × (n − 1), 40)` from the core. For each wave, `rushers = floor(0.25 × size)` when `n ≥ 3` (else 0), `tanks = floor(0.15 × size)` when `n ≥ 5` (else 0), and the rest are drones. Spawn order inside the wave is shuffled; spawn interval stays 0.5 s.
- Enemy types (all circles, all walk straight toward the player, all removed on contact with the player as in the core):

  | Type      | Radius | HP | Speed                         | Points |
  | --------- | ------ | -- | ----------------------------- | ------ |
  | `drone`   | 10     | 1  | `min(90 + 8 × (n − 1), 180)`  | 10     |
  | `rusher`  | 8      | 1  | `min(2 × drone speed, 300)`   | 20     |
  | `tank`    | 16     | 3  | `0.6 × drone speed`           | 40     |

  A bullet hit does 1 damage; a tank hit but not killed flashes for 0.08 s and the bullet is removed.
- Power-ups: each enemy killed by a bullet drops a pickup with probability `DROP_CHANCE = 0.10` at its position (at most one pickup on the field; a drop is skipped when one already exists). The pickup is a circle of radius 9 that disappears after `PICKUP_LIFE = 8` s, blinking for the last 2 s. Walking over it (distance < 21) collects it: +25 points.

  | Power-up | Effect                                              | Duration |
  | -------- | --------------------------------------------------- | -------- |
  | `rapid`  | `FIRE_COOLDOWN` becomes 0.07 s                      | 8 s      |
  | `spread` | each shot fires 3 bullets at -12°, 0°, +12°         | 8 s      |
  | `shield` | the next hit is absorbed with no life lost; the shield ends after that hit or 10 s | 10 s |

  Kind is chosen uniformly among the three. Collecting a power-up replaces any active one of the same kind (timer resets) and keeps the others; `rapid` and `spread` can be active together. A shield absorbing a hit still removes the enemy and still gives 1.5 s of invulnerability.
- Drawing: each enemy type has its own shape and color (rusher a small diamond, tank a large ring with HP pips); each pickup has its own glyph; an active power-up is shown by a ring around the player (the ring is part of the world). The ring for `shield` shrinks in alpha during the last 2 s. Exact art is a detail for `/spec-impl`; any new UI element in the world uses `/frontend-design`.
- Timers for power-ups and pickups pause with the game (they use the same capped `dt`). All power-up state is cleared on restart and on game over.
- `CLAUDE.md` update: one line noting that ARENA has enemy types and power-ups. No change to the `games` table row.

**Out of scope (for future specs):**

- Enemy projectiles, bosses, enemies that split.
- Permanent upgrades between waves.
- A HUD field for the active power-up (the HUD stays `lives` and `wave`).
- Sound, touch controls, skins, gamepad.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no second catalog row. The registry entry and the snapshot stay exactly as in JAM-arena-01: `{ score, state, hud: { lives, wave } }`.

```ts
// lib/games/arena/entities.ts (data only)
type EnemyKind = "drone" | "rusher" | "tank";
type PowerKind = "rapid" | "spread" | "shield";
const ENEMIES: Record<EnemyKind, { r: number; hp: number; speedMul: number; points: number }> = {
  drone:  { r: 10, hp: 1, speedMul: 1,   points: 10 },
  rusher: { r: 8,  hp: 1, speedMul: 2,   points: 20 },
  tank:   { r: 16, hp: 3, speedMul: 0.6, points: 40 },
};
const DROP_CHANCE = 0.10, PICKUP_R = 9, PICKUP_LIFE = 8, PICKUP_POINTS = 25;
const RAPID_COOLDOWN = 0.07, SPREAD_ANGLE = 12; // degrees
const POWER_TIME: Record<PowerKind, number> = { rapid: 8, spread: 8, shield: 10 };
const RUSHER_FROM_WAVE = 3, RUSHER_SHARE = 0.25, TANK_FROM_WAVE = 5, TANK_SHARE = 0.15;
const RUSHER_SPEED_MAX = 300;
```

Conventions:

- The core `DRONE_*` constants stay in `constants.ts`; `ENEMIES.drone` reads them and must not duplicate their values elsewhere.
- Wave composition is computed once when a wave starts and stored as a shuffled list of `EnemyKind`.
- Score stays an integer between 0 and 10,000,000.

## Implementation plan

1. Create `lib/games/arena/entities.ts` with the tables above and extend `constants.ts` if needed. Manual check: `npm run lint` passes.
2. Refactor the core drone code in `engine.ts` to read its radius, HP, speed and points from `ENEMIES`, with no behaviour change. Manual check: waves 1 and 2 behave exactly as in the core criteria (5 drones at 90 px/s, 8 at 98 px/s).
3. Add wave composition (rushers from wave 3, tanks from wave 5), HP and hit flash. Manual check: with a temporary debug start at wave 5 (not committed), the field shows all three shapes; the tank needs 3 hits.
4. Add pickups: drop chance, lifetime, blink, collection and +25 points. Manual check: kill 40 enemies and see about 4 drops; an uncollected pickup disappears after 8 s.
5. Add the three power-up effects and the player ring, and clear all of it on restart and game over. Manual check: `rapid` doubles the fire rate, `spread` fires 3 bullets, `shield` absorbs one hit.
6. Update `CLAUDE.md`, then run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Waves 1 and 2 are identical to JAM-arena-01: 5 and 8 drones, no rushers, no tanks.
- [ ] Wave 3 (size 11) spawns exactly 2 rushers and 9 drones; wave 5 (size 17) spawns exactly 4 rushers, 2 tanks and 11 drones.
- [ ] A rusher moves at twice the drone speed of its wave (wave 3: 2 × 106 = 212 px/s) and never faster than 300 px/s; killing one adds 20.
- [ ] A tank moves at 0.6 × the drone speed of its wave, dies after exactly 3 bullet hits and adds 40.
- [ ] A kill drops a pickup with probability 0.10; no second pickup appears while one is on the field; an uncollected pickup disappears after 8 s.
- [ ] Collecting a pickup adds exactly 25 to the score.
- [ ] `rapid` makes the fire interval 0.07 s for 8 s and then returns it to 0.15 s.
- [ ] `spread` fires 3 bullets per shot at -12°, 0° and +12° for 8 s.
- [ ] `shield` absorbs one hit (no heart lost, enemy removed, 1.5 s invulnerability) and ends after that hit or after 10 s.
- [ ] `rapid` and `spread` can be active together; collecting the same kind again resets its timer.
- [ ] Pausing freezes power-up and pickup timers; resuming does not skip time.
- [ ] JUGAR DE NUEVO and game over clear all power-ups and pickups.
- [ ] The HUD still shows only `Vidas` and `Oleada`; the registry entry and the `games` row are unchanged.
- [ ] No console errors during a full session through wave 6.
- [ ] The five existing games still play exactly as before.

## Decisions

- **Yes:** enemy and power-up data in `entities.ts`, behaviour in `engine.ts`. **No:** a second engine file: one closure is enough.
- **Yes:** wave size unchanged; new types replace drones inside it. **No:** extra enemies on top: it would break the core balance.
- **Yes:** rushers from wave 3 and tanks from wave 5, in fixed shares. **No:** random composition: it makes scores less comparable between runs.
- **Yes:** at most one pickup at a time, 10% drop chance. **No:** guaranteed drops: they would trivialize waves.
- **Yes:** `rapid` and `spread` stack; `shield` is separate. **No:** one power-up at a time: it wastes pickups.
- **Yes:** pickups give +25. **No:** no points: players would ignore them near danger.
- **Yes:** the HUD stays as in the core and the player ring shows active power-ups. **No:** a new HUD field: it would change the registry and the shell contract.
- **Yes:** no second catalog row and no migration. **No:** a new game row for a feature.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Refactoring the drone code changes core behaviour                       | Step 2 is a pure refactor with the core criteria for waves 1 and 2 as the check.           |
| Rushers at 300 px/s feel unfair near the player                         | Invulnerability and the 300 px/s cap; numbers live in `entities.ts` for later tuning.      |
| `spread` plus `rapid` creates many bullets                              | Bullets are removed off-canvas; at most about 43 bullets per second, 3 per shot, are alive.|
| Timers keep running while paused                                        | They use the same capped `dt`, which is 0 on the first frame after resume and skipped paused.|
| Pickup drawn under enemies and missed                                   | Draw pickups after enemies and before the player.                                           |
| New art needs UI design                                                 | `/spec-impl` uses `/frontend-design` for the shapes; this spec fixes only gameplay values.  |

## What is **not** in this spec

- Enemy projectiles, bosses and splitting enemies.
- Permanent upgrades between waves.
- A HUD field for power-ups.
- Sound, touch controls, skins and gamepad.
- Any other game.

Each one of those, if it lands, goes in its own spec.
