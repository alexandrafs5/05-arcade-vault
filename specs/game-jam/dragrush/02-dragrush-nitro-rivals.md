# SPEC JAM-dragrush-02 — Moto Drag Rush nitro, rival styles and wet track (DRAGRUSH)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-dragrush-01
> **Date:** 2026-11-20
> **Objective:** Add a nitro boost, three rival styles and wet-track races to MOTO DRAG RUSH, so each race asks for a different plan and the run stops feeling repetitive.

## Why this spec exists

JAM-dragrush-01 is a complete game, but every race is the same shape: a ghost that is slightly faster each time. This spec breaks the pattern with three changes that alter decisions, not only numbers: when to spend a limited boost, how to read a rival that leads early or late, and a slippery track that punishes a wild launch. It changes only `lib/games/dragrush/`; the shell, the registry entry, the catalog row and the cover stay as the core spec left them.

It is a jam spec: it is not numbered yet and is promoted after `JAM-dragrush-01` (as `specs/NN-dragrush-nitro-game.md`).

## Scope

**In:**

- Nitro: a per-race boost on a second key, with a canister count drawn in the canvas.
- Three rival styles that cycle by race number, each with its own reaction range, finishing time offset and acceleration curve, drawn in a different color.
- Wet track from race 3: a random condition that weakens traction in gears 1 and 2 and adds a wheelspin penalty, drawn with rain streaks and a label.
- A wet-win bonus.
- Constants in `lib/games/dragrush/constants.ts`; logic in `engine.ts`.
- Criteria and a `CLAUDE.md` Games table note ("nitro, rival styles, wet track").
- The same engine behaviour rules as the core spec; the new keys are `N` and `↓`, with `preventDefault` on `ArrowDown` while mounted.

**Out of scope (for future specs):**

- Bike upgrades, garage, other weather, night/day cycle.
- Sound, touch controls (the shell pad B button can be wired later by `@mobile-porter`), gamepad, skins.
- Any change to the shell, `registry.ts`, the catalog row or the cover.
- Automated tests.

## Data model

No catalog row (the `dragrush` row comes from JAM-dragrush-01), no new tables, no new `localStorage` keys, no new HUD field. The snapshot is unchanged: `{ score, state, hud: { gear, lap } }`.

```ts
// added to lib/games/dragrush/constants.ts
const NITRO = { duration: 1.5, accelMul: 1.35, rpmRateMul: 1.35, minGear: 2, perRace: 1, maxPerRace: 2, chainForExtra: 3 };
const RIVAL_STYLES = [
  { id: "sprinter", label: "VELOZ",       reaction: [0.08, 0.14], etDelta: 0.30,  exponent: 1.25, color: "#ffb000" },
  { id: "balanced", label: "EQUILIBRADO", reaction: [0.12, 0.25], etDelta: 0.0,   exponent: 1.4,  color: "#ff2bd6" },
  { id: "closer",   label: "REMONTADOR",  reaction: [0.22, 0.35], etDelta: -0.25, exponent: 1.6,  color: "#00ffff" },
];
// style for race n: RIVAL_STYLES[(n - 1) % 3]  -> race 1 sprinter, 2 balanced, 3 closer, 4 sprinter ...
// rival ET = max(9.6, rivalEt(n) + etDelta) (+ WET.rivalEtPlus in a wet race), where rivalEt(n) is the core formula
const WET = { firstRace: 3, chance: 0.3, gear1Mul: 0.85, gear2Mul: 0.92, spinRpm: 8000, spinMul: 0.6, spinTime: 0.4, rivalEtPlus: 0.2, winBonus: 300 };
```

Conventions:

- The style replaces the core's single rival reaction range and exponent; the core's `rivalEt(n)` curve and floor stay. With `etDelta` the effective floor is 9.6 s.
- Nitro: the key `N` or `↓` (key down, `repeat` ignored) starts a burst only if the bike is launched, gear ≥ 2, no shift cut is active, no burst is running and a canister is left. During a burst `a` is multiplied by 1.35 and `RPM_RATE` by 1.35. Each race starts with 1 canister; three consecutive perfect shifts in the same race grant 1 extra canister once per race (never more than 2 in a race). Canisters do not carry over to the next race and unused ones give no points.
- Wet: from race 3, each race is wet with probability 0.3. In a wet race the player's `A_G[1]` is multiplied by 0.85 and `A_G[2]` by 0.92 (before the launch factor and torque). If RPM is above 8000 at any moment during gear 1 acceleration, the bike spins once: acceleration × 0.6 for 0.4 s (once per race). The rival's `ET_r` increases by 0.2 s, so the net difficulty is similar but the technique changes (shift earlier in gear 1).
- The label `MOJADO` or `SECO` (races 3 and later) and rain streaks in wet races are drawn in the canvas; the label shows during the stage phase. The rival style label is drawn next to the rival lane in the style color.
- `canistersLeft`, `nitroTimer`, `perfectChain`, `wet` and `spinUsed` are reset at each race start.

## Implementation plan

1. Extend `constants.ts` with `NITRO`, `RIVAL_STYLES`, `WET` and the helpers `styleForRace(n)`, `isWetRace(n, rand)`, `rivalEtFor(n, style, wet)`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
2. In `engine.ts`, replace the rival reaction range, exponent and ET with the style values and draw the rival in the style color with its label. Manual check: race 1 shows `VELOZ`, race 2 `EQUILIBRADO`, race 3 `REMONTADOR`, race 4 `VELOZ`.
3. Add the nitro: key handling (`N`, `↓`, `repeat` ignored, `preventDefault` on `ArrowDown`), the burst timer and multipliers, canister counting with the perfect-chain extra, flame and canister dots drawn in the canvas. Manual check: pressing `N` in gear 2 raises acceleration for 1.5 s.
4. Add the wet track: per-race draw from race 3, the traction multipliers, the wheelspin rule, the `MOJADO` label and rain streaks, the +0.2 s rival ET, and the 300 point wet-win bonus after the normal win score. Manual check: a wet race shows the label and the gear 1 spin.
5. Update the `CLAUDE.md` note for `dragrush`. Run `npm run lint` and `npm run build`.

No new UI beyond in-canvas world drawing (flame, canister dots, rain, labels), so `/frontend-design` is not required; the shell and cover are unchanged.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors; the `games` table and the registry entry are unchanged by this spec.
- [ ] The rival style is `RIVAL_STYLES[(n − 1) % 3]`: race 1 `VELOZ`, race 2 `EQUILIBRADO`, race 3 `REMONTADOR`, race 4 `VELOZ`.
- [ ] Rival reaction ranges are 0.08..0.14 s (`VELOZ`), 0.12..0.25 s (`EQUILIBRADO`) and 0.22..0.35 s (`REMONTADOR`).
- [ ] Rival ET over 402 m: race 1 is 12.1 s (11.8 + 0.30), race 2 is 11.6 s, race 3 dry is 11.15 s (11.4 − 0.25) and wet is 11.35 s, race 12 dry is 9.6 s.
- [ ] The rival is drawn in its style color and its style label is drawn next to its lane.
- [ ] `N` or `↓` in gear 2 or higher, launched, with a canister left, starts a 1.5 s burst with acceleration × 1.35 and RPM rate × 1.35; the same keys do nothing in gear 1, before launch, during a shift cut, during a burst or with no canister.
- [ ] Each race starts with exactly 1 canister; three consecutive perfect shifts in one race grant exactly 1 extra, never more than 2 in a race; a new race starts with 1 again.
- [ ] `ArrowDown` does not scroll the page while the game is mounted; typing in an `INPUT` is not blocked.
- [ ] Races 1 and 2 are always dry; from race 3 about 30 % are wet (over 100 simulated draws, 20..40 are wet).
- [ ] In a wet race gear 1 acceleration uses `14 × 0.85` and gear 2 uses `11 × 0.92` before the launch factor and torque.
- [ ] In a wet race, RPM above 8000 in gear 1 cuts acceleration to 60 % for 0.4 s, once per race.
- [ ] A wet race shows `MOJADO` and rain streaks; a dry race from race 3 shows `SECO`.
- [ ] Winning a wet race adds 300 points after the core win score; winning a dry race adds none.
- [ ] HUD fields, registry entry, catalog row, cover and shell files are unchanged in the diff.
- [ ] PAUSA freezes the burst timer and the wheelspin timer; JUGAR DE NUEVO resets canisters, the style cycle and the weather; no duplicate loops run.
- [ ] No console errors during a full session through race 6.

## Decisions

- **Yes:** one canister per race with a perfect-chain extra. **No:** unlimited or refilling nitro: the choice of when to use it is the point.
- **Yes:** nitro raises the RPM rate as well as the acceleration. **No:** acceleration only: it would be a free win with no shift risk.
- **Yes:** unused canisters give no points. **No:** a bonus for saving nitro: it would discourage using the feature.
- **Yes:** three rival styles with offsets +0.30, 0 and −0.25 s and different curves, starting with the easiest. **No:** a style that is strictly harder: the order would not matter.
- **Yes:** wet track from race 3 with a rival ET compensation of +0.2 s. **No:** wet from race 1: the first races teach the shifting.
- **Yes:** a flat 300 wet-win bonus. **No:** a multiplier: integers stay verifiable.
- **Yes:** `N` and `↓` for nitro. **No:** a mouse button or a third key: keyboard only, one hand.
- **Yes:** no catalog row, no shell change, no HUD change. **No:** a second `games` row.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                       | Mitigation                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Nitro makes the early rivals trivial                       | The core rival curve already ramps; tune `NITRO.accelMul` only; criteria pin the 1.35 value. |
| Wet and rival offsets make some races unfair               | The +0.2 s rival compensation and the 9.6 s floor are constants in `constants.ts`.          |
| `ArrowDown` scrolls the page or `N` types into a field     | `preventDefault` on `ArrowDown` while mounted, except in `INPUT` and `TEXTAREA`.             |
| Burst or spin timers keep running during pause             | Timers advance with the capped `dt`; criterion checks the freeze.                            |
| Core and feature specs promoted out of order               | `Depends on` lists JAM-dragrush-01; promote the core first.                                  |

## What is **not** in this spec

- Bike upgrades, garage, other weather, night/day cycle.
- Sound, touch controls, gamepad, skins.
- Changes to the shell, the registry entry, the catalog row or the cover.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
