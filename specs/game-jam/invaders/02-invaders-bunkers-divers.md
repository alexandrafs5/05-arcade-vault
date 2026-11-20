# SPEC JAM-invaders-02 — Hive Raid bunkers and divers (INVADERS)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-invaders-01
> **Date:** 2026-11-20
> **Objective:** Add destructible bunkers, diving elite aliens and a no-hit wave bonus to HIVE RAID, so each wave plays differently and skilled players score higher.

## Why this spec exists

JAM-invaders-01 is a complete game, but every wave plays the same way: the formation marches and the player shoots. This spec adds the layer that makes waves differ: cover that erodes, aliens that break formation from wave 3, and a bonus for clean waves. It changes only `lib/games/invaders/` and the registry-independent engine behaviour; the shell, the registry entry, the catalog row and the cover stay as the core spec left them.

It is a jam spec: it is not numbered yet and is promoted after `JAM-invaders-01` (as `specs/NN-invaders-bunkers-game.md`).

## Scope

**In:**

- Four bunkers drawn and simulated as grids of 8 px blocks.
- Diver aliens that leave the formation from wave 3.
- A no-hit wave bonus.
- Constants and entity types for the above in `lib/games/invaders/constants.ts` and `entities.ts`; logic in `engine.ts`.
- Criteria and the `CLAUDE.md` Games table note (canvas notes: "bitmap aliens, bunkers, divers").
- The same engine behaviour rules as the core spec (dt cap, input clearing, listener cleanup, `onChange` only on change).

**Out of scope (for future specs):**

- Power-ups, weapon upgrades, boss waves.
- New alien types, new bunker shapes per wave.
- Sound, touch, gamepad, skins.
- Any change to the shell, `registry.ts`, the catalog row or the cover.
- Automated tests.

## Data model

No catalog row (the `invaders` row comes from JAM-invaders-01), no new tables, no new `localStorage` keys, no new HUD field. The snapshot is unchanged: `{ score, state, hud: { lives, wave } }`.

```ts
// added to lib/games/invaders/constants.ts
const BUNKER = { count: 4, centers: [70, 210, 350, 490], y: 500, cols: 7, rows: 4, block: 8 };
// block grid is 7 x 4 = 56 x 32 px; the bottom row has its middle 3 blocks (cols 2-4) empty -> 25 blocks per bunker
const DIVER = { firstWave: 3, speed: 150, amplitude: 40, freq: 3.0, points: 50, maxOnScreen: [1, 2] };
// maxOnScreen[0] = 1 for waves 3-5, maxOnScreen[1] = 2 from wave 6
const DIVER_INTERVAL = (wave: number) => Math.max(4, 10 - (wave - 3)); // seconds
const CLEAN_WAVE_BONUS = 250;
```

Conventions:

- A bunker is `{ x, y, blocks: boolean[rows][cols] }` with `x = center − 28`. Block `(c, r)` occupies `x + c × 8, y + r × 8`, size 8×8.
- A diver is `{ x0, y, t, col, row, type }`: `x = x0 + 40 × sin(3.0 × t)` and `y` increases at 150 px/s. It keeps its alien type and bitmap, drawn with a white outline to tell it from the formation.
- A diver is removed from its formation slot when it leaves (the slot becomes empty); the formation step speed and edge tests count formation aliens only.
- `lostLifeThisWave` is a boolean reset at each `startWave`.

## Implementation plan

1. Extend `constants.ts` and `entities.ts` with `BUNKER`, `DIVER`, `DIVER_INTERVAL`, `CLEAN_WAVE_BONUS` and the types `Bunker`, `Diver`, plus pure helpers `createBunkers()` and `blockAt(bunker, x, y)`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
2. In `engine.ts`, create the bunkers in `reset` and re-create them (full 25 blocks each) in `startWave`; draw them in `draw` (same color family as the cannon, dimmer: cyan at 60 % alpha). Manual check: four bunkers show at y = 500 in every wave.
3. Add bunker collisions: a player bullet or an alien bullet that overlaps a living block removes that block and the bullet; a formation alien whose rectangle overlaps living blocks removes all of them. Manual check: shooting up into a bunker erodes it block by block; an alien descending onto a bunker erases it.
4. Add divers: from wave 3, a timer picks the lowest living alien of a random column and turns it into a diver; at most `maxOnScreen` at once; the diver follows the sine path, is destroyed by a player bullet (+50), costs a life if it overlaps the cannon (the diver also dies), and is removed silently when `y > 640`. Wave clear requires zero formation aliens and zero divers. Manual check: in wave 3 a diver appears after 10 s.
5. Add the no-hit bonus: on wave clear, if `lostLifeThisWave` is false add `CLEAN_WAVE_BONUS` after the `100 × wave` bonus. Manual check: a clean wave 1 adds 100 + 250.
6. Update `CLAUDE.md` Games table note for `invaders`. Run `npm run lint` and `npm run build`.

No new UI element is created (the bunkers and divers are in-canvas world drawing and the shell is unchanged), so `/frontend-design` is not required.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors; the `games` table is unchanged by this spec.
- [ ] Every wave starts with 4 bunkers at x = 42, 182, 322, 462 (left edges) and y = 500, each with exactly 25 blocks.
- [ ] A player bullet or an alien bullet that hits a block removes exactly 1 block and the bullet.
- [ ] A formation alien that overlaps blocks removes every overlapped block.
- [ ] Bunkers are restored to 25 blocks each at the start of the next wave.
- [ ] No diver appears in waves 1 and 2.
- [ ] In wave 3, the first diver leaves the formation 10 s after the wave starts; in wave 4 the interval is 9 s; it never drops below 4 s.
- [ ] Waves 3–5 never show more than 1 diver at once; wave 6 and later show at most 2.
- [ ] A diver moves down at 150 px/s along `x0 + 40 × sin(3.0 t)` and is drawn with a white outline.
- [ ] Shooting a diver adds exactly 50 to the score; a diver that reaches `y > 640` adds nothing and costs no life.
- [ ] A diver overlapping the cannon costs 1 life, destroys the diver and applies the 1.5 s invulnerability from the core spec.
- [ ] A diver's former slot stays empty: the formation does not step faster or slower because of a diving alien beyond the alive count.
- [ ] A wave is not cleared while a diver is on screen; once the last alien and diver are gone the wave bonus is paid once.
- [ ] Clearing a wave without losing a life adds `100 × wave + 250`; clearing it after losing a life adds only `100 × wave`.
- [ ] HUD fields, registry entry, catalog row and cover are unchanged; the shell files are unchanged in the diff.
- [ ] PAUSA freezes bunkers, bullets and divers; resuming causes no jump.
- [ ] JUGAR DE NUEVO restores bunkers, clears divers and resets `lostLifeThisWave`; no duplicate loops run.
- [ ] No console errors during a full session through wave 6.

## Decisions

- **Yes:** one block removed per bullet. **No:** area damage: simpler to verify and bunkers still last several hits.
- **Yes:** bunkers fully restored every wave. **No:** persistent damage: a bad wave 1 would doom the run.
- **Yes:** divers start at wave 3 and are capped by wave. **No:** divers from wave 1: the base game must stay readable first.
- **Yes:** divers give a flat 50. **No:** type-based values: a diver is a risk reduction, not a bonus hunt.
- **Yes:** the no-hit bonus is 250 flat. **No:** a multiplier: integers stay verifiable.
- **Yes:** no new HUD field. **No:** a bunker or diver counter: the shell shows only the standing fields.
- **Yes:** feature spec adds no catalog row and does not touch the shell. **No:** a second `games` row.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                    | Mitigation                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Bunker block collision per bullet costs frame time                      | Check only bunkers whose bounding box overlaps the bullet; 100 blocks in total is small.             |
| Divers make the wave unwinnable or unclearable (stuck diver)            | A diver always leaves the screen at `y > 640`, so the wave-clear check cannot wait forever.          |
| The core step interval drifts because divers change the alive count     | The alive count used in `stepInterval` is formation aliens only; criterion pins it.                  |
| Core and feature specs promoted out of order                            | `Depends on` lists JAM-invaders-01; promote the core first.                                          |
| Bunkers at y = 500 collide with the "formation lands" line at 584       | Aliens erase bunkers on contact; the landing rule from the core spec is unchanged and checked first. |

## What is **not** in this spec

- Power-ups, weapon upgrades, boss waves.
- New alien types or per-wave bunker shapes.
- Sound, touch controls, gamepad, skins.
- Changes to the shell, the registry entry, the catalog row or the cover.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
