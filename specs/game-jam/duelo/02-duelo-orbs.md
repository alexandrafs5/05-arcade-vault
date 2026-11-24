# SPEC JAM-duelo-02 — Orbs and CPU styles for NEON DUEL

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-duelo-01
> **Date:** 2026-11-24
> **Objective:** Add three power-up orbs (wide paddle, slow ball, shield) and three CPU styles that rotate by level to NEON DUEL, so rallies have decisions and each level plays differently.

## Why this spec exists

JAM-duelo-01 is playable end to end, but the CPU only gets faster and every rally is a pure reflex test. This spec adds a layer with two parts: orbs that float into the court and reward steering the ball toward them, and three CPU personalities that change how the opponent tracks and returns the ball. It only adds or changes what is listed below. It does not insert a second catalog row, does not change the registry entry, the HUD fields or the shell.

This is a jam spec: it is not numbered yet. When it is promoted, it follows the promoted core spec and the file names below are re-checked.

## Scope

**In:**

- Orbs: at most one orb in the court. `orbTimer` is drawn uniformly from 6 to 10 s and counts only while the ball is in flight (not during a serve countdown and not while paused). When it reaches 0 and no orb exists, an orb spawns at `x` uniform in 220–420 and `y` uniform in 60–420, with radius `ORB_R = 14`, and lives `ORB_LIFE = 6` s (it blinks during the last 1.5 s). The timer is then redrawn.
- Collecting: when the ball center is within `BALL_R + ORB_R` (21 px) of the orb center, the orb is collected by the player, whoever last hit the ball: `+25` points and a random effect (uniform among three):
  - **Wide:** the player paddle height goes from 80 to 120 for `WIDE_TIME = 8` s. Its center is kept and clamped inside the court. The bounce offset uses the current half height (60 instead of 40). A second Wide while active restarts the 8 s.
  - **Slow:** the ball moves at `×0.7` of its speed for `SLOW_TIME = 5` s. The stored ball speed and the per-hit increase are unchanged, so the speed returns to normal when the effect ends. A second Slow restarts the 5 s.
  - **Shield:** a barrier 6 px wide and full court height appears at `x = 6`. The next time the ball would leave through the left edge, it reflects off the barrier instead (no life lost, rally unchanged, no speed increase) and the barrier disappears. Only one shield exists; collecting a second while active gives +25 and no new effect.
- Active effects are drawn in the world (wider paddle, tinted ball, barrier line). Effect timers freeze with pause and clear on restart. A miss by either side keeps running effects, and an unused shield stays until used.
- CPU styles: the style is `STYLES[(level − 1) % 3]` and changes when the level changes. Each style modifies the core CPU formulas:

  | Style (`id`) | Name drawn in the world | `speedMul` | `errMul` | Behavior                                                                                                  |
  | ------------ | ----------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
  | `wall`       | MURO                    | 1.2        | 1.0      | Tracks the ball from the moment it leaves the player's paddle.                                            |
  | `sniper`     | FRANCOTIRADOR           | 0.9        | 0.3      | Aims to hit with the paddle edge: target y is `ball.y + err − 30 × away`, where `away` is +1 if the player paddle center is above y 240 and −1 otherwise, so the return goes to the far side from the player. |
  | `trickster`  | TRAMPOSO                | 1.0        | 1.0      | Does not move until the ball crosses `x = 320`, then tracks at `speedMul` 1.4 until it returns the ball. |

  Effective values: `cpuSpeed × speedMul` and `errMax × errMul` (the core formulas and caps of JAM-duelo-01 apply first, the multipliers after).
- At the first serve after each level change (level 2 and up, not at game start), the style name of the new level is drawn in the world for 1.2 s, in Spanish as in the table.
- No change to scoring, lives, level progression or HUD.

**Out of scope (for future specs):**

- Multiball, extra life orbs, negative orbs.
- Real multiplayer and local two-player.
- Sound and music.
- Touch controls, gamepad.
- Neon recolor skins.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no catalog row, no HUD changes (`lives`, `rally`, `level` stay as in JAM-duelo-01).

```ts
// lib/games/duelo/constants.ts additions
const ORB_R = 14, ORB_LIFE = 6, ORB_BLINK = 1.5, ORB_POINTS = 25;
const ORB_GAP = [6, 10], ORB_X = [220, 420], ORB_Y = [60, 420];
const WIDE_H = 120, WIDE_TIME = 8, SLOW_MUL = 0.7, SLOW_TIME = 5;
const SHIELD_X = 6, SHIELD_W = 6;
const STYLES = [
  { id: "wall", name: "MURO", speedMul: 1.2, errMul: 1.0 },
  { id: "sniper", name: "FRANCOTIRADOR", speedMul: 0.9, errMul: 0.3 },
  { id: "trickster", name: "TRAMPOSO", speedMul: 1.0, errMul: 1.0 },
];
const SNIPER_EDGE = 30, TRICKSTER_START_X = 320, TRICKSTER_BOOST = 1.4;
```

```ts
// engine state additions (closure)
// orb: { x, y, kind: "wide" | "slow" | "shield", life } | null
// orbTimer, wideLeft, slowLeft, shield: boolean, styleBanner: number
```

Conventions:

- `PADDLE_H` of the player is `playerH` in the engine (80 or 120); the CPU paddle stays 80.
- All timers use `dt` already capped at 0.05 s and stop on pause.
- Orb kinds are drawn with canvas primitives, never with assets.
- The snapshot shape does not change.

## Implementation plan

1. Add the new constants and `STYLES` to `lib/games/duelo/constants.ts`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
2. Implement the CPU styles in `engine.ts` (effective speed and error, sniper bias, trickster start line) and the style banner. Manual check: after the first CPU miss (level 2) the banner shows FRANCOTIRADOR; after the next, TRAMPOSO; after the next, MURO.
3. Implement orb spawn, life, blink and collection. Manual check: an orb appears 6 to 10 s after the ball is in play and disappears after 6 s if untouched.
4. Implement Wide and Slow effects. Manual check: the paddle grows to 120 px for 8 s; the ball slows to ×0.7 for 5 s and then recovers.
5. Implement Shield. Manual check: with a shield, a missed ball bounces back once and the heart count stays the same.
6. Run `npm run lint` and `npm run build`. Update `CLAUDE.md` only if its game notes mention CPU behavior.

No new UI is designed here: orbs, effects and style names are canvas primitives inside the world; no cover, no HUD format. If `/spec-impl` finds the orbs need a designed look, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] No orb exists during the first 6 s of ball-in-flight time; the first orb appears between 6 s and 10 s of it.
- [ ] At most one orb exists at any moment; an untouched orb disappears after 6 s and blinks during the last 1.5 s.
- [ ] An orb spawns with its center at x between 220 and 420 and y between 60 and 420.
- [ ] The orb timer does not advance during a serve countdown or while paused.
- [ ] Touching an orb with the ball (center distance ≤ 21 px) adds exactly 25 to the score and removes the orb.
- [ ] Wide makes the player paddle 120 px tall for 8 s and then 80 px again; a second Wide at 5 s restarts the 8 s.
- [ ] With Wide active, a ball hit at the paddle edge (60 px from the center) returns at 60°.
- [ ] Slow makes the ball move at 70% of its speed for 5 s and then at its normal speed with no jump; a paddle hit during Slow still adds 24 to the stored speed.
- [ ] Shield draws a 6 px barrier at x = 6; the next ball that would leave through the left edge bounces back, the heart count and rally stay the same, no speed increase happens, and the barrier disappears.
- [ ] Collecting a second Shield while one is active adds 25 and does not create a second barrier.
- [ ] Level 1 uses MURO (CPU speed 220 × 1.2 = 264 px/s, error ±36); level 2 FRANCOTIRADOR (250 × 0.9 = 225 px/s, error ±32 × 0.3 = ±9.6); level 3 TRAMPOSO (280 × 1.0 = 280 px/s, error ±28); level 4 MURO again.
- [ ] Under TRAMPOSO the CPU paddle does not move while the ball is left of x = 320 and moves at 1.4 × its speed after crossing it.
- [ ] Under FRANCOTIRADOR the CPU return leaves toward the half of the court farthest from the player paddle in at least 9 of 10 returns with the player paddle idle at y 100.
- [ ] The style name is drawn for 1.2 s at the first serve after each level change (level 2 and up) and is not drawn at game start.
- [ ] JUGAR DE NUEVO clears the orb, Wide, Slow, Shield and the style banner, and restores level 1 with MURO.
- [ ] The scoring table, lives, HUD fields, catalog row and registry entry from JAM-duelo-01 are unchanged; no second migration is added.
- [ ] No console errors on `/juegos/duelo/jugar` during a full session.

## Decisions

- **Yes:** orbs always help the player and are collected by the ball regardless of who hit it last. **No:** orbs that help the CPU: it would add luck without adding skill.
- **Yes:** orbs only spawn while the ball is in flight. **No:** spawning during a serve: the player could not react.
- **Yes:** Slow is applied as a movement factor over the stored speed. **No:** rewriting the stored speed: the ramp would be lost when it ends.
- **Yes:** Shield saves one miss and then disappears. **No:** a permanent wall: it would remove the loss condition.
- **Yes:** three CPU styles by level, rotating. **No:** random styles: players could not learn them.
- **Yes:** style names in Spanish and drawn in the world for 1.2 s. **No:** a new HUD field: the HUD contract is unchanged.
- **Yes:** orb pickup adds a small 25 points; it is an incentive, not a score source.
- **Yes:** no second catalog row and no shell change. **No:** duplicating the core scope.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings (`MURO`, `FRANCOTIRADOR`, `TRAMPOSO`) in Spanish.

## Risks

| Risk                                                                  | Mitigation                                                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Wide paddle breaks the hit offset math and gives angles above 60°     | The offset divides by the current half height and is clamped to −1..1.                                                      |
| Slow plus sub-steps leaves the ball inside a paddle on recovery       | Sub-step length is computed from the effective speed each frame; the ball is placed outside the paddle face after each hit. |
| Shield bounce is read as a paddle hit and raises speed or rally       | The shield bounce is a separate branch: no rally, no speed step, no points.                                                 |
| CPU styles make a level unwinnable                                    | Effective speed and error are the core formulas times small multipliers; tune only `STYLES`.                                |
| Sniper bias aims outside the paddle and the CPU misses its own return | The bias (30) is below the paddle half height (40) and the sniper error is at most ±10.8.                                   |
| Orb spawns on top of the ball                                         | Accepted: collection is by distance, and the player still gets 25 points.                                                   |
| Timers keep running after pause                                       | All timers advance with the capped `dt`, and `dt = 0` on the first frame after resume.                                      |

## What is **not** in this spec

- Multiball, extra life orbs, negative orbs.
- Real multiplayer and local two-player.
- Sound and music.
- Touch controls and gamepad.
- Neon recolor skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
