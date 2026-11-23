# SPEC JAM-dragrush-02 — Moto Drag Rush nitro, track conditions and boss rivals (DRAGRUSH)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-dragrush-01
> **Date:** 2026-11-23
> **Objective:** Add nitro charges, a three-race track-condition cycle and a boss rival every fifth race to DRAGRUSH, so races stop feeling the same and high scores keep a skill ceiling above the core.

## Why this spec exists

`JAM-dragrush-01` ships a playable race loop, and its own risk table admits the weak point: repetitive gameplay and a rival floor (8.4 s) that sits almost on top of a perfect run (about 8.5 s). This spec is the theme layer that fixes both. Perfect shifts now fill a nitro tank the player spends on purpose, the track changes every race (dry, wet, headwind), and every fifth race is a boss duel with a faster rival and a big prize. Decisions now matter: when to burn nitro and which race to risk it on.

Everything here is engine-internal. The shell, the registry entry, the HUD fields and the catalog row stay as the core left them. This spec lists only what it adds or changes; it does not insert a second catalog row.

## Scope

**In:**

- Edit `lib/games/dragrush/constants.ts` and `lib/games/dragrush/engine.ts` only (plus `CLAUDE.md`). No change to `lib/games/registry.ts`, the migration, the cover or the shell.
- Nitro:
  - Tank of 0 to 3 charges, shown in the world as three pips above the rev bar (`y 280`, starting at `x 40`). It resets to 0 at the start of every race.
  - Each perfect shift adds 1 charge (max 3). A perfect launch adds nothing.
  - Key `N` or `↓` burns 1 charge: for 1.2 s acceleration is multiplied by 1.6. Only while the phase is `racing` and the bike has launched. A burn pressed while another is active is ignored and costs nothing.
  - Nitro multiplies with the rev limiter and bog multipliers (all are plain multipliers on `ACCEL[gear]`).
  - `↓` is already `preventDefault`-ed by the core; `N` needs no prevention.
- Track conditions, by race number `n`: `CONDITIONS[(n − 1) % 3]` with `CONDITIONS = ["dry", "wet", "headwind"]`:
  - `dry`: no change (race 1 is always dry).
  - `wet`: the perfect-window width is multiplied by 0.7 and never goes below 0.03; win points multiplied by 1.25. Drawn with rain streaks.
  - `headwind`: player `ACCEL` multiplied by 0.93; `rivalTime` gets +0.35 s; win points multiplied by 1.15. Drawn with horizontal speed lines.
- Boss races: every race with `n % 5 === 0`:
  - `rivalTime` gets −0.4 s (applied after the base, the condition and the jitter).
  - Win base becomes `1000 + 2000`.
  - The rival bike is drawn in magenta with a flame trail; the finish banner is red.
- New win formula (replaces the core one): `round((1000 + (boss ? 2000 : 0) + round((rivalTime − playerTime) × 500)) × conditionMultiplier)`. It is evaluated only on a win, so the margin term is never negative.
- `CLAUDE.md` update: the `dragrush` row Canvas notes mention nitro, conditions and boss races.

**Out of scope (for future specs):**

- A shop or upgrades between races.
- More conditions (night, oil patches) or more boss types.
- New HUD fields (nitro stays in the world, not in the HUD).
- Sound and music, touch controls, gamepad, skins.
- Multiplayer or ghost replays.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no catalog row. HUD fields and snapshot stay `gear` (`number`, initial 1) and `lap` (`pad2`, initial 1); the snapshot shape does not change.

```ts
// added to lib/games/dragrush/constants.ts
const NITRO_MAX = 3, NITRO_S = 1.2, NITRO_MUL = 1.6;
const CONDITIONS = ["dry", "wet", "headwind"] as const;
const CONDITION_RULES = {
  dry:      { windowMul: 1,   accelMul: 1,    rivalAdd: 0,    winMul: 1 },
  wet:      { windowMul: 0.7, accelMul: 1,    rivalAdd: 0,    winMul: 1.25 },
  headwind: { windowMul: 1,   accelMul: 0.93, rivalAdd: 0.35, winMul: 1.15 },
} as const;
const WINDOW_MIN_WET = 0.03;
const BOSS_EVERY = 5, BOSS_RIVAL_SUB = 0.4, BOSS_WIN_BONUS = 2000;
```

Conventions:

- Acceleration per sub-step becomes `ACCEL[gear] × accelMul × bogMul × limiterMul × nitroMul`.
- Window width for race `n` is `windowWidth(n)` in dry and headwind races, and `max(0.03, windowWidth(n) × 0.7)` in wet races.
- Rival time for race `n`: `rivalBase(n) + rivalAdd − random[0, 0.3] − (boss ? 0.4 : 0)`. Examples: race 5 is wet and boss, so its rival time is between 8.3 s and 8.6 s; race 10 is dry and boss, so it is between 7.7 s and 8.0 s.
- The private phase list from the core is unchanged. The engine keeps two extra private fields: `nitroCharges` and `nitroTimeLeft`.

## Implementation plan

1. Add the constants above to `lib/games/dragrush/constants.ts`. Manual check: `npm run lint` passes and the game still plays as in the core.
2. Engine: add `conditionFor(n)`, `isBoss(n)`, apply the window width, `accelMul` and `rivalAdd` rules in `startRace`, and the new win formula. Manual check: race 2 shows a narrower green window; race 3 shows a rival time 0.35 s higher (log it temporarily); `npx tsc --noEmit` passes.
3. Engine: add nitro state, charge on perfect shift, `N` / `↓` burn, reset per race; the snapshot stays unchanged. Manual check: three perfect shifts fill three pips; `N` burns one and the bike visibly accelerates harder for 1.2 s.
4. Engine: draw the three nitro pips, rain streaks (wet), speed lines (headwind), the magenta boss rival with flame trail and the red finish banner. Use `/frontend-design` for these new visual elements (project rule for UI). Manual check: each of the three conditions and a boss race are visually distinct at 640×360.
5. Update `CLAUDE.md`. Manual check: the `dragrush` row reads correctly.
6. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No migration, registry or shell file changes in this spec's diff; `games` still has exactly one `dragrush` row.
- [ ] The nitro tank starts each race at 0 charges and never exceeds 3.
- [ ] A perfect shift adds exactly 1 charge; a good, early or late shift adds 0; a perfect launch adds 0.
- [ ] Pressing `N` or `↓` with at least 1 charge during `racing` removes exactly 1 charge and multiplies acceleration by 1.6 for 1.2 s.
- [ ] Pressing `N` or `↓` with 0 charges, before the launch, before green or while a burn is active does nothing and removes no charge.
- [ ] A run with a perfect launch, five perfect shifts and three burns finishes 400 m between 0.6 s and 1.6 s faster than the same run without burns.
- [ ] Races 1, 4, 7 are `dry`, races 2, 5, 8 are `wet` and races 3, 6, 9 are `headwind`.
- [ ] In a `wet` race the green window width is 0.7 × the core width, with a floor of 0.03 (race 2: 0.063; race 8: 0.03).
- [ ] In a `headwind` race the player acceleration is 0.93 × normal and the rival time is 0.35 s higher than the core formula.
- [ ] Rain streaks appear only in `wet` races and speed lines only in `headwind` races.
- [ ] Races 5, 10 and 15 are boss races: the rival is drawn in magenta with a flame trail and its time is 0.4 s lower than the formula for that race.
- [ ] Winning a dry non-boss race scores `1000 + round(margin × 500)`; a wet race scores 1.25 × that; a headwind race 1.15 × that; a boss race adds 2000 before the multiplier. Every result is rounded to an integer.
- [ ] The HUD still shows only score, gear and race; the snapshot has the same keys as in the core.
- [ ] PAUSA freezes an active nitro burn and the remaining burn time resumes unchanged.
- [ ] JUGAR DE NUEVO resets the nitro tank and the condition to race 1 dry; no duplicate loops run.
- [ ] The five other games and the core DRAGRUSH rules (staging, launch, false start, limiter, game over) behave exactly as before.
- [ ] No console errors on `/juegos/dragrush/jugar` during a full session through races 1 to 6.

## Decisions

- **Yes:** nitro earned by perfect shifts and spent by choice. **No:** a nitro that refills by time: no decision, no skill link.
- **Yes:** nitro stays out of the HUD and is drawn as world pips. **No:** a new HUD field: the brief fixes the HUD to gear and race, and the shell must not change.
- **Yes:** a 3-race condition cycle (dry, wet, headwind) with a score multiplier that pays for the risk. **No:** random conditions: unpredictable difficulty makes leaderboard comparisons noisier.
- **Yes:** headwind raises the rival time by 0.35 s so it stays fair. **No:** a pure handicap.
- **Yes:** boss every 5th race with a bigger prize (+2000). **No:** a separate boss game mode: out of scope.
- **Yes:** conditions and boss races stack (race 5 is wet and boss). **No:** forcing boss races to dry: the stack makes race 5 and race 10 differ.
- **Yes:** primitives only for rain, speed lines and the flame trail. **No:** new sprites or assets.
- **Yes:** this spec changes only engine files and `CLAUDE.md`. **No:** a second catalog row, a new cover, or registry edits.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file (done in the core). **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                              | Mitigation                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Nitro makes every race trivially easy                             | Charges only come from perfect shifts, the tank resets per race, and boss races and the rival curve keep pace.          |
| The wet window (0.03) is nearly unhittable                        | The window is in rpm space: in gear 1 rpm moves 0.55 per second, so 0.03 lasts about 55 ms. Retune `WINDOW_MIN_WET` after playtests. |
| Score multipliers push high scores up faster than planned         | The score is clamped to 10,000,000 and a 99-race run is not realistic; no schema impact.                                |
| Scores saved with the core formula become incomparable            | Promote this spec in the same release as the core, or before real scores exist. Flag it at promotion.                   |
| Input stuck after pause or blur                                   | Clear input (including nitro) on `setPaused`, on `window` blur and on `stop`.                                           |
| Frame-rate dependence                                             | The nitro timer runs inside the fixed 1/120 s sub-steps of the core.                                                    |
| Next.js 16 differs from training data                             | No Next code is touched; read the guide only if the shell has to change, which this spec forbids.                       |

## What is **not** in this spec

- A shop or upgrades between races.
- More conditions or more boss types.
- New HUD fields.
- Sound, touch controls, gamepad, skins.
- Multiplayer and ghost replays.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
