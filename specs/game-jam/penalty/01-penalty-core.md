# SPEC JAM-penalty-01 — Penalty Duel game (PENALTY) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-20
> **Objective:** Add PENALTY DUEL (`penalty`) as a real mouse-driven shoot-and-save game against the CPU with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/penalty/jugar`.

## Why this spec exists

The game comes from scratch: there is no reference folder in `references/started-games/`. `@game-planner` suggested it to fill the empty VERSUS category (`penalty`, VERSUS, green, effort S, mouse, needs a new `.cover-*` rule). Its recorded risk is thin depth: a plain "shoot and keep" repeats the same two clicks. This spec answers that risk with a run structure instead of a single match:

- every round has two sides (you shoot with an aim click plus a power click, then you keep by reading the CPU shooter's lean);
- a run is a chain of 5-round matches against keepers and shooters that improve each match (tiers);
- a match won moves to the next tier; a match lost ends the run, so the score is the sum of the whole run;
- points reward risk (top corners, perfect power, goal streaks) and tier, so two players with the same goal count get different scores.

"VERSUS" here means a CPU opponent only; there is no real multiplayer (out of scope).

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine follows the `createEngine` contract: state in the closure, the canvas draws the world, the shell shows the HUD and the game-over modal.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-penalty-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/penalty/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; canvas and window listeners attached in `start`, removed in `stop`; pending input cleared on pause, on `blur` and on `stop`; clicks while paused are ignored; the canvas cursor is set to `crosshair` in `start` and restored in `stop`.
- Mouse input: `mousemove` and `mousedown` (button 0) on the canvas; pointer coordinates are converted with `getBoundingClientRect` and the logic size (the canvas is scaled by CSS). There is no keyboard control besides the shell's `P` and `Esc`.
- The canvas draws the world: pitch, goal with net, keeper, shooter, ball, aim reticle, power meter, the stadium scoreboard (match goals `TÚ 2 – 1 CPU` and `PARTIDO n`, which the shell HUD does not show), the short result word (`GOL`, `PARADA`, `AL PALO`, `FUERA`) and a one-line hint. Score, round number, run goal count, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "penalty"`, logic size 640×480, HUD fields `round` and `goals`.
- Migration `supabase/migrations/20261120000200_add_penalty_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-penalty` in `app/globals.css`, designed with `/frontend-design`. No unused cover fits (the unused ones are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; the last two are reserved for pending suggestions).
- Rules, geometry (logic px, origin top-left):
  - Goal mouth: rectangle x 140..500, y 100..260 (360×160). Zones: 3 columns × 2 rows, each 120×80; zone `(col, row)` center is `(200 + 120 × col, 140 + 80 × row)`. Penalty spot (ball start): (320, 410).
  - Run structure: a **match** is 5 rounds. A **round** is one kick of yours (phase SHOOT) followed by one kick of the CPU (phase SAVE). After round 5, compare match goals: yours greater, you win the match (tier + 1, match goals reset); equal, sudden death (one more round at a time until, after a full round, the goals differ: higher wins; the tier rises only on a win); yours lower, the run ends (`state = "gameover"`, `onGameOver(score)` once). Tier starts at 1. The round counter is run-wide and never resets.
  - SHOOT phase 1, AIM: a reticle follows the mouse, clamped to x 100..540, y 60..300 (the goal plus 40 px). Click locks the target `T`. If no click in 4 s the current reticle position locks automatically.
  - SHOOT phase 2, POWER: a meter value `p` swings 0→1→0 as a triangle wave with period 1.2 s, starting at 0. Click locks `p`. If no click in 3 s the current `p` locks automatically. The sweet spot is `p = 0.80`; `|p − 0.80| ≤ 0.05` is a **perfect** shot.
  - SHOOT result: the shot lands at `P = T + e`, where `e` has a uniform random angle and a uniform magnitude in `[0, 120 × |p − 0.80|]` px (max 96 px at `p = 0`). Outcome in order: `P` inside the goal rectangle → on target; `P` within 24 px outside the rectangle (x 116..524, y 76..284) → `AL PALO` (no goal, no save); farther → `FUERA`. On target: the CPU keeper dives to zone `Z`: with probability `read(tier)` it picks the zone containing `P`, otherwise a uniform random zone of the 6. If the distance from `P` to the center of `Z` is at most `KEEPER_REACH = 70` px it is `PARADA`; otherwise `GOL`.
  - SAVE phase: the CPU shooter runs up for 1.2 s and kicks at t = 1.2 s; the ball flight lasts 0.55 s. From t = 0.5 s the shooter leans toward a column: the true column with probability `tell(tier)`, otherwise a uniformly random one of the other two columns. Your keeper dives at the zone under the mouse at the click; clicks are accepted from the start of the run-up until t = 1.35 s, only the first click counts, and the zone is the one nearest to the cursor. No click means the keeper stays at zone `(1, 1)`. The CPU target zone: side column (0 or 2, 50/50) with probability `sideProb(tier)`, else the middle column; row 0 or 1 with 50/50. `P` is the zone center plus a uniform offset of ±40 px in x and ±25 px in y. The CPU misses wide with probability `missProb(tier)` (`P` is placed 30 px outside the nearest goal edge: `FUERA`). It is `PARADA` if the distance from `P` to the center of your dive zone is at most 70 px; otherwise `GOL` for the CPU. A perfect guess of the zone always saves (the maximum offset is 47 px); a vertical neighbor can still save (distance can be 55 px); a horizontal neighbor cannot (minimum 80 px).
  - Tier curves: `read(tier) = min(0.6, 0.15 + 0.07 × (tier − 1))`, `tell(tier) = max(0.3, 0.8 − 0.07 × (tier − 1))`, `sideProb(tier) = min(0.8, 0.5 + 0.05 × (tier − 1))`, `missProb(tier) = max(0.05, 0.2 − 0.02 × (tier − 1))`.
  - Timing: each result stays visible 1.0 s, then the next phase starts. Round start has a 0.4 s pause.
  - Scoring (integers):
    - Your goal: `(100 + 50 if perfect + 20 × (tier − 1) + min(100, 25 × (streak − 1))) × (2 if P is in a top corner zone, (col 0 or 2, row 0), else 1)`; `streak` counts your consecutive goals including this one and resets on any non-goal.
    - Your save: `60 + 20 × (tier − 1)`.
    - Match won: `500 × tier` (tier before the increment).
    - Missed, saved, post and conceded kicks add 0.
  - HUD: `round` is the run-wide round number (1 at the start, +1 at the beginning of each new round); `goals` is the total goals you scored in the run.
- `CLAUDE.md` update: the `games` rows and the Games table.

**Out of scope (for future specs):**

- Keeper personalities and crosswind (JAM-penalty-02).
- Real multiplayer, two mice or keyboard duel.
- Sound and music, crowd noise.
- Keyboard-only aiming, touch controls, gamepad.
- Sprites or image assets (the core is drawn with primitives).
- Skins, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'penalty'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'penalty',
  'PENALTY DUEL',
  'Marca y para penaltis contra la CPU.',
  'Duelo de penaltis contra la CPU. Apunta con el ratón, fija la potencia y marca; después ponte los guantes y adivina hacia dónde dispara. Gana cada partido de 5 rondas para enfrentarte a un portero mejor.',
  'VERSUS',
  'cover-penalty',
  'green',
  8
);
```

`sort_order` 8 is the next free value at 2026-11-20 (`asteroids` 1 … `frogger` 5; 6 is claimed by the `scramble` jam draft and 7 by the `invaders` jam draft). Color `green` is the planner's pick (today `snake` and `frogger` are also green; the catalog colors are only `cyan`, `magenta`, `green`, `yellow`). Both values are re-checked on promotion.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "round", label: "Ronda", format: "pad2", initial: 1 },
  { key: "goals", label: "Goles", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { round, goals } }
```

```ts
// lib/games/penalty/constants.ts
const W = 640, H = 480;
const GOAL = { x: 140, y: 100, w: 360, h: 160 };
const ZONE = { cols: 3, rows: 2, w: 120, h: 80 };
const SPOT = { x: 320, y: 410 };
const AIM_CLAMP = { x0: 100, y0: 60, x1: 540, y1: 300 };
const SWEET = 0.8, PERFECT_BAND = 0.05, POWER_PERIOD = 1.2;
const ERROR_PER_POWER = 120; // px of max error per unit of |p - SWEET|
const KEEPER_REACH = 70;
const ROUNDS_PER_MATCH = 5;
const TIMES = { aimMax: 4, powerMax: 3, runup: 1.2, clickUntil: 1.35, lean: 0.5, flight: 0.55, result: 1.0, roundGap: 0.4 };
```

Conventions:

- Logic canvas is 640×480, units in pixels, origin top-left, time in seconds. Ball flight is a straight line from the spot to `P` with the ball radius shrinking from 12 to 7 px (ease-out) over `flight`.
- The engine phases are `aim`, `power`, `flightShoot`, `resultShoot`, `runup`, `flightSave`, `resultSave`, `matchEnd`; they are internal and never leave the engine.
- `state` is `playing` until the run ends; `dead` is unused.
- Randomness uses `Math.random()`; there is no seed.

## Implementation plan

1. Create `lib/games/penalty/constants.ts` with the constants above, the tier functions (`read`, `tell`, `sideProb`, `missProb`), the palette (pitch greens, goal white, keeper yellow, shooter magenta, ball white) and `zoneCenter(col, row)` / `zoneOf(x, y)` helpers. Manual check: `npm run lint` passes.
2. Create `lib/games/penalty/engine.ts`, first part: closure state, `reset`, phase machine with timers, snapshot with `onChange` / `onGameOver`, rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
3. Extend `engine.ts`: mouse input (listeners on the canvas, `getBoundingClientRect` conversion, left button only, clicks ignored while paused, cursor style set and restored). Manual check: lint and tsc pass.
4. Extend `engine.ts`: SHOOT side (aim, power meter, error disc, outcome, keeper zone choice, scoring with streak). Manual check: lint and tsc pass.
5. Extend `engine.ts`: SAVE side (run-up, lean, dive window, CPU target selection, save check, scoring). Manual check: lint and tsc pass.
6. Extend `engine.ts`: match flow (5 rounds, sudden death, tier up, match bonus, game over on a lost match, HUD `round` and `goals`). Manual check: lint and tsc pass.
7. Extend `engine.ts`: drawing (pitch, goal and net, keeper, shooter, ball, reticle, zone highlight during SAVE, power meter, scoreboard, result word, hint line). Redraw is skipped while paused or after game over. Manual check: lint and tsc pass.
8. Add the `registry.ts` entry. Manual check: `/juegos/penalty/jugar` is still the not-found page because the DB row does not exist yet; the existing games still play.
9. Add `.cover-penalty` to `app/globals.css`, designed with `/frontend-design` (project rule for any UI): a green pitch with a goal frame and a ball, neon style like the other covers. Manual check: the class renders in a card preview with no layout change to other covers.
10. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `penalty` row; `/biblioteca` shows the card with the new cover and the VERSUS filter lists it; `/juegos/penalty/jugar` plays.
11. Update `CLAUDE.md`.
12. Run `npm run lint` and `npm run build`.

The cover is the only new UI element: `/spec-impl` must use `/frontend-design` for it. The in-canvas drawing is world art; if the 640×480 canvas needs shell CSS changes, `/frontend-design` is used for that too.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `penalty` with title `PENALTY DUEL`, the copy above, category `VERSUS`, cover `cover-penalty`, color `green` and `sort_order` 8 (or the value re-checked on promotion).
- [ ] `/juegos/penalty/jugar` shows a 640×480 canvas; the game starts in the AIM phase of round 1, HUD round 01, goals 0, score 0, and the cursor over the canvas is a crosshair.
- [ ] The reticle follows the mouse and never leaves x 100..540, y 60..300, also when the canvas is scaled to a different CSS size.
- [ ] The first click locks the target; the power meter then swings with a 1.2 s period; the second click locks the power.
- [ ] With no click, the target locks after 4 s and the power after 3 s.
- [ ] A shot with `|p − 0.80| ≤ 0.05` is labeled perfect and its error radius is at most 6 px; a shot at `p = 0` has an error radius of at most 96 px.
- [ ] A goal at tier 1 with no streak, not perfect, outside the top corners, adds exactly 100 to the score and 1 to the HUD goals.
- [ ] A perfect goal in a top corner zone at tier 1 adds exactly 300; a second goal in a row adds 25 more before the corner doubling.
- [ ] A shot landing within 24 px outside the goal shows `AL PALO` and adds 0; farther shows `FUERA` and adds 0; both reset the streak.
- [ ] In the SAVE phase the shooter kicks at 1.2 s; a click until 1.35 s sends the keeper to the zone under the cursor; a click after 1.35 s is ignored; no click leaves the keeper at zone (1, 1).
- [ ] A save at tier 1 adds exactly 60; at tier 3 it adds exactly 100.
- [ ] After round 5, goals compared: more goals than the CPU adds `500 × tier`, shows tier + 1 and starts a new match of 5 rounds; the HUD round keeps counting up from 6.
- [ ] After round 5 with equal goals, one extra round is played at a time until a full round leaves the goals different.
- [ ] After round 5 with fewer goals, the game-over modal opens with the final score once.
- [ ] The scoreboard in the canvas shows match goals and the match number; the shell HUD shows the run totals (round, goals), not match goals.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'penalty'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=penalty`, on `/juegos/penalty` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/penalty` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/biblioteca` shows PENALTY DUEL under the VERSUS category filter.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and timers; a click while paused does nothing; resuming has no jump.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, tier, match goals, streak and score; no duplicate loops run (the power meter period stays 1.2 s after 3 restarts).
- [ ] Leaving the page stops the loop, removes the canvas and window listeners and restores the canvas cursor: no console errors.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/penalty/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with a run structure (matches, tiers) to answer the planner's "thin depth" risk. **No:** a single endless shoot-and-keep loop.
- **Yes:** `id` `penalty` (the planner's id), title `PENALTY DUEL`.
- **Yes:** both sides in every round (shoot, then save). **No:** shooting only: the VERSUS feel needs the CPU to kick back.
- **Yes:** two-click shot (target, then power) with an error that grows away from a sweet spot. **No:** a single click: no skill axis; a held charge: harder to verify with a mouse.
- **Yes:** the keeper reads the shot with a tier-dependent probability and otherwise guesses. **No:** a keeper that reacts to the exact ball path: it would be unbeatable.
- **Yes:** the shooter's lean is a hint whose reliability falls with the tier. **No:** no hint (pure coin flip) or a perfect hint.
- **Yes:** a lost match ends the run; the score is cumulative. **No:** a fixed number of lives: the match is the natural unit.
- **Yes:** sudden death on a tied match. **No:** counting ties as a win or a loss.
- **Yes:** points reward corners, perfect power, streaks and tier. **No:** 1 point per goal: ranks would tie constantly.
- **Yes:** in-canvas scoreboard with match goals, result word and hint line. **No:** drawing score, round or goals totals in the canvas: those are the shell's.
- **Yes:** HUD `round` (`pad2`) and `goals` (`number`), as the planner listed. **No:** a new HUD format.
- **Yes:** new cover `.cover-penalty` designed with `/frontend-design`. **No:** reusing `.cover-duelo` or `.cover-invaders`: reserved for pending suggestions.
- **Yes:** category `VERSUS`, color `green`, `sort_order` 8 (re-checked on promotion).
- **Yes:** mouse only (`mousedown` and `mousemove`). **No:** touch, keyboard aiming, gamepad, sound, real multiplayer: out of scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Thin depth: two clicks per kick get repetitive                            | Tier curves, streak, corner doubling, lean reading and match bonuses; feature spec 02 adds more variety. |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size; criterion tests a scaled canvas.                |
| Listeners or cursor style left behind after leaving the page              | Attach in `start`, remove in `stop`; restore `canvas.style.cursor` in `stop`.                            |
| Clicks while paused or on the shell buttons act as game input             | Listeners are on the canvas only; clicks are ignored while paused.                                       |
| Run never ends for a strong player                                        | Tier curves are capped (`read` 0.6, `tell` 0.3); a long run is allowed and the score is far below 10,000,000. |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks the meter after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                         |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                   |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.           |
| Migration timestamp, `sort_order` or cover collide with another jam draft | Re-checked on promotion; the cover name `cover-penalty` is unique among the drafts.                      |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.   |

## What is **not** in this spec

- Keeper personalities and crosswind.
- Real multiplayer, two mice or keyboard duel.
- Sound and music.
- Keyboard-only aiming, touch controls, gamepad.
- Sprites or image assets.
- Skins, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
