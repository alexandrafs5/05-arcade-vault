# SPEC JAM-dragrush-01 — Drag Rush game (DRAG RUSH) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-18
> **Objective:** Add DRAG RUSH as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/dragrush/jugar`.

## Why this spec exists

There is no reference game folder. DRAG RUSH is a side-view motorbike drag race written from scratch: a straight 400 m strip, a manual gearbox with a tachometer, and a CPU rival that gets faster every race. The only skill is timing: launch on the green light and press one key to shift up while the needle is inside the green zone. It is a pure timing game on purpose, so a session is short (one race is about 10 s) and every run is a chase for a better chain of perfect shifts.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, and the shell shows the player name, score, HUD, pause, game-over modal and score saving. A new game only adds files; the shell is not changed. No asset is loaded: everything is drawn with canvas primitives, so SPEC 08 is not a dependency.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-dragrush-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/dragrush/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space` and `ArrowUp` except while typing in an `INPUT` or `TEXTAREA`.
- Physics runs on a fixed step `PHYS_DT = 1 / 120` s (accumulator over the capped `dt`), so a race gives the same time at 60, 120 and 144 Hz.
- The canvas draws the world: night road, the player bike (lane 2), the rival bike (lane 1), distance stripes, the start lights, the finish line, the tachometer with its green zone, and a short result banner between races. Score, gear, lap, pause menu and game-over overlay are not drawn as HUD; the shell shows them. The tachometer and the banner are part of the world because the game cannot be played without them.
- Entry in `lib/games/registry.ts` with `id: "dragrush"`, logic size 640×360, HUD fields `gear` and `lap`.
- Migration `supabase/migrations/20261118060000_add_dragrush_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-dragrush` in `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows a road, and `.cover-invaders` / `.cover-duelo` are reserved for pending suggestions.
- Race rules:
  - A "lap" is one race: one run down a 400 m strip against the rival. `lap` starts at 1.
  - Race flow: `staging` (1.0 s, bikes at the line) → `lights` (three red lights light up at 0.7 s, 1.4 s and 2.1 s; the green light comes `0.3 + random × 0.6` s after the third red) → `racing` → `result` (2.0 s banner) → next race (`lap + 1`) or game over.
  - Launch: after green the player presses `Space` or `↑`. Reaction time = press time − green time. If the player has not pressed by 1.2 s after green, the bike launches by itself with reaction 1.2 s.
  - Perfect launch: reaction ≤ 0.25 s. The bike starts at 4500 rpm and scores +200. Any other launch starts at 3000 rpm.
  - False start: pressing before the green light is ignored as a launch and adds 1.00 s to the player's time once per race.
  - Gearbox: gears 1–5, `Space` or `↑` shifts up one gear. Shifting down does not exist. Shifting in gear 5 is ignored.
  - Perfect shift: an upshift while `rpm` is inside the green zone `[7200, 8400]`. Each shift also cuts power for `SHIFT_LOCK = 0.12` s and multiplies `rpm` by `SHIFT_DROP = 0.62`.
  - Engine model per physics step: `rpm += RPM_RATE[gear] × dt`, clamped to `REDLINE = 9000`; `speed += ACCEL[gear] × power(rpm) × dt` (0 during `SHIFT_LOCK`); `pos += speed × dt`. `power(rpm)` is a piecewise curve: 0.6 below 3000, linear 0.6 → 1.0 from 3000 to 7200, 1.0 from 7200 to 8400, linear 1.0 → 0.5 from 8400 to 9000, and `LIMITER_POWER = 0.1` while `rpm` sits on the redline.
  - Rival: starts moving `RIVAL_REACTION = 0.30` s after green and covers 400 m on the curve `pos = 400 × u^1.4`, with `u = (t − 0.30) / (rivalTime − 0.30)` clamped to 1. `rivalTime = max(RIVAL_MIN_TIME, RIVAL_BASE_TIME − RIVAL_STEP × (lap − 1))` seconds with `RIVAL_BASE_TIME = 11.80`, `RIVAL_STEP = 0.20`, `RIVAL_MIN_TIME = 9.00`. Race 1 is 11.80 s, race 15 and later are 9.00 s.
  - Player time = time from green to crossing 400 m (linear interpolation inside the last physics step) + false-start penalty, rounded to 0.01 s. The player wins the race when `playerTime ≤ rivalTime` at 0.01 s resolution.
  - If the rival crosses the line first and the player has not finished, the race is lost at that moment.
  - Winning a race: `score += 500 + floor(margin × 500) + 100 × perfectShifts + (perfect launch ? 200 : 0)`, with `margin = rivalTime − playerTime` in seconds (0 or more) and `perfectShifts` 0–4 for that race. Then the next race starts and `lap + 1`.
  - Losing a race: no points, `state = "gameover"` and `onGameOver(score)` fires once. A flawless player always loses eventually (the rival floor of 9.00 s is below a perfect run), so the game always ends.
- Controls: `Space` or `↑` = launch and shift up. No mouse. Touch, sound and gamepad are out of scope.
- Drawing (primitives only, green accent): dark road with dashed lane lines scrolling at `speed × PX_PER_M`; player bike as a green body with a cyan headlight, rival bike magenta; tachometer arc at the top left with the green zone `[7200, 8400]` marked and a red band `[8400, 9000]`; start lights as three circles and a green circle; finish line as a checkered strip at 400 m. The rival's screen x is `BIKE_X + (rivalPos − playerPos) × PX_PER_M`, clamped to `[-60, 700]`. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: add the `dragrush` row to the Games table (spec number after promotion, `sort_order` 7, canvas notes, HUD gear (`number`), lap (`pad2`)).

**Out of scope (for future specs):**

- Nitro, combos and rival tiers (spec `JAM-dragrush-02`).
- Bike upgrades, several tracks or distances, weather.
- Shifting down, clutch, manual throttle.
- Sound and music (engine note, shift sounds).
- Touch controls (done later by `@mobile-porter`), gamepad, mouse.
- Skins (done later by `@skin-designer`), bitmap sprites.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'dragrush'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'dragrush',
  'DRAG RUSH',
  'Cambia de marcha justo a tiempo.',
  'Arranca con la luz verde y sube de marcha cuando la aguja pase por la zona verde. Cada carrera son 400 metros contra un rival más rápido que el anterior. Si pierdes una, se acaba.',
  'ARCADE',
  'cover-dragrush',
  'green',
  7
);
```

`color` is one of `cyan`, `magenta`, `green`, `yellow`. Today: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green; `green` comes from the planner's pick. `sort_order` 7 is the next free value for the jam: the table holds 1–5, and `scramble` (jam) reserves 6. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

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
const TRACK_M = 400;
const PX_PER_M = 8;
const BIKE_X = 200;
const PHYS_DT = 1 / 120;
const REDLINE = 9000;
const ZONE_MIN = 7200, ZONE_MAX = 8400;
const SHIFT_DROP = 0.62, SHIFT_LOCK = 0.12, LIMITER_POWER = 0.1;
const RPM_RATE = [0, 5200, 3900, 3000, 2400, 2000]; // rpm per second, index = gear
const ACCEL = [0, 18, 14.5, 12, 9.5, 7.5]; // m/s², index = gear (starting values, see tuning step)
const RIVAL_BASE_TIME = 11.8, RIVAL_STEP = 0.2, RIVAL_MIN_TIME = 9.0, RIVAL_REACTION = 0.3;
```

Conventions:

- Logic canvas is 640×360, origin top-left, units in pixels for drawing and metres / seconds for the race model. The player's bike is fixed at `BIKE_X`; the road stripes move.
- The engine keeps a race phase (`staging`, `lights`, `racing`, `result`) inside the closure; the shell only sees `playing` and `gameover`. The state `dead` is unused.
- `ACCEL` values are starting values. The tuning step below fixes them so a perfect run lands in the target time window; the final values replace the ones above in `constants.ts` and in the spec's PR note.
- The random green-light delay uses `Math.random()`; everything else is deterministic.

## Implementation plan

1. Create `lib/games/dragrush/constants.ts` with the constants above, the `power(rpm)` curve data and the palette. Manual check: `npm run lint` passes.
2. Create `lib/games/dragrush/engine.ts`, first part: closure state (phase, timers, `rpm`, `gear`, `speed`, `pos`, rival, `lap`, `score`), `reset`, the fixed-step physics, the shift rule (perfect / early / late), the race result and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: input (`Space`, `↑`) with launch, false start and auto-launch at 1.2 s, `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Extend `engine.ts`: draw (road, bikes, lights, tachometer, finish line, banner), rAF loop with `dt` cap and accumulator, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Tuning step: adjust `ACCEL` so that shifting inside the green zone every time, with a perfect launch, finishes between 9.05 s and 9.35 s, and never shifting finishes in more than 14.0 s. Use scripted key events (Playwright MCP) or a temporary console log of the race time. Manual check: both windows hold on three consecutive runs; remove the temporary log.
6. Add the `registry.ts` entry. Manual check: `/juegos/dragrush/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS, ARKANOID, SNAKE and FROGGER still play.
7. Add `.cover-dragrush` to `app/globals.css`, designed with `/frontend-design`. Manual check: the class renders in a card preview with no layout change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `dragrush` row; `/biblioteca` shows the card with the `.cover-dragrush` art; `/juegos/dragrush/jugar` plays; gear and lap update.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

The cover is new UI: `/spec-impl` must use `/frontend-design` for it. The shell is unchanged.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `dragrush` with title `DRAG RUSH`, the copy above, category `ARCADE`, cover `cover-dragrush`, color `green` and `sort_order` 7.
- [ ] `/juegos/dragrush/jugar` shows a 640×360 canvas; the game starts in `staging` with HUD score 0, gear `1` and lap `01`.
- [ ] The three red lights light at 0.7 s, 1.4 s and 2.1 s after staging ends, and the green light comes between 0.3 s and 0.9 s after the third red.
- [ ] Pressing `Space` or `↑` before green does not launch the bike and adds 1.00 s to the final race time once.
- [ ] Pressing within 0.25 s after green starts the bike at 4500 rpm and adds 200 points on a win; pressing later starts at 3000 rpm; not pressing launches the bike at 1.2 s after green.
- [ ] Each `Space` / `↑` press while racing raises the HUD gear by 1 up to 5; in gear 5 the press does nothing.
- [ ] A shift with `rpm` between 7200 and 8400 counts as perfect; a shift outside the zone does not; the race result adds `100 × perfectShifts` on a win.
- [ ] After a shift `rpm` is 62 % of its previous value and the bike gets no thrust for 0.12 s.
- [ ] At `rpm = 9000` the thrust factor is 0.1 and the needle stays on the redline.
- [ ] Shifting inside the green zone every time with a perfect launch finishes the 400 m between 9.05 s and 9.35 s; never shifting finishes in more than 14.0 s.
- [ ] The rival's finish time is 11.80 s in race 1, 11.60 s in race 2, 9.00 s in race 15 and 9.00 s in every later race.
- [ ] Winning a race adds `500 + floor(margin × 500) + 100 × perfectShifts + (perfect launch ? 200 : 0)` to the score, the lap number goes up by 1 and the next race starts after the 2.0 s banner.
- [ ] Finishing with `playerTime ≤ rivalTime` (0.01 s resolution) counts as a win; a tie wins.
- [ ] Losing a race, including the rival crossing the line first, opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'dragrush'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=dragrush`, on `/juegos/dragrush` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/dragrush` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and the race clock; pressing again resumes with no jump in speed or position.
- [ ] While the game is mounted, `Space` and `↑` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The race time is identical (within 0.02 s) for the same inputs at 60 Hz and at 144 Hz.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets score, gear 1, lap 01 and the race; no duplicate loops run (the lights keep a 0.7 s spacing after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/dragrush/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch as a one-key timing game. **No:** a throttle, clutch and brake simulation: the leaderboard needs a short, repeatable skill.
- **Yes:** `id` `dragrush`, English slug, title `DRAG RUSH`. The planner's name was `Moto Drag Rush`; the shorter title fits the card.
- **Yes:** one key (`Space` or `↑`) for launch and shift. **No:** separate keys: one key keeps the pad mapping (button A) trivial for `@mobile-porter` later.
- **Yes:** a "lap" is one race against the rival, so the HUD field `lap` (`pad2`) counts races. **No:** a multi-lap track: a drag strip is straight.
- **Yes:** the game ends when the player loses a race. **No:** lives: one mistake costs the run, and `hearts` is not needed.
- **Yes:** the rival is a time curve, not a second physics model. **No:** a simulated opponent: it would add tuning with no gameplay gain.
- **Yes:** rival floor of 9.00 s, below the 9.05 s to 9.35 s perfect-run window, so the game always ends. **No:** an endless game with a floor above a perfect run.
- **Yes:** a tie wins at 0.01 s resolution. **No:** a tie loses: it feels unfair at this resolution.
- **Yes:** fixed physics step 1/120 s. **No:** per-frame integration: race time would change with the refresh rate and unfairly rank scores.
- **Yes:** the tachometer and the result banner are drawn on the canvas. **No:** moving them into the shell: the shell cannot be changed and only the HUD formats `number`, `hearts`, `pad2` exist.
- **Yes:** score is a sum of integers per won race (about 1,000 to 2,200 each). **No:** floating-point times in the score: the leaderboard needs one integer.
- **Yes:** new cover `.cover-dragrush` designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games.
- **Yes:** color `green`, as requested in the brief. Two games already use green; this is flagged for review.
- **Yes:** `sort_order` 7, re-checked on promotion (`scramble` reserves 6).
- **Yes:** primitives only, no assets. **No:** loading sprites: no SPEC 08 dependency.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Repetitive gameplay (the brief's main risk)                               | One race is about 10 s, the rival gets 0.20 s faster per race, and scoring rewards margin and perfect shifts; nitro and rival tiers come in `JAM-dragrush-02`. |
| `ACCEL` starting values give the wrong race time                          | Tuning step 5 fixes them against two measurable windows before the catalog row exists.                                    |
| Race time depends on refresh rate                                         | Fixed 1/120 s physics step; criterion compares 60 Hz and 144 Hz.                                                          |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks light spacing after restarts.         |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                          |
| `keys` stuck after pause or blur                                          | Clear input on `setPaused`, on `window` blur and on `stop`.                                                               |
| `Space` pressed to shift also triggers a shell button                     | `preventDefault` on `Space` while mounted, except in `INPUT` and `TEXTAREA`; check in the manual step 8.                  |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                                    |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for DRAG RUSH (no touch controls yet); fixing it needs its own change.                        |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.                    |

## What is **not** in this spec

- Nitro, combos and rival tiers.
- Bike upgrades, several tracks or distances, weather.
- Shifting down, clutch, manual throttle.
- Sound and music.
- Touch controls, gamepad and mouse.
- Skins and bitmap sprites.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
