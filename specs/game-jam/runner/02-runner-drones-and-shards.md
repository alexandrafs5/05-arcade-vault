# SPEC JAM-runner-02 — Neon Runner drones, ducking, shards and districts

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-runner-01
> **Date:** 2026-11-18
> **Objective:** Add flying drones with a duck key, collectible shards worth bonus metres and four colored districts to NEON RUNNER, so runs have a second skill and a reason to take risks.

## Why this spec exists

`JAM-runner-01` ships a playable one-key runner: gaps and rooftop machinery, tap or hold jump. It is clean but one-dimensional: the only question is when to jump. This spec is the theme layer: air obstacles that need a different move (duck), collectibles placed along risky jump arcs, and a district change every 500 m so the long runs have landmarks.

The result is a distinct ruleset of the same game: same courier, physics and track generator, plus a second input and a score that rewards risk. It only changes files under `lib/games/runner/` and the `runner` entry in `lib/games/registry.ts`. It inserts no catalog row and does not touch the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it is re-checked against the promoted core spec.

## Scope

**In:**

- Duck: `↓` or `S` while grounded makes the runner crouch. The hitbox becomes 22 × 20 px (top at `GROUND_Y − 20`) for as long as the key is held and the runner is grounded. Ducking in the air does nothing. Releasing the key stands the runner up at once. A jump pressed while ducking jumps normally and stands up.
- Drone: a new beat type, 34 × 14 px, bottom edge at `GROUND_Y − 26` (top at `GROUND_Y − 40`). A standing runner (top at `GROUND_Y − 40`) collides with it, a ducking runner (top at `GROUND_Y − 20`) passes under it, and a jump that clears `GROUND_Y − 40` passes over it. Drones hover in place in world space and are generated only after 300 m (`score ≥ 300`). They count as a beat in the track generator: same rest rule (0.85 s), never over a gap and never within `speed × 0.5` px of a slab edge. Picked with probability 30 % among obstacles once unlocked (vent 42 %, antenna 28 %).
- Shards: collectible diamonds 14 × 14 px. After a gap or antenna beat, the generator may place an arc of 5 shards following the full-jump trajectory over that beat (probability 50 %, never over a drone beat). Shards sit on the jump arc centerline; taking one costs no extra jump because the arc is the same one used to clear the beat. Each collected shard gives `SHARD_BONUS = 10` points. Overlapping the runner hitbox collects it.
- Score: `score = floor(distancePx / 20) + 10 × shards`. The HUD `distance` is only `floor(distancePx / 20)`; the shell score includes the bonus. New HUD field `shards` (`number`, `initial: 0`), the shards collected in this run. Registry entry updated with a second field after `distance`; nothing else in the shell.
- Districts: a visual theme per 500 m of distance, cycling in this order: `0–499 m` `neon` (core palette), `500–999 m` `violet` (sky `#1a0b2e`, edge `#ff006e`), `1000–1499 m` `jade` (sky `#04201a`, edge `#00ff88`), `1500–1999 m` `ice` (sky `#06202e`, edge `#00f5ff`), then it repeats from `neon`. The change blends over 120 px of scroll. Districts change colors only: no rule or speed changes.
- Speed: unchanged (300 to 720 px/s); the drone rule uses the same `REST_SEC`.
- Drawing (primitives only): drones as a thin magenta body with a cyan rotor line that blinks every 0.1 s; shards as a yellow diamond with a pulse of 6 % size at 3 Hz; the ducking runner as a compressed body with the trail kept. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: Games table row `runner`, HUD column now distance (`number`), shards (`number`), plus the note that district colors live in `constants.ts`.

**Out of scope (for future specs):**

- More air obstacles, moving drones, enemies that shoot.
- Magnet, shield, double jump or any power-up.
- Lives.
- Sound and music.
- Touch mapping for duck (done later by `@mobile-porter`).
- Skins and bitmap sprites.
- Realtime scores, auth-linked scores.
- New catalog copy: the core `long` text stays.

## Data model

No new tables, no new catalog row, no new `localStorage` keys.

```ts
// HUD fields in lib/games/registry.ts (replaces the core list)
hud: [
  { key: "distance", label: "Distancia", format: "number", initial: 0 },
  { key: "shards", label: "Cristales", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { distance, shards } }
```

```ts
// lib/games/runner/constants.ts (additions)
const DUCK_H = 20;
const DRONE = { w: 34, h: 14, bottom: 26 }; // bottom edge = GROUND_Y - 26
const DRONE_UNLOCK_M = 300;
const SHARD = { size: 14, bonus: 10, arc: 5, chance: 0.5 };
const DISTRICT_M = 500;
const DISTRICTS = [
  { key: "neon", sky: "#0a0a18", edge: "#f5ff00" },
  { key: "violet", sky: "#1a0b2e", edge: "#ff006e" },
  { key: "jade", sky: "#04201a", edge: "#00ff88" },
  { key: "ice", sky: "#06202e", edge: "#00f5ff" },
];
```

Conventions:

- Score = `floor(distancePx / 20) + 10 × shards`, an integer far below 10,000,000. The engine keeps `distanceM` and `shards` separately; `hud.distance` is `distanceM`.
- Districts are chosen by `floor(distanceM / 500) % 4`, using distance only (bonus shards do not change the district).
- The state `dead` stays unused.

## Implementation plan

1. Extend `constants.ts` with the duck, drone, shard and district data. Manual check: `npm run lint` passes.
2. Extend `track.ts`: drone beat (unlock at 300 m, 30 % share, same rest and edge margins) and shard arcs over gap and antenna beats. Manual check: `npx tsc --noEmit` passes; a temporary run of 10,000 beats at speed 500 never places a drone over a gap or within `0.5 × speed` px of an edge, and places shard arcs in about 50 % of gap and antenna beats (remove the log after).
3. Extend `engine.ts`: duck input (`↓`, `S`), crouched hitbox, drone collision, shard pickup, new score formula and snapshot with `hud.shards`. `preventDefault` also on `ArrowDown`. Manual check: lint and tsc pass.
4. Extend the draw: drones, shards, crouch pose, district palette blend. Manual check: lint and tsc pass; a district change shows at 500 m.
5. Add the second field to the `registry.ts` entry. Manual check: `/juegos/runner/jugar` shows a second HUD item `Cristales` at 0 and it rises on pickup.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

No new UI beyond canvas drawing of primitives; the shell is unchanged. If `/spec-impl` decides the district art needs a designed look, it must use `/frontend-design`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No second `games` row is inserted and no file outside `lib/games/runner/`, `lib/games/registry.ts` and `CLAUDE.md` changes.
- [ ] The HUD shows `Distancia` and `Cristales`; both are 0 at the start and after JUGAR DE NUEVO.
- [ ] Holding `↓` or `S` on a roof shrinks the hitbox to 22 × 20 px; releasing it restores 22 × 40 px; pressing it in the air has no effect.
- [ ] No drone appears before 300 m of distance; from 300 m on, drones are about 30 % of obstacle beats.
- [ ] A drone is 34 × 14 px with its bottom at 26 px above the roof; a standing runner dies on contact, a ducking runner passes under it, and a full-hold jump passes over it.
- [ ] No drone is generated over a gap or within `0.5 × speed` px of a slab edge, and the 0.85 s rest between beats still holds.
- [ ] Shard arcs of 5 appear after gap and antenna beats about half of the time and never after a drone beat.
- [ ] Collecting one shard adds exactly 10 to the score and 1 to the HUD `Cristales`; the HUD `Distancia` does not change from it.
- [ ] A run of 1,000 px with 3 shards collected gives score `50 + 30 = 80`, HUD distance 50 and HUD shards 3.
- [ ] Districts change at 500 m, 1,000 m, 1,500 m and 2,000 m (`neon`, `violet`, `jade`, `ice`, `neon`) with a 120 px blend and no change in speed or physics.
- [ ] Death opens the game-over modal with the final score (distance plus shard bonus) once; GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'runner'` and that score.
- [ ] `↓` and `S` do not scroll the page while the game is mounted; typing in an `INPUT` is not blocked.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; a ducking runner stays ducked after resume only if the key is still held.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/runner/jugar` during a full session.

## Decisions

- **Yes:** ducking on `↓` / `S`, a second skill that is cheap to learn. **No:** a slide with a timer: more rules for no extra decision.
- **Yes:** a drone can also be jumped over. **No:** forcing the duck: it would break the one-solution rule that keeps the core simple and gives expert players a risky route.
- **Yes:** drones unlock at 300 m so the first minute stays the core game. **No:** drones from the start: new players would meet two skills at once.
- **Yes:** shard arcs follow the clearing trajectory, so they reward clean jumps rather than detours. **No:** shards placed at random heights: they would ask for extra jumps that can kill.
- **Yes:** shard bonus is 10 points each, equal to 10 metres. A 5-shard arc pays 50, the same as 1,000 px of running. **No:** a much larger value: shards would outweigh distance.
- **Yes:** HUD `distance` shows metres only and the shell score includes shards. **No:** merging them in the HUD: the player would lose track of what each source pays.
- **Yes:** districts only change colors. **No:** district rules: they would need their own tuning.
- **Yes:** the new HUD field `shards` uses the `number` format. **No:** a new format: only `number`, `hearts`, `pad2` exist.
- **Yes:** no second catalog row; `sort_order` and cover do not change.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Drone and obstacle rules make a beat unsolvable                         | Drones use the same rest and edge margin; both the duck and the jump clear a drone; step 2 checks 10,000 beats. |
| Players cannot tell what `Cristales` adds to the score                  | Criterion fixes the formula; the HUD label and the shell score make the difference visible.                     |
| `↓` also scrolls the page                                               | `preventDefault` on `ArrowDown` while mounted, except in `INPUT` and `TEXTAREA`.                                |
| Duck key stuck after pause or blur                                      | Input is cleared on `setPaused`, on `window` blur and on `stop`, so the runner stands up.                       |
| Shard arcs hide obstacles visually                                      | Shards are 14 px, drawn behind the runner and obstacles; `/spec-impl` checks readability at 720 px/s.           |
| A second key breaks the one-key `@mobile-porter` mapping                | Button A = jump (`Space`), the d-pad down arrow = duck; both already exist in the SPEC 10 pad.                  |
| Next.js 16 differs from training data                                   | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- More air obstacles, moving drones, shooting enemies.
- Magnet, shield, double jump or any power-up.
- Lives.
- Sound and music.
- Touch mapping for duck.
- Skins and bitmap sprites.
- Realtime scores and auth-linked scores.
- New catalog copy.

Each one of those, if it lands, goes in its own spec.
