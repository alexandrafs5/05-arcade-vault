# SPEC JAM-penalty-02 — Penalty Duel keeper styles, crosswind and clean-sheet bonus (PENALTY)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-penalty-01
> **Date:** 2026-11-20
> **Objective:** Give each tier of PENALTY DUEL a distinct keeper style, add a crosswind that bends the player's shots from tier 3, and pay a clean-sheet bonus, so matches stop feeling identical.

## Why this spec exists

JAM-penalty-01 raises difficulty only through four numeric curves, so tier 4 plays like tier 1 with different probabilities. This spec makes the opponents readable characters and adds one skill element (compensating for wind) that changes where the player aims. It is the answer to the planner's "thin depth" risk beyond the core's run structure. It changes only `lib/games/penalty/`; the shell, the registry entry, the catalog row and the cover stay as the core spec left them.

It is a jam spec: it is not numbered yet and is promoted after `JAM-penalty-01` (as `specs/NN-penalty-keepers-game.md`).

## Scope

**In:**

- Four keeper styles that cycle with the tier, each changing the keeper's reach, read chance and dive-zone geometry, with the style name drawn in the canvas.
- Crosswind from tier 3: a horizontal offset added to the player's shots, with a pennant drawn above the goal.
- Clean-sheet bonus when a match is won without conceding.
- Constants in `lib/games/penalty/constants.ts`; logic in `engine.ts`.
- Criteria and a `CLAUDE.md` Games table note ("keeper styles, crosswind").
- The same engine behaviour rules as the core spec.

**Out of scope (for future specs):**

- Shooter styles for the CPU, weather other than wind.
- Sprites or image assets (keepers stay primitives with a different color and size).
- Real multiplayer, sound, touch, gamepad, skins.
- Any change to the shell, `registry.ts`, the catalog row or the cover.
- Automated tests.

## Data model

No catalog row (the `penalty` row comes from JAM-penalty-01), no new tables, no new `localStorage` keys, no new HUD field. The snapshot is unchanged: `{ score, state, hud: { round, goals } }`.

```ts
// added to lib/games/penalty/constants.ts
const KEEPER_STYLES = [
  { id: "muro",      name: "MURO",      reach: 80, readDelta: -0.10, dyScale: 1.0,  color: "#ffe600" },
  { id: "adivino",   name: "ADIVINO",   reach: 70, readDelta: 0.15,  dyScale: 1.0,  color: "#00ffff" },
  { id: "relampago", name: "RELÁMPAGO", reach: 60, readDelta: 0.25,  dyScale: 1.0,  color: "#ff2bd6" },
  { id: "gato",      name: "GATO",      reach: 70, readDelta: 0.0,   dyScale: 0.75, color: "#00ff88" },
];
// style for a tier: KEEPER_STYLES[(tier - 1) % 4]
// effective read = clamp(read(tier) + readDelta, 0.05, 0.75)   (read(tier) is defined in the core spec)
// save test: sqrt(dx^2 + (dy * dyScale)^2) <= reach, with dx, dy from P to the dive zone center
const WIND = { firstTier: 3, base: 20, perTier: 5, max: 50 }; // px
// windPx = sign * min(50, 20 + 5 * (tier - 3)), sign in {-1, 0, +1} with probability 1/3 each, redrawn every round
const CLEAN_SHEET_BONUS_PER_TIER = 300;
```

Effective read per tier (core `read` plus style delta): tier 1 = 0.05, tier 2 = 0.37, tier 3 = 0.54, tier 4 = 0.36, tier 5 = 0.33.

Conventions:

- The style table replaces the single `KEEPER_REACH = 70` of the core spec for the CPU keeper (the SHOOT phase). Your own keeper in the SAVE phase keeps reach 70 and `dyScale` 1.0 (the player is the same keeper in every match).
- Wind applies only to the player's SHOOT phase: `P = T + e + (windPx, 0)`, computed before the outcome test. CPU shots in the SAVE phase are not affected. The pennant is drawn from the start of the AIM phase so the player can compensate; a pennant pointing right means the ball drifts right by `windPx`.
- The wind draw happens at the start of each round from tier 3 and is 0 below tier 3.
- A style is shown for the whole match. The canvas draws `name` under the scoreboard in the style's color.

## Implementation plan

1. Extend `constants.ts` with `KEEPER_STYLES`, `WIND`, `CLEAN_SHEET_BONUS_PER_TIER` and the helpers `styleForTier(tier)`, `windForTier(tier, rand)`, `effectiveRead(tier)`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
2. In `engine.ts`, replace the keeper reach and read in the SHOOT phase with the style values; draw the keeper in the style color and the style name in the scoreboard area. Manual check: tier 1 shows MURO; the keeper is yellow.
3. Add the wind: draw the pennant above the goal (direction and length proportional to `windPx`), redraw the wind each round from tier 3, add `windPx` to `P.x`. Manual check: at tier 3 a pennant appears and a centered aim drifts by the wind.
4. Track `concededThisMatch` (reset at match start, set when the CPU scores) and pay `300 × tier` on a won match with no goals conceded, after the `500 × tier` bonus. Manual check: a 5–0 win adds both bonuses.
5. Update the `CLAUDE.md` note for `penalty`. Run `npm run lint` and `npm run build`.

No new UI beyond in-canvas world drawing (pennant, colored keeper, style name), so `/frontend-design` is not required; the shell and cover are unchanged.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors; the `games` table and the registry entry are unchanged by this spec.
- [ ] Tier 1 uses MURO (reach 80), tier 2 ADIVINO (reach 70), tier 3 RELÁMPAGO (reach 60), tier 4 GATO (reach 70, `dyScale` 0.75), tier 5 MURO again.
- [ ] Effective read values are 0.05 at tier 1, 0.37 at tier 2, 0.54 at tier 3, 0.36 at tier 4 and 0.33 at tier 5.
- [ ] The style name is drawn in the canvas in the style color and changes at each new match.
- [ ] With the MURO keeper, a shot whose point is 78 px from the dive zone center is saved; with RELÁMPAGO a shot 62 px away is not saved.
- [ ] With the GATO keeper, a shot with `dx = 0`, `dy = 80` from the dive zone center is saved (80 × 0.75 = 60 ≤ 70).
- [ ] No wind exists in tiers 1 and 2: `P.x` equals `T.x + e.x` exactly.
- [ ] At tier 3 the wind is −20, 0 or +20 px, at tier 4 −25, 0 or +25, and from tier 9 it is capped at ±50.
- [ ] The pennant is visible from the AIM phase and points the way the ball drifts; wind 0 draws a limp pennant.
- [ ] A shot aimed at the goal center (x = 320) with wind +20 and `p = 0.80` lands at x = 340 ± 6 px.
- [ ] Wind does not change the CPU's shots in the SAVE phase.
- [ ] Winning a match 5–0 adds `500 × tier + 300 × tier`; winning 3–1 adds only `500 × tier`; a sudden-death win after conceding adds only `500 × tier`.
- [ ] Your own keeper in the SAVE phase still saves at 70 px, as in the core spec.
- [ ] HUD fields, registry entry, catalog row, cover and shell files are unchanged in the diff.
- [ ] PAUSA freezes the pennant and timers; JUGAR DE NUEVO resets tier, style and wind; no duplicate loops run.
- [ ] No console errors during a full session through tier 5.

## Decisions

- **Yes:** four keeper styles that cycle. **No:** a unique keeper per tier: unbounded content, and no pattern for the player to learn.
- **Yes:** style names in Spanish drawn in the canvas. **No:** a HUD field for the style: the shell shows only the standing fields.
- **Yes:** wind affects only the player's shots. **No:** wind on CPU shots: the player has no aim to compensate.
- **Yes:** wind redrawn each round, visible before aiming. **No:** hidden wind: it would punish without a skill axis.
- **Yes:** wind starts at tier 3. **No:** from tier 1: the first match must teach the two-click shot.
- **Yes:** clean-sheet bonus `300 × tier`, only with zero goals conceded in the match (sudden death included). **No:** a bonus for wins after conceding.
- **Yes:** no catalog row, no shell change, no HUD change. **No:** a second `games` row.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Wind makes shots unreadable on small screens                              | Pennant is drawn large (at least 48 px long at ±50); criterion pins the numeric drift.       |
| RELÁMPAGO (reach 60, read +0.25) is too hard or too easy                  | All values are in `KEEPER_STYLES`; tune there, criteria pin the exact reach and wind values. |
| The clean-sheet bonus pays oddly on tied matches                          | Bonus requires zero goals conceded in the match including sudden death.                      |
| Core and feature specs promoted out of order                              | `Depends on` lists JAM-penalty-01; promote the core first.                                   |
| Cycling styles repeat every 4 tiers                                       | Accepted for this spec; more styles are a later spec.                                        |

## What is **not** in this spec

- Shooter styles for the CPU, weather other than wind.
- Sprites or image assets.
- Real multiplayer, sound, touch controls, gamepad, skins.
- Changes to the shell, the registry entry, the catalog row or the cover.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
