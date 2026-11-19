# SPEC JAM-dragrush-01 — Moto Drag Rush core game (MOTO DRAG RUSH) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-19
> **Objective:** Add MOTO DRAG RUSH as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/dragrush/jugar`.

## Why this spec exists

There is no reference game folder. MOTO DRAG RUSH is an original timing game in the drag-race genre, written from scratch: a side view of a 400 m strip, a bike with a 5-speed gearbox, a tachometer and a rival "ghost" bike with a fixed finish time. The player holds the throttle and shifts up at the right engine speed. Each race is faster than the last; losing a race ends the game. The brief flags repetition as the main risk, so the core keeps each race short (about 12 s) and the feature spec adds race conditions and new mechanics. Art is original and drawn with primitives (no assets).

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-dragrush-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/dragrush/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws the world: track, bikes, start lights, distance markers, finish line and the bike's instruments (tachometer arc and elapsed time, drawn as part of the scene). Score, gear, lap, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "dragrush"`, logic size 640×360, HUD fields `gear` and `lap`.
- Migration `supabase/migrations/20261119000200_add_dragrush_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-dragrush` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders`, `.cover-rana` and `.cover-duelo`; the last three are reserved for pending suggestions and none shows a bike.
- Rules:
  - The strip is `RACE_M = 400` m long, drawn at `PX_PER_M = 4` px per meter. The camera follows the player bike, which is fixed at screen `x = 200`. The player lane baseline is `y = 290` and the rival lane baseline is `y = 232`.
  - A race (called a lap in the HUD) has three phases: staging, racing and finished.
  - Staging: three amber lights turn on at 0.5 s, 1.0 s and 1.5 s after the race starts; after the third, the light turns green after a random delay uniform in `[0.5, 1.5]` s (`GREEN_DELAY_MIN`, `GREEN_DELAY_MAX`). Race time starts at green.
  - False start: if the throttle is held at any moment before green, the race gets a one-time `FALSE_START_PENALTY = 1.0` s added to the final time (state-based, so holding the key from the previous race counts). The bike is still blocked by the staging: the bike cannot move until green.
  - Controls: hold `→` or `D` for throttle; tap `↑` or `W` to shift up one gear. There is no downshift. A shift is ignored before green, in gear 5, during the shift lag and for auto-repeat key events (`e.repeat`).
  - Gearbox: 5 gears. Gear top speeds `VMAX = [16, 27, 38, 49, 60]` m/s and base accelerations `ACCEL_G = [9, 7.5, 6, 5, 4]` m/s². The engine speed is `r = v / VMAX[gear - 1]`.
  - Power curve with the throttle held: for `r < 0.7` the power factor is `0.5 + r × (0.5 / 0.7)` (0.5 at idle, 1.0 at `r = 0.7`); for `0.7 ≤ r < 1.0` it is 1.0; at `r ≥ 1.0` the rev limiter acts: speed is capped at `VMAX[gear - 1]` and acceleration is 0 until the player shifts. Acceleration is `ACCEL_G × power`. With the throttle released, the bike decelerates at `DRAG = 3` m/s².
  - Shifting: a shift moves to the next gear, keeps the speed and applies `SHIFT_LAG = 0.12` s with zero acceleration (drag still applies). A shift made with `r` in `[0.88, 0.98]` is a perfect shift: it gives `+100` points at once and a `PERFECT_BOOST = 1.15` multiplier on the acceleration for `0.8` s. Other shifts give no penalty beyond the lost power.
  - Rival: a ghost bike that follows `rivalDistance(t) = 400 × (t / T)²` meters and finishes exactly at the rival time `T`. `T(lap) = max(12.00, 14.40 - 0.40 × (lap - 1))` seconds: lap 1 is 14.40 s, lap 2 is 14.00 s, ..., lap 7 and later 12.00 s. The ghost is drawn at 60% opacity in its lane.
  - Finishing: when the player reaches 400 m, the final time is `t + penalty` (`t` is the time since green). If the final time is less than `T`, the race is won; otherwise it is lost. If `t` reaches `T` while the player has not finished, the race is lost at once. A lost race sets `state = "gameover"` and fires `onGameOver(score)` once.
  - Win: `+1000 + round((T - finalTime) × 1000)` points (the time bonus is at least 0), added when the player crosses the line. The bike then coasts for 1.5 s while a time board at the finish shows the two times, and then the next race starts: `lap + 1`, speed 0, gear 1, a new staging.
  - Scoring in one line: 100 per perfect shift, 1000 per race won, 1 point per millisecond of margin over the rival.
  - No win state for the whole game: it is endless and ends only by losing a race.
- Drawing (primitives only, no `shadowBlur` in the loop): dusk sky gradient `#0a0a18` to `#0d2a1c`, asphalt `#14202a` with lane lines `#00ff88`, player bike in green `#00ff88`, rival ghost in magenta `#ff2bd6`, distance markers every 50 m, a checkered finish line at 400 m, a start light tree with three amber and one green light, tachometer arc in the lower-left with a red zone for `r ≥ 0.98` and a green zone for `[0.88, 0.98]`, and the elapsed race time as text.
- `CLAUDE.md` update: add the `dragrush` row to the Games table (spec number assigned at promotion, `sort_order` 9, canvas notes "640×360, primitives only, keyboard", HUD "gear (`number`), lap (`pad2`)").

**Out of scope (for future specs):**

- Race conditions, nitrous and rival styles (JAM-dragrush-02).
- Downshifting, clutch, wheelies, bike upgrades or a garage.
- Sound and music.
- Touch controls, on-screen gamepad, gamepad support.
- Skins.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'dragrush'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'dragrush',
  'MOTO DRAG RUSH',
  'Cambia de marcha en el momento justo.',
  'Carrera de aceleración de 400 metros contra un rival fantasma. Mantén el acelerador y sube de marcha cuando el cuentarrevoluciones esté en la zona verde. Cada carrera es más rápida: si pierdes una, se acabó.',
  'ARCADE',
  'cover-dragrush',
  'green',
  9
);
```

Today the catalog colors are: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. `green` is the planner's pick and matches the cover; it will be the third green game, which the user may want to review. `sort_order` 9 is the next free value after the sibling jam games `neonrace` (7) and `missile-defense` (8); the committed migrations use 1 to 5 and the jam spec `scramble` holds 6. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "gear", label: "Marcha", format: "number", initial: 1 },
  { key: "lap", label: "Vuelta", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { gear, lap } }
```

```ts
// lib/games/dragrush/constants.ts
const W = 640, H = 360;
const RACE_M = 400, PX_PER_M = 4;
const PLAYER_SX = 200, PLAYER_Y = 290, RIVAL_Y = 232;
const VMAX = [16, 27, 38, 49, 60];          // m/s per gear
const ACCEL_G = [9, 7.5, 6, 5, 4];          // m/s² per gear at power 1
const DRAG = 3;                             // m/s² with the throttle released
const SHIFT_LAG = 0.12;                     // s
const PERFECT_MIN = 0.88, PERFECT_MAX = 0.98;
const PERFECT_BOOST = 1.15, PERFECT_BOOST_S = 0.8, PERFECT_POINTS = 100;
const LIGHTS_AT = [0.5, 1.0, 1.5];          // s after the race starts
const GREEN_DELAY_MIN = 0.5, GREEN_DELAY_MAX = 1.5;
const FALSE_START_PENALTY = 1.0;
const RIVAL_T_START = 14.4, RIVAL_T_STEP = 0.4, RIVAL_T_MIN = 12.0;
const WIN_POINTS = 1000, FINISH_COAST_S = 1.5;
```

Conventions:

- Logic canvas is 640×360, origin top-left; distances in meters and speeds in m/s inside the engine, converted to pixels with `PX_PER_M`; time in seconds.
- Engine state: `phase: "staging" | "racing" | "finished"`, `t`, `distance`, `v`, `gear`, `shiftLag`, `boostTimer`, `penalty`, `perfects`, `lap`.
- The HUD `gear` changes only on a shift; `lap` changes only at the start of a new race, so `onChange` fires rarely.
- Physics is `dt`-based; nothing depends on the frame rate. The score is an integer at all times.

## Implementation plan

1. Create `lib/games/dragrush/constants.ts` with the constants above and the colors. Manual check: `npm run lint` passes.
2. Create `lib/games/dragrush/engine.ts`, first part: closure state, `reset`, race phases (staging lights, random green, racing, finished, next lap), snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: bike physics (power curve, limiter, drag, gears, shift lag, perfect shift and boost), false start, rival ghost, finish and scoring. Manual check: lint and tsc pass.
4. Extend `engine.ts`: key handling (throttle held, shift on key down, no repeat), `preventDefault` on arrows, input cleared on pause, blur and stop; draw (track, markers, bikes, lights, tachometer, time, finish board); rAF loop with `dt` cap; `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Tuning pass: run a scripted ideal run (throttle held, shifts at `r = 0.93`) and check the finish time is between 11.0 and 11.9 s. If it is not, change only `ACCEL_G`. Manual check: the measured time is written in the commit message.
6. Add the `registry.ts` entry. Manual check: `/juegos/dragrush/jugar` is still the not-found page because the DB row does not exist yet; the other five games still play.
7. Add the `.cover-dragrush` rule to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview and no other cover changes.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `dragrush` row; `/biblioteca` shows the card with the new cover; `/juegos/dragrush/jugar` plays; gear, lap and score update.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

The cover is new UI: `/spec-impl` must use `/frontend-design` for it. The in-canvas art is primitives and follows the colors above.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `dragrush` with title `MOTO DRAG RUSH`, the copy above, category `ARCADE`, cover `cover-dragrush`, color `green` and `sort_order` 9 (or the value re-checked at promotion).
- [ ] `/juegos/dragrush/jugar` shows a 640×360 canvas; the game starts in staging with the player bike at screen `x = 200`, HUD gear 1, lap 01 and score 0.
- [ ] Three amber lights turn on at 0.5, 1.0 and 1.5 s; the green light turns on 0.5 to 1.5 s after the third one.
- [ ] Holding `→` / `D` before green adds exactly 1.00 s to the final time once per race and the bike does not move before green.
- [ ] After green, holding `→` / `D` accelerates; releasing it makes the bike decelerate at 3 m/s².
- [ ] `↑` / `W` shifts up by one gear, takes effect with 0.12 s of zero acceleration, is ignored in gear 5, before green and on key auto-repeat; the HUD gear updates on each shift.
- [ ] At `r = 1.0` the speed stays at the gear top speed (16, 27, 38, 49 or 60 m/s) and does not rise until a shift.
- [ ] A shift at `r = 0.88` or `r = 0.98` adds exactly 100 points and gives 1.15× acceleration for 0.8 s; a shift at `r = 0.87` or `r = 0.99` adds nothing.
- [ ] The rival ghost finishes at exactly 14.40 s in lap 1, 14.00 s in lap 2, 12.00 s in lap 7 and 12.00 s in lap 8.
- [ ] A scripted ideal run (shifts at `r = 0.93`) finishes 400 m between 11.0 and 11.9 s.
- [ ] Crossing 400 m with a final time under `T` wins the race and adds `1000 + round((T - finalTime) × 1000)` points; the next race starts 1.5 s later with lap +1, speed 0 and gear 1.
- [ ] Crossing 400 m with a final time of `T` or more, or `t` reaching `T` before the player finishes, opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'dragrush'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=dragrush`, on `/juegos/dragrush` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/dragrush` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and the race clock; pressing again resumes with no jump.
- [ ] While the game is mounted, the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD (gear 1, lap 01), score and race; no duplicate loops run (the lights still come on at 0.5, 1.0 and 1.5 s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/dragrush/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch as a generic drag race with a ghost rival. **No:** copying the bikes, tracks, names or look of any existing racing game.
- **Yes:** `id` `dragrush` (the planner's id), title `MOTO DRAG RUSH`.
- **Yes:** the HUD shows gear and lap as the brief asks; the tachometer and race time are drawn in the canvas as part of the scene because they are the core of the gameplay. **No:** moving the tachometer to a new HUD format: the shell is not changed.
- **Yes:** a lost race ends the game and keeps the points won so far. **No:** a lives system: the brief fixes the HUD to gear and lap.
- **Yes:** rival times fall 0.40 s per race down to 12.00 s, so the game is endless for skilled players and finite for the rest. **No:** an unreachable rival: a perfect run (about 11.5 s) must beat the floor.
- **Yes:** scoring combines a shift bonus (100), a race win (1000) and the margin in milliseconds, so precision matters. **No:** points for time alone: it would not reward perfect shifts.
- **Yes:** throttle held on key state and shift on key down, no downshift. **No:** a clutch or downshifts: out of scope for a short session.
- **Yes:** state-based false start with a 1.00 s penalty. **No:** disqualification: too harsh for the first race.
- **Yes:** 5 constants per gear listed in `constants.ts` and a tuning step that may change only `ACCEL_G`. **No:** rewriting the rules to hit the target time.
- **Yes:** keys `→` / `D` and `↑` / `W`. **No:** `Space`: it can activate a focused shell button.
- **Yes:** primitives only, no assets (no SPEC 08 dependency). **No:** sprites.
- **Yes:** new cover `.cover-dragrush` with `/frontend-design`. **No:** reusing a reserved cover.
- **Yes:** color `green` as the planner's pick, third green game flagged for review. **No:** silently changing the color.
- **Yes:** `sort_order` 9 (next free value in this batch), re-checked on promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** shell HUD and game-over overlay are not drawn in the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Repetitive gameplay (flagged by the planner)                              | Races are about 12 s; the rival speeds up each lap; JAM-dragrush-02 adds conditions, nitrous and rival styles.     |
| Constants give a perfect time outside 11.0 to 11.9 s                      | Plan step 5 measures a scripted run and tunes only `ACCEL_G`.                                                     |
| Rival floor of 12.00 s too hard or too easy                               | `RIVAL_T_MIN` lives in `constants.ts`; adjust after the tuning step and keep the criteria in sync.                |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks the lights after restarts.    |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                  |
| Key stuck after pause or blur (throttle held)                             | Clear held keys on `setPaused`, on `window` blur and on `stop`.                                                   |
| Holding the throttle across races causes accidental false starts          | The finished phase lasts 1.5 s so the player can release; the false-start rule is documented in the criteria.     |
| The on-screen pad on touch devices sends keys the game does not use well  | Touch is out of scope; flag it, a later spec decides.                                                             |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                            |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for MOTO DRAG RUSH (no touch controls); fixing it needs its own change.               |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.            |

## What is **not** in this spec

- Race conditions, nitrous and rival styles.
- Downshifting, clutch, wheelies, upgrades and a garage.
- Sound and music.
- Touch controls, on-screen gamepad and gamepad support.
- Skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
