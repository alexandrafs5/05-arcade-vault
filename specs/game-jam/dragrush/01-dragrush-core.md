# SPEC JAM-dragrush-01 — Moto Drag Rush game (DRAGRUSH) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-20
> **Objective:** Add MOTO DRAG RUSH (`dragrush`) as a real timed gear-shift drag racing game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/dragrush/jugar`.

## Why this spec exists

The game comes from scratch: there is no reference folder in `references/started-games/`. `@game-planner` suggested it (`dragrush`, ARCADE, green, effort S, keyboard, needs a new `.cover-*` rule, lower priority). Its recorded risk is repetitive gameplay: one button, one straight road. This spec answers that risk inside the core with four layers of skill and progression:

- a reaction launch off a randomized light tree (a false start loses the race);
- a gear-shift timing game on an RPM gauge with a perfect window, an early penalty and a rev limiter;
- a ghost rival whose elapsed time improves every race, so the run ends when the player can no longer keep up;
- a score that pays for margin of victory, perfect shifts and reaction time, so two winners of the same race score differently.

Feature spec 02 adds nitro, rival styles and wet track conditions.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine follows the `createEngine` contract: state in the closure, the canvas draws the world, the shell shows the HUD and the game-over modal. There are no image assets, so SPEC 08 is not a dependency.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-dragrush-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/dragrush/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws the world: road, scrolling markings, the start light tree, both bikes, the finish line, a progress strip, the RPM gauge (an in-world dashboard; RPM is not a HUD field), the speed in km/h, and a short result banner (`VICTORIA`, `DERROTA`, `SALIDA NULA`) with the elapsed time. Score, gear, race number, pause menu and game-over overlay are not drawn as HUD; the shell shows gear and race number.
- Entry in `lib/games/registry.ts` with `id: "dragrush"`, logic size 640×360, HUD fields `gear` and `lap`.
- Migration `supabase/migrations/20261120000300_add_dragrush_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-dragrush` in `app/globals.css`, designed with `/frontend-design`. No unused cover fits a night road (the unused ones are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; the last two are reserved for pending suggestions).
- Controls: `Space`, `↑` or `W` shift up one gear (on key down; held keys and `repeat` events are ignored). There is no other input.
- Rules (distances in meters, time in seconds):
  - Track length `TRACK_M = 402`. Two lanes: rival lane center y = 150, player lane center y = 230. The player bike is drawn at screen x = 200; the world scrolls at `SCROLL = 6` px per meter; the rival is drawn at `200 + (xRival − xPlayer) × 6`, clamped to x −40..680. The finish line is drawn at `200 + (402 − xPlayer) × 6`.
  - A race starts with a 1.0 s stage, then the tree: three amber lights lit at 1.0 s, 1.5 s and 2.0 s after the race starts; green lights at `greenAt = 2.5 + U(0, 0.5)` s. Input is ignored for the first 0.6 s of every race (carry-over taps from the previous race).
  - False start: a shift key pressed after 0.6 s and before `greenAt` ends the race as a loss (`SALIDA NULA`).
  - Launch: the first shift key press at or after `greenAt` launches the bike in gear 1 with RPM 4500; `reaction = pressTime − greenAt`. If no key is pressed by `greenAt + 1.5` s the bike auto-launches with `reaction = 1.5`. Launch factor `LF = 1` if `reaction ≤ 0.15`, otherwise `max(0.7, 1 − 0.5 × (reaction − 0.15))`; `LF` multiplies gear 1 acceleration only.
  - Engine model per gear `g` (1..5): `A_G = [14, 11, 9, 7.5, 6.2]` m/s² and `RPM_RATE = [6200, 4800, 4000, 3300, 2700]` rpm/s. RPM rises at `RPM_RATE[g]`. Torque factor: RPM < 8500 → `0.6 + 0.4 × (RPM − 3000) / 5500` (not below 0.6); RPM 8500..10800 → 1.0; RPM above 10800 → 0.7. Acceleration `a = A_G[g] × torque` (gear 1 also `× LF`).
  - Rev limiter: RPM reaching 11000 starts a 0.3 s cut: RPM held at 11000 and torque 0.2; afterwards RPM resets to 10500.
  - Shift up (gear < 5): `RPM_new = max(4000, RPM − 4200)`; acceleration is 0 for `SHIFT_CUT = 0.08` s; a shift key during a shift cut is ignored; gear 5 ignores shift keys.
  - Shift quality by RPM at the key press: **perfect** 9800..10800; **good** 8500..9799; **early** below 8500; **late** 10801..11000 (no bonus, no penalty beyond the lost torque). `perfectShifts` counts perfect shifts in the race (max 4).
  - Rival: a ghost that launches `rivalReaction = U(0.12, 0.30)` s after green and runs `x = 402 × (t / ET_r)^1.4` for `t` seconds after its launch. `ET_r(n) = max(9.8, 11.8 − 0.2 × (n − 1))` for race `n`.
  - Race result: the first to cross 402 m (compared as `reaction + ET` for the player and `rivalReaction + ET_r` for the rival, both from green) wins. The player's `ET` is measured from launch. Margin `m = rivalTotal − playerTotal` seconds.
  - Win: the score gains `1000 + 200 × (n − 1) + floor(1000 × min(1, m)) + 100 × perfectShifts + reactionBonus`, where `reactionBonus` is 300 if `reaction ≤ 0.10`, 150 if `≤ 0.20`, 50 if `≤ 0.35`, else 0. After 2.0 s the next race starts (`n + 1`, new tree, bikes at the line). The run continues.
  - Loss (the rival crosses first, or a false start): `state = "gameover"` after 1.5 s of banner and `onGameOver(score)` fires once. No points are added for the lost race.
  - There is no win state; the leaderboard is the run score.
  - Tuning target: with a perfect shift at each of the 4 shifts and `reaction ≤ 0.15`, `ET` is 10.0 ± 0.3 s. If the constants above give another value, `/spec-impl` adjusts only `A_G` in `constants.ts` and records the final values in the spec.
- HUD: `gear` is the current gear 1..5 (1 before launch); `lap` is the race number `n` (1 at the start, +1 after each won race).
- `CLAUDE.md` update: the `games` rows and the Games table.

**Out of scope (for future specs):**

- Nitro, rival styles and wet track conditions (JAM-dragrush-02).
- Manual clutch, analog throttle, bike upgrades or a garage.
- Sound and music, engine noise.
- Touch controls (the shell pad can be wired later by `@mobile-porter`), gamepad, two-player.
- Sprites or image assets, skins, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'dragrush'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'dragrush',
  'MOTO DRAG RUSH',
  'Cambia de marcha justo a tiempo y gana la carrera.',
  'Carreras de aceleración en moto contra un rival fantasma. Sal en verde, cambia de marcha en la zona perfecta del cuentarrevoluciones y cruza la meta antes que él. Cada carrera el rival es más rápido.',
  'ARCADE',
  'cover-dragrush',
  'green',
  9
);
```

`sort_order` 9 is the next free value at 2026-11-20 (`asteroids` 1 … `frogger` 5; 6 is claimed by the `scramble` jam draft, 7 by `invaders` and 8 by `penalty`). Color `green` is the planner's pick (the catalog colors are `cyan`, `magenta`, `green`, `yellow`; `snake` and `frogger` are also green). Both values are re-checked on promotion.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "gear", label: "Marcha", format: "number", initial: 1 },
  { key: "lap", label: "Carrera", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { gear, lap } }
```

```ts
// lib/games/dragrush/constants.ts
const W = 640, H = 360;
const TRACK_M = 402, SCROLL = 6, PLAYER_X = 200;
const LANES = { rivalY: 150, playerY: 230 };
const A_G = [14, 11, 9, 7.5, 6.2];            // m/s^2 per gear 1..5 (tuning knob)
const RPM_RATE = [6200, 4800, 4000, 3300, 2700];
const RPM = { launch: 4500, floor: 4000, shiftDrop: 4200, goodFrom: 8500, perfectFrom: 9800, perfectTo: 10800, limiter: 11000, afterLimiter: 10500 };
const LIMITER_CUT = 0.3, SHIFT_CUT = 0.08;
const TREE = { ignoreInput: 0.6, amber: [1.0, 1.5, 2.0], greenBase: 2.5, greenJitter: 0.5, autoLaunch: 1.5 };
const RIVAL = { reaction: [0.12, 0.3], exponent: 1.4, etStart: 11.8, etStep: 0.2, etFloor: 9.8 };
const SCORE = { base: 1000, perRace: 200, marginPerSecond: 1000, marginCap: 1, perfectShift: 100, reaction: [[0.1, 300], [0.2, 150], [0.35, 50]] };
const RESULT_MS = { win: 2.0, loss: 1.5 };
```

Conventions:

- Logic canvas is 640×360, units in pixels, origin top-left; the physics runs in meters and seconds and converts with `SCROLL`.
- Motion integrates per frame with the capped `dt` (`v += a × dt`, `x += v × dt`); the engine is frame-rate independent apart from that integration. Speed in km/h is `v × 3.6`.
- Engine phases (internal): `stage`, `tree`, `launched`, `result`. `state` is `playing` until the run ends; `dead` is unused.
- Randomness uses `Math.random()`; there is no seed.

## Implementation plan

1. Create `lib/games/dragrush/constants.ts` with the constants above, the palette (road `#14141f`, markings white, player green, rival magenta, gauge zones green/yellow/red) and the helpers `torque(rpm)`, `rivalEt(n)`, `launchFactor(reaction)`, `shiftQuality(rpm)`. Manual check: `npm run lint` passes.
2. Create `lib/games/dragrush/engine.ts`, first part: closure state, `reset`, race phases with timers (stage, tree, green), snapshot with `onChange` / `onGameOver`, rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
3. Extend `engine.ts`: keyboard handling (`Space`, `↑`, `W`, ignore `repeat`, ignore the first 0.6 s, `preventDefault`, input cleared on pause, blur and stop), false start and launch with reaction and `LF`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: engine model (RPM rise, torque, limiter cut, shift with drop and cut, shift quality counting, gear HUD). Manual check: lint and tsc pass.
5. Extend `engine.ts`: rival ghost, crossing detection, race result, scoring, next race, loss and game over once. Manual check: lint and tsc pass.
6. Extend `engine.ts`: drawing (road and scrolling markings, light tree, bikes, finish line, progress strip, RPM gauge with zones, km/h, result banner). Redraw is skipped while paused or after game over. Manual check: lint and tsc pass.
7. Tune `A_G` in `constants.ts` so that a perfect run gives `ET` 10.0 ± 0.3 s (play several perfect runs; the banner shows `ET`), and record the final values in this spec when promoted. Manual check: three perfect runs finish between 9.7 s and 10.3 s.
8. Add the `registry.ts` entry. Manual check: `/juegos/dragrush/jugar` is still the not-found page because the DB row does not exist yet; the existing games still play.
9. Add `.cover-dragrush` to `app/globals.css`, designed with `/frontend-design` (project rule for any UI): a night road with a start light tree and speed lines in the platform's neon style. Manual check: the class renders in a card preview with no layout change to other covers.
10. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `dragrush` row; `/biblioteca` shows the card with the new cover; `/juegos/dragrush/jugar` plays.
11. Update `CLAUDE.md`.
12. Run `npm run lint` and `npm run build`.

The cover is the only new UI element: `/spec-impl` must use `/frontend-design` for it. The in-canvas gauge and banner are world drawing; if the 640×360 canvas needs shell CSS changes, `/frontend-design` is used for that too.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `dragrush` with title `MOTO DRAG RUSH`, the copy above, category `ARCADE`, cover `cover-dragrush`, color `green` and `sort_order` 9 (or the value re-checked on promotion).
- [ ] `/juegos/dragrush/jugar` shows a 640×360 canvas; the race starts in the stage phase with HUD gear 1, race 01 and score 0.
- [ ] Three amber lights light at 1.0 s, 1.5 s and 2.0 s; green comes between 2.5 s and 3.0 s after the race starts.
- [ ] Pressing `Space`, `↑` or `W` between 0.6 s and green ends the race with `SALIDA NULA`, and the game-over modal opens once after 1.5 s.
- [ ] Keys pressed in the first 0.6 s of a race are ignored (no false start).
- [ ] The first key press at or after green launches the bike in gear 1 at RPM 4500; with no press, the bike auto-launches 1.5 s after green.
- [ ] A reaction of 0.15 s or less gives launch factor 1; a reaction of 1.5 s gives 0.7.
- [ ] RPM rises at 6200 rpm/s in gear 1; a shift key press in gear 1 to 4 moves to the next gear, lowers RPM by 4200 (not below 4000) and the HUD gear updates.
- [ ] A shift key press while the 0.08 s shift cut is active and any shift key press in gear 5 do nothing.
- [ ] Reaching RPM 11000 holds RPM at 11000 for 0.3 s with torque 0.2, then drops RPM to 10500.
- [ ] A shift at RPM 9800..10800 counts as perfect and adds 100 points on a win; the count never exceeds 4 per race.
- [ ] A race with four perfect shifts and reaction at most 0.15 s finishes the 402 m in 9.7..10.3 s (the banner shows `ET`).
- [ ] The rival launches 0.12..0.30 s after green; its time over 402 m is 11.8 s in race 1, 11.6 s in race 2, 10.0 s in race 10 and 9.8 s from race 11.
- [ ] Beating the rival adds `1000 + 200 × (n − 1)` plus `floor(1000 × min(1, margin))` plus 100 per perfect shift plus 300/150/50 for reaction at most 0.10/0.20/0.35 s; the saved score is the sum of the whole run.
- [ ] After a win the banner shows `VICTORIA` and `ET`, and after 2.0 s race 02 starts with HUD lap 02 and gear 1.
- [ ] The rival crossing first shows `DERROTA`, adds no points and opens the game-over modal once after 1.5 s.
- [ ] The progress strip shows both bikes' distance from 0 to 402 m.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'dragrush'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=dragrush`, on `/juegos/dragrush` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/dragrush` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, the lights and the physics; pressing again resumes with no jump.
- [ ] While the game is mounted, `Space` and the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, race number, rival ET and score; no duplicate loops run (RPM rise stays 6200 rpm/s in gear 1 after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/dragrush/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with a one-button shift mechanic and a run of ever-faster rivals, to answer the planner's "repetitive" risk. **No:** a fixed number of identical races.
- **Yes:** `id` `dragrush` (the planner's id), title `MOTO DRAG RUSH`.
- **Yes:** one input (shift up) with an automatic throttle. **No:** a separate throttle key: the skill is timing, not holding.
- **Yes:** a randomized green light and a false-start loss. **No:** a fixed light time: it would be memorized.
- **Yes:** a 0.6 s input ignore at race start. **No:** accepting carry-over taps: a held key would cause unfair false starts.
- **Yes:** a ghost rival defined by a time curve. **No:** a simulated rival with its own shifting: no extra skill for the player and more code.
- **Yes:** the run ends on the first lost race and the score is cumulative. **No:** lives: one loss means someone was faster.
- **Yes:** the score pays race number, margin, perfect shifts and reaction. **No:** score = ET only: no progression across races.
- **Yes:** RPM drawn as an in-world gauge, because it is not a HUD field and the shell HUD formats are limited to `number`, `hearts`, `pad2`. **No:** a new HUD format.
- **Yes:** HUD `gear` (`number`) and `lap` (`pad2`, labeled `Carrera` because each race is one run down the strip). **No:** an RPM field: it would re-render every frame.
- **Yes:** `A_G` is the single tuning knob and the target ET is pinned by a criterion. **No:** tuning the rival to a guessed player time.
- **Yes:** new cover `.cover-dragrush` designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: reserved for pending suggestions.
- **Yes:** category `ARCADE`, color `green`, `sort_order` 9 (re-checked on promotion).
- **Yes:** keyboard only. **No:** mouse, touch, gamepad, sound, multiplayer: out of scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** gear and race number come from the shell HUD. **No:** drawing them in the canvas: duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Repetitive gameplay (the planner's risk)                                  | Rising rival, reaction launch, shift quality scoring; feature spec 02 adds nitro, rival styles and weather. |
| The model's perfect ET is not 10.0 s with the given constants             | Step 7 tunes `A_G` only; the criterion pins 9.7..10.3 s; rival ETs are absolute so they stay meaningful.    |
| Rival ET floor (9.8 s) is faster than a human can match                   | Accepted: the run is meant to end; the floor is a constant in `RIVAL`.                                      |
| Key repeat or a held key causes false starts or multiple shifts           | Ignore `repeat` events, ignore the first 0.6 s of every race, clear input on pause, blur and stop.         |
| `Space` or arrow keys scroll the page                                     | `preventDefault` on those keys while mounted, except in `INPUT` and `TEXTAREA`.                             |
| Frame-rate-dependent integration                                          | `dt` capped at 0.05 s; note it in `constants.ts`; the ET criterion is checked at 60 Hz and at 144 Hz.       |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks RPM rate after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                           |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                     |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.             |
| Migration timestamp, `sort_order` or cover collide with another jam draft | Re-checked on promotion; the cover name `cover-dragrush` is unique among the drafts.                        |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.     |

## What is **not** in this spec

- Nitro, rival styles and wet track conditions.
- Manual clutch, analog throttle, bike upgrades or a garage.
- Sound and music.
- Touch controls, gamepad, two-player.
- Sprites or image assets, skins, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
