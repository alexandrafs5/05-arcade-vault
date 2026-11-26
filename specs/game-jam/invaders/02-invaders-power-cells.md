# SPEC JAM-invaders-02 — Power cells and elite Splitters (INVADERS)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-invaders-01
> **Date:** 2026-11-26
> **Objective:** Add dropped power cells (rapid fire, wide shot, mend) and an elite alien that splits when killed to INVADERS, so each wave offers risky choices beyond aiming.

## Why this spec exists

`JAM-invaders-01` is a faithful score-chase: one bullet, fixed rules. This spec adds the theme layer that makes runs differ: Commanders sometimes drop power cells the player has to catch while dodging bombs, and from wave 3 a Splitter alien replaces one Weaver and punishes careless shooting. It only touches `lib/games/invaders/` and one registry entry; the shell is not changed and no catalog row is added.

## Scope

**In:**

- Power cells: a killed Commander drops a cell with probability 0.30. The cell is 14×14, falls at 110 px/s and is removed at `y > 640`. Touching it with the ship collects it. The type follows the drop count: `[rapid, wide, mend][dropCount % 3]`, where `dropCount` counts cells dropped in the game.
  - `rapid`: for 8 s the ship may have up to 3 bullets on screen at once.
  - `wide`: for 8 s each shot fires 3 bullets (center, and left and right at ±12° from vertical); the three count as one shot for `shotsFired` and the one-bullet limit.
  - `mend`: rebuilds all bunker blocks and adds 1 life (maximum 5). No timer.
  - Collecting any cell gives 25 points. Collecting a timed cell while another is active replaces it and resets the timer to 8 s.
  - Losing a life clears the active power.
- Splitter: from wave 3, one Weaver per wave (a random Weaver slot chosen at wave build) is a Splitter. It takes 1 hit, is worth 40 points, and on death spawns 2 Drones that start at its position and fall straight down at 90 px/s for at most 2 s as free-falling "shards": a shard that touches the ship counts as a bomb hit; a shard disappears at `y > 640` or when a bullet hits it (5 points). Shards do not count toward the max bombs and do not block the wave from ending (a wave is clear when all 40 formation slots are dead).
- New HUD field `power` (`number`, label `Poder`): remaining seconds of the active timed power, rounded up, 0 when none (`mend` never shows).
- Drawing: cell silhouettes by type, the Splitter with a visible seam, shards and a power indicator tint on the ship. These are new UI elements: `/spec-impl` must use `/frontend-design`.
- `CLAUDE.md` update: the `invaders` row HUD column becomes lives, wave, power.

**Out of scope (for future specs):**

- Boss waves and new alien types beyond the Splitter.
- Permanent upgrades between runs.
- Sound and music.
- Touch controls, gamepad, multiplayer.
- Neon recolor.
- Automated tests.
- Any other game.

## Data model

No new tables, no new catalog row, no migration. The `games` row of `invaders` is unchanged. Scores stay integers far below 10,000,000.

```ts
// lib/games/invaders/constants.ts (additions)
const CELL = { w: 14, h: 14, speed: 110, dropChance: 0.3, points: 25 };
const POWER_ORDER = ["rapid", "wide", "mend"] as const, POWER_TIME = 8;
const RAPID_MAX_BULLETS = 3, WIDE_ANGLE_DEG = 12, LIVES_MAX = 5;
const SPLITTER = { fromWave: 3, points: 40, shards: 2, shardSpeed: 90, shardLife: 2, shardPoints: 5 };
```

```ts
// HUD fields in lib/games/registry.ts (invaders)
hud: [
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "wave", label: "Oleada", format: "pad2", initial: 1 },
  { key: "power", label: "Poder", format: "number", initial: 0 },
],
// Snapshot: { score, state, hud: { lives, wave, power } }
```

Conventions:

- Active power is `{ type: "rapid" | "wide", left: number } | null`; `left` counts down with capped `dt` and freezes while paused.
- `wide` bullets share a `volleyId`; the one-bullet limit means "no volley in flight" in the default state and "no more than 3 bullets" for `rapid`.
- Only the first 3 waves can have no cells in play beyond chance; there is no guaranteed drop.
- Splitter and shard state lives in the same arrays as aliens and bombs with a `kind` flag; no separate loop.

## Implementation plan

1. Add the constants to `lib/games/invaders/constants.ts`. Manual check: `npm run lint` passes.
2. In `engine.ts`, add cell drops, falling, collection and the three powers (`rapid` bullet limit, `wide` volley, `mend`), the 8 s timer and the `power` HUD value. Manual check: `npx tsc --noEmit` passes; each power works in the browser.
3. In `engine.ts`, add the Splitter slot choice from wave 3, its death and shards. Manual check: wave 3 has exactly one Splitter and its death spawns 2 shards.
4. Draw cells, Splitter, shards and the ship tint with `/frontend-design`. Manual check: all new elements are readable at 375 px width.
5. Add the `power` field to the `invaders` entry in `registry.ts`. Manual check: the HUD shows `Poder` and it resets on JUGAR DE NUEVO.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] Over 1,000 simulated Commander kills in a dev check, between 27% and 33% drop a cell.
- [ ] Cell types follow `rapid`, `wide`, `mend`, `rapid`, ... in drop order.
- [ ] A cell falls at 110 px/s and is removed below `y = 640`; collecting one adds exactly 25 points.
- [ ] With `rapid` active the ship can have 3 bullets on screen; with no power it still has at most 1.
- [ ] With `wide` active each shot spawns 3 bullets at 0° and ±12°, and `shotsFired` increases by 1 per shot.
- [ ] `rapid` and `wide` last exactly 8 s of play time; HUD `Poder` counts 8 down to 0, freezes while paused and replaces on a second cell.
- [ ] `mend` rebuilds every bunker block and raises hearts by 1, never above 5.
- [ ] Losing a life clears the active power (HUD `Poder` returns to 0).
- [ ] Waves 1 and 2 have no Splitter; from wave 3 there is exactly one, replacing a Weaver.
- [ ] Killing a Splitter adds 40 points and spawns 2 shards that fall at 90 px/s; a shard that touches the ship costs 1 life, a shard hit by a bullet adds 5 points, and a shard disappears after 2 s or below `y = 640`.
- [ ] A wave ends when all 40 formation slots are dead, even if shards are still falling (shards are removed at the wave change).
- [ ] JUGAR DE NUEVO clears cells, shards, the active power and the drop counter.
- [ ] HUD shows `Vidas`, `Oleada` and `Poder`; no shell, catalog row or migration change is part of this spec.
- [ ] Core rules (one bullet by default, scoring 30 / 20 / 10, comet values, bunkers, floor game over) still behave as in `JAM-invaders-01`.
- [ ] The saved score still goes through `saveScore` with `game_id = 'invaders'`.
- [ ] No console errors during a full session.

## Decisions

- **Yes:** cells from Commanders only, 30% chance. A rare drop makes the top row a target worth the risk. **No:** drops from every alien: power would be constant.
- **Yes:** deterministic type order. Players can plan around it and runs stay comparable. **No:** random type per cell.
- **Yes:** `rapid` and `wide` timed at 8 s, `mend` instant. **No:** permanent powers: the score race would depend on a single lucky drop.
- **Yes:** `mend` gives +1 life up to 5. This is the only extra life in the game. **No:** uncapped lives.
- **Yes:** the Splitter's shards are a bomb-like danger that can also be shot for points. **No:** a separate alien wave: it would grow beyond this spec.
- **Yes:** a Splitter replaces a Weaver (never adds a 41st alien), so the wave size stays 40. **No:** changing the grid.
- **Yes:** new HUD field `power` in `number` format. **No:** a new HUD format: the shell must not change.
- **Yes:** no second catalog row and no migration. **No:** duplicating the core scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                  | Mitigation                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `wide` and `rapid` trivialize the early waves                         | 8 s timers, drop chance 0.30, bullet limit 3, and shard and bomb pressure scale with waves.         |
| `HUD power` ticks every second and spams re-renders                   | Only the rounded-up second is in the snapshot; `onChange` fires once per second at most.            |
| Volley bookkeeping breaks the one-bullet rule                         | One `volleyId` per shot; the limit counts volleys, not bullets, in the default state.               |
| Shards feel unfair (hit from above with no warning)                   | Shards start at the Splitter's position, fall slowly (90 px/s) and tint distinctly; 2 s lifetime.    |
| Mend gives too much safety                                            | Only one cell in three, max 5 hearts, and it also rebuilds bunkers only once per cell.              |
| Next.js 16 differs from training data                                 | No Next code is touched; if the shell must change, stop and ask.                                   |

## What is **not** in this spec

- Boss waves and new alien types beyond the Splitter.
- Permanent upgrades between runs.
- Sound and music.
- Touch controls, gamepad and multiplayer.
- Neon recolor.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
