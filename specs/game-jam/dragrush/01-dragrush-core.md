# SPEC JAM-dragrush-01 — Moto Drag Rush game (DRAGRUSH) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-23
> **Objective:** Add DRAGRUSH as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/dragrush/jugar`.

## Why this spec exists

There is no reference game folder and `references/started-games/` and `references/source-assets/` are empty. The game is a timed gear-shift drag race written from scratch: the player launches on the green light, shifts up through six gears inside a moving "perfect" rev window, and must cross 400 m before a rival whose time drops every race. The brief in `references/game-suggestions-todo.md` (`dragrush`, ARCADE, green, effort S) names one risk: repetitive gameplay. This spec counters it inside the core with three things: the perfect window moves to a new rev position in every gear of every race, the window narrows as races go by, and the rival gets faster race after race. The theme layer (nitro, track conditions, boss rivals) is `JAM-dragrush-02`.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-dragrush-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/`, the live `games` table and the other jam specs (`scramble` holds 6 in its draft).

The engine is written directly into the `createEngine` contract (SPEC 05): state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal. No assets are loaded (primitives only), so SPEC 08 is not a dependency.

## Scope

**In:**

- Engine in `lib/games/dragrush/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `Space`, `ArrowUp` and `ArrowDown` except while typing in an `INPUT` or `TEXTAREA`.
- Physics runs in fixed sub-steps of 1/120 s inside each frame (at most 6 sub-steps), so race times do not depend on the display refresh rate.
- The canvas draws only the world: sky strip, two lanes, finish line, both bikes (primitives), the three-light starting tree, and the rev bar with the shift window. Score, gear, race number, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "dragrush"`, logic size 640×360, HUD fields `gear` and `lap`.
- Migration `supabase/migrations/20261119000000_add_dragrush_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. Timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-dragrush` in `app/globals.css`, designed with `/frontend-design`. The covers unused today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows a road or a rev gauge, and `.cover-invaders` and `.cover-duelo` are reserved for pending suggestions (`invaders`, `duelo`).
- Rules (one race = one round):
  - Distance `TRACK_M = 400` m. Player bike in the bottom lane, rival in the top lane.
  - Staging: 1.0 s of idle, then three amber lights at 0.6 s, 1.2 s and 1.8 s after staging ends, then green after a random extra delay in `[0.3, 0.9]` s after the third amber. The race clock starts at green.
  - Launch: pressing `Space` (or `↑` / `W`) after green launches the bike. Reaction time = press time − green time. A reaction below 0.15 s is a perfect launch (+200 points). The bike does not move until the launch key is pressed.
  - False start: pressing the shift key before green locks the throttle until 1.0 s after green. The player can still launch after the lock.
  - Gears 1 to 6. On launch: gear 1, `rpm = 0.30`, speed 0. RPM climbs at `RPM_RATE[gear]` per second; speed grows at `ACCEL[gear]` m/s² (see constants).
  - Shift up with `Space` (or `↑` / `W`). The result depends on `rpm` at the press: perfect (inside the window), good (`0.70 ≤ rpm < 0.97`, outside the window), early (`rpm < 0.70`) or late (`rpm ≥ 0.97`). Effects are in the conventions below.
  - Rev limiter: when `rpm` reaches 1.00 it stays at 1.00 and acceleration is multiplied by 0.30 until the next shift.
  - Gear 6 cannot be shifted; the shift key does nothing in gear 6.
  - The perfect window is a band of `rpm` values drawn in green on the rev bar. Its center is drawn at random in `[0.78, 0.90]` every time the player enters a gear (gears 1 to 5), and its width shrinks with the race number.
  - Rival: finishes the 400 m exactly at `rivalTime`; its distance at time `t` is `400 × (t / rivalTime)^1.5`. `rivalTime(n) = max(8.4, 10.0 − 0.25 × (n − 1)) − random[0, 0.3]`, drawn once at the start of race `n`.
  - Winning: the player crosses 400 m before the rival. Score per win: `1000 + round((rivalTime − playerTime) × 500)`. The next race starts 1.5 s after the finish, race number +1, gear back to 1.
  - Losing: the rival crosses 400 m first. Then `state = "gameover"` and `onGameOver(score)` fires once.
  - Perfect shift: +100 points, added at the shift. Perfect launch: +200 points, added at the launch.
  - Race 99 won ends the game as a win (`state = "gameover"`, no bonus). Score is clamped to 10,000,000.
- `CLAUDE.md` update: the `games` rows (adds `dragrush`).

**Out of scope (for future specs):**

- Nitro, track conditions (wet, headwind), boss rivals and rival colors: `JAM-dragrush-02`.
- Sound and music.
- Touch controls, on-screen pedals, gamepad.
- Skins (`classic`, `neon`, `retro`): owned by `@skin-designer` after the game lands.
- Multiplayer or ghost replays.
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
  'Cambia de marcha justo a tiempo y gana la carrera.',
  'Sal con la luz verde y cambia de marcha dentro de la zona perfecta del tacómetro. Cada victoria hace al rival más rápido. Si pierdes una carrera, se acaba.',
  'ARCADE',
  'cover-dragrush',
  'green',
  7
);
```

`color` is `green` as requested by the brief (a CHECK allows `cyan`, `magenta`, `green`, `yellow`). Today the catalog has `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green and `frogger` green. `sort_order` 7 is the next free value at this moment (1 to 5 are used by the five live games, 6 is reserved by the `scramble` draft). Both the timestamp and `sort_order` are re-checked when the spec is promoted.

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
const TRACK_M = 400;
const PX_PER_M = 6;                 // world scroll scale; player bike is drawn at x = 200
const SUBSTEP = 1 / 120;
const STAGING_S = 1.0, AMBER_GAP_S = 0.6, GREEN_DELAY = [0.3, 0.9] as const;
const PERFECT_LAUNCH_S = 0.15, FALSE_START_LOCK_S = 1.0;
const GEARS = 6;
const RPM_RATE = [0.55, 0.45, 0.38, 0.32, 0.27, 0.23];  // per second, index = gear - 1
const ACCEL = [14, 12, 10.5, 9, 7.5, 6];                  // m/s^2, index = gear - 1
const LAUNCH_RPM = 0.30;
const SHIFT_RPM_AFTER = 0.40, SHIFT_RPM_AFTER_EARLY = 0.25;
const GOOD_MIN = 0.70, LATE_MIN = 0.97, REDLINE = 1.0, LIMITER_MUL = 0.30;
const PERFECT_BOOST = 1.5;           // m/s added on a perfect shift
const BOG_S = 0.5, BOG_MUL = 0.5;    // after an early or late shift
const WINDOW_CENTER = [0.78, 0.90] as const;
const windowWidth = (race: number) => Math.max(0.04, 0.10 - 0.01 * (race - 1));
const rivalBase = (race: number) => Math.max(8.4, 10.0 - 0.25 * (race - 1));
const RIVAL_JITTER = 0.3, RIVAL_EXP = 1.5;
const WIN_BASE = 1000, MARGIN_POINTS_PER_S = 500;
const PERFECT_SHIFT_POINTS = 100, PERFECT_LAUNCH_POINTS = 200;
const RESULT_PAUSE_S = 1.5, LAST_RACE = 99, SCORE_MAX = 10_000_000;
```

Conventions:

- Logic canvas is 640×360, origin top-left, units in pixels for drawing and meters, seconds and m/s inside the physics. Rival lane center y = 120, player lane center y = 210, rev bar at `x 40..600`, `y 300..324`.
- The window width table is `windowWidth(n)`: 0.10 in race 1, 0.09 in race 2, ..., 0.04 from race 7 on. Window bounds are `center ± width / 2`.
- Early shift: gear +1, `rpm = 0.25`, bog 0.5 s. Late shift: gear +1, `rpm = 0.40`, bog 0.5 s. Good shift: gear +1, `rpm = 0.40`. Perfect shift: gear +1, `rpm = 0.40`, speed +1.5 m/s, +100 points.
- Acceleration per sub-step is `ACCEL[gear] × bogMul × limiterMul` where each multiplier is 1 when inactive.
- State `dead` is unused: a lost race goes from `playing` to `gameover` directly. Between races the state stays `playing`.
- The engine keeps a private phase (`staging`, `lights`, `ready`, `racing`, `result`) that is not part of the snapshot.

## Implementation plan

1. Create `lib/games/dragrush/constants.ts` with the block above and the colors used by the drawing. Manual check: `npm run lint` passes.
2. Create `lib/games/dragrush/engine.ts`, first part: closure state (phase, timers, gear, rpm, speed, distance, window center, rival time, race number, score), `startRace`, the fixed sub-step physics, the shift classification and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: key handling (`Space`, `↑`, `W`), false start lock, launch, `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Extend `engine.ts`: draw (lanes, scrolling finish line, two bikes from primitives, starting tree, rev bar with green window, amber good zone and red zone), rAF loop with `dt` cap and sub-steps, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/dragrush/jugar` is still the not-found page because the DB row does not exist yet; ASTEROIDS, TETRIS, ARKANOID, SNAKE and FROGGER still play.
6. Add `.cover-dragrush` to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview with no change to other covers.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `dragrush` row; `/biblioteca` shows the card; `/juegos/dragrush/jugar` plays; gear and race update.
8. Update `CLAUDE.md` (the `games` table).
9. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `dragrush` with title `MOTO DRAG RUSH`, the copy above, category `ARCADE`, cover `cover-dragrush`, color `green` and `sort_order` 7.
- [ ] `/juegos/dragrush/jugar` shows a 640×360 canvas; the game starts in staging with HUD score 0, gear 1 and race 01.
- [ ] Staging lasts 1.0 s, the three amber lights light at 0.6 s intervals, and green appears between 0.3 s and 0.9 s after the third amber.
- [ ] Pressing `Space`, `↑` or `W` after green launches the bike; the bike does not move before the press.
- [ ] A launch with reaction below 0.15 s adds exactly 200 to the score; a slower launch adds 0.
- [ ] Pressing the shift key before green blocks launching until 1.0 s after green, and adds no points.
- [ ] A shift with `rpm` inside the green window adds exactly 100 points, speed +1.5 m/s, gear +1 and `rpm` 0.40.
- [ ] A shift with `rpm` below 0.70 sets `rpm` to 0.25 and halves acceleration for 0.5 s; a shift at `rpm` 0.97 or more sets `rpm` 0.40 and halves acceleration for 0.5 s; neither adds points.
- [ ] At `rpm` 1.00 the rev limiter holds `rpm` at 1.00 and acceleration is 30% of normal until the next shift.
- [ ] The shift key does nothing in gear 6 and the HUD gear never shows 7.
- [ ] The green window center changes at random in `[0.78, 0.90]` every time a gear is entered; its width is 0.10 in race 1, 0.07 in race 4 and 0.04 in race 7 and later.
- [ ] A run with five perfect shifts and a perfect launch finishes 400 m in a time between 7.0 s and 9.5 s.
- [ ] Rival time in race 1 is between 9.7 s and 10.0 s, in race 5 between 8.7 s and 9.0 s, and from race 8 on between 8.1 s and 8.4 s.
- [ ] Winning a race adds exactly `1000 + round((rivalTime − playerTime) × 500)`, shows the race number +1 in the HUD after 1.5 s, and resets the HUD gear to 1.
- [ ] Losing a race opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'dragrush'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=dragrush`, on `/juegos/dragrush` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/dragrush` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list the new game with its cover.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and the race clock; pressing again resumes with no jump in speed or distance.
- [ ] While the game is mounted, `Space` and the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] Race time for the same input sequence is the same at 60 Hz and 144 Hz within 0.05 s.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, race number, score and phase; no duplicate loops run (a full-perfect race still takes 7.0 s to 9.5 s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/dragrush/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch: there is no reference folder. **No:** porting: nothing to port.
- **Yes:** `id` `dragrush`, taken from the planner's entry in `references/game-suggestions-todo.md`, English slug. Title `MOTO DRAG RUSH`.
- **Yes:** one race = one round and a lost race ends the game. HUD has only `gear` and `lap`, so there is no lives field. **No:** lives: they are not in the brief's HUD.
- **Yes:** `lap` label is `Carrera` (race number), because a drag race has no laps; the HUD key stays `lap` as the brief says.
- **Yes:** moving perfect window per gear plus narrowing width plus faster rival to counter repetition. **No:** a fixed shift point: it would be memorized in two races.
- **Yes:** fixed 1/120 s sub-steps. **No:** per-frame physics: race times would change with the refresh rate and unfairly rank scores.
- **Yes:** rival follows a fixed curve to a drawn finish time. **No:** a simulated AI bike: more code, same experience.
- **Yes:** one shift key (`Space`, `↑`, `W`). **No:** separate launch and shift keys: simpler to learn, fits one thumb.
- **Yes:** race 99 won ends the game as a win and saves the score. The shell only knows `gameover`. **No:** a win screen.
- **Yes:** primitives only, no assets. **No:** sprites: none exist in `references/`, art can come with `@skin-designer`.
- **Yes:** new cover `.cover-dragrush` designed with `/frontend-design`, `sort_order` 7, color `green` (brief). **No:** reusing a reserved cover.
- **Yes:** keyboard only; touch, sound and gamepad are out of scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                                      | Mitigation                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops                     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks race time after restarts. |
| Canvas access during SSR or under `cacheComponents`                                       | Engine is created only inside `useEffect` of a client component.                                              |
| Gameplay feels repetitive                                                                 | Moving window, narrowing width, faster rival; `JAM-dragrush-02` adds nitro, conditions and boss races.        |
| Rival floor (8.4 s) is close to a perfect run (about 8.5 s), so late races are very hard   | Intended skill ceiling; 02 adds nitro to extend it. Retune constants in `constants.ts` only.                 |
| Random green delay makes reaction scoring feel unfair                                     | Range is only 0.6 s wide and the lights are visible; perfect launch is a bonus, not a requirement.            |
| Race times depend on the refresh rate                                                     | Fixed 1/120 s sub-steps; criterion compares 60 Hz and 144 Hz.                                                 |
| `Space` scrolls the page                                                                  | `preventDefault` while mounted, except in `INPUT` / `TEXTAREA`.                                               |
| Input stuck after pause or blur                                                           | Clear input on `setPaused`, on `window` blur and on `stop`.                                                   |
| Game over fired twice (engine and FIN)                                                    | The shell ignores `onGameOver` when the modal is open.                                                        |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded                 | Flag it if a claim is false for this game (no touch controls); fixing it needs its own change.               |
| Next.js 16 differs from training data                                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.        |

## What is **not** in this spec

- Nitro, track conditions, boss rivals (`JAM-dragrush-02`).
- Sound and music.
- Touch controls and gamepad.
- Skins.
- Multiplayer and ghost replays.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
