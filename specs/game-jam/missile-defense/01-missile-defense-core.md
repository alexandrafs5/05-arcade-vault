# SPEC JAM-missile-defense-01 — Missile Defense core game (MISSILE DEFENSE) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-19
> **Objective:** Add MISSILE DEFENSE as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/missile-defense/jugar`.

## Why this spec exists

There is no reference game folder. MISSILE DEFENSE is an original mouse-aimed shooter in the classic "defend the cities from falling warheads" genre, written from scratch: a single flak turret fires shells to the clicked point, the shell bursts into a short-lived blast, and any warhead that touches the blast is destroyed. Six dome-cities sit on the ground; when the last one falls the game ends. Art is original and drawn with primitives (glass domes, magenta warheads, a central turret): no sprites, no assets, and nothing copied from an existing game.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-missile-defense-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/missile-defense/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`.
- Mouse input: `mousemove` and `mousedown` listeners on the canvas, with pointer coordinates converted by `getBoundingClientRect` and the logic size (`x = (clientX - rect.left) × W / rect.width`, same for `y`). Only the left button (`button === 0`) fires. The engine sets `canvas.style.cursor = "none"` in `start()` and restores the previous value in `stop()`; the crosshair is drawn in the world.
- The canvas draws only the world: sky, stars, ground, cities, turret, shells, blasts, warheads and the crosshair. Score, cities, wave, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "missile-defense"`, logic size 640×480, HUD fields `cities` and `wave`.
- Migration `supabase/migrations/20261119000100_add_missile_defense_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-missile-defense` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders`, `.cover-rana` and `.cover-duelo`; `.cover-invaders` is reserved for the pending `invaders` suggestion and the others do not show a sky battle.
- Rules:
  - Ground line at `y = 440`; the strip `y ∈ [440, 480]` is ground. Turret at `x = 320`: base 44×20 px, barrel pivot at `(320, 424)`.
  - Cities: 6 domes, each 56 px wide and 28 px tall, centers `x = 60, 150, 240, 400, 490, 580`, standing on the ground line. A city is alive or destroyed (no partial damage).
  - Firing: left click fires one shell toward the click point. The target is clamped to `x ∈ [0, 640]` and `y ≤ 400` (clicks lower than that fire at `y = 400`). A shot is ignored while the cooldown `FIRE_COOLDOWN = 0.35` s is running or while `MAX_SHELLS = 3` shells are in flight.
  - Shell: starts at the barrel pivot, flies in a straight line at `SHELL_SPEED = 520` px/s and bursts when it reaches the target point.
  - Blast: a circle centered on the burst point. Radius grows linearly from 0 to `BLAST_R = 44` px in 0.30 s, holds 0.40 s, then shrinks to 0 in 0.30 s (total 1.0 s). A blast destroys any warhead whose center is inside its current radius. Blasts do not damage cities.
  - Warheads: spawn at `y = -10`, `x` uniform in `[20, 620]`. The target is the center of a random alive city at the moment of spawn (aim point `y = 420`). Straight-line flight at `WARHEAD_SPEED = min(120, 40 + 6 × wave)` px/s. When it reaches `y = 420` its city is destroyed if still alive (a city already destroyed stays destroyed and the warhead only makes a small harmless explosion). A warhead hitting the ground does not hurt the turret: the turret cannot be destroyed.
  - Waves: wave `w` spawns `min(30, 6 + 2 × (w - 1))` warheads, one every `max(0.45, 1.2 - 0.06 × (w - 1))` s. The wave ends when all warheads have spawned and none is alive. Then a 2.0 s intermission starts: first `+50` points per alive city are added, then, if `w` is a multiple of 3, the destroyed city with the lowest index is rebuilt (it gives no bonus that wave). When the intermission ends, the wave counter goes to `w + 1` and the next wave starts. The first wave starts with 1.0 s of delay.
  - Scoring: a destroyed warhead gives 25 points; within one blast the n-th warhead it destroys gives `25 × n` (25, 50, 75, ...). Wave bonus as above. No other points.
  - Game over: when the last city is destroyed, `state = "gameover"` and `onGameOver(score)` fires once. There is no win state; the game is endless.
- Drawing (primitives only, no `shadowBlur` in the loop): sky vertical gradient `#0a0a18` to `#1a0030`, 40 static stars, ground `#14142b` with a `#ff2bd6` line, cities as cyan `#00e5ff` glass domes with three small windows `#ffd400`, destroyed cities as dark rubble `#2a1a3a`, warheads as magenta `#ff2bd6` diamonds 8 px wide with a fading trail, shells as `#ffd400` dots with a dotted path, blasts as radial gradients from white to magenta, crosshair in white.
- `CLAUDE.md` update: add the `missile-defense` row to the Games table (spec number assigned at promotion, `sort_order` 8, canvas notes "640×480, primitives only, mouse only", HUD "cities (`hearts`), wave (`pad2`)").

**Out of scope (for future specs):**

- Splitting warheads and bombers (JAM-missile-defense-02).
- Keyboard fire or aiming.
- Sound and music.
- Touch controls, on-screen gamepad, gamepad support.
- Skins, extra turrets, ammo counts, upgrades between waves.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'missile-defense'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'missile-defense',
  'MISSILE DEFENSE',
  'Intercepta los misiles y salva tus ciudades.',
  'Apunta con el ratón y dispara proyectiles que estallan donde haces clic. Los misiles enemigos caen por oleadas sobre tus seis ciudades: destrúyelos antes de que lleguen. Cuando cae la última ciudad, se acabó.',
  'SHOOTER',
  'cover-missile-defense',
  'magenta',
  8
);
```

Today the catalog colors are: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. `magenta` is the planner's pick and matches the warheads on the cover. `sort_order` 8 is the next free value after the sibling jam game `neonrace` (7); the committed migrations use 1 to 5 and the jam spec `scramble` holds 6. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "cities", label: "Ciudades", format: "hearts", initial: 6 },
  { key: "wave", label: "Oleada", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { cities, wave } }
```

```ts
// lib/games/missile-defense/constants.ts
const W = 640, H = 480;
const GROUND_Y = 440, WARHEAD_TARGET_Y = 420;
const TURRET = { x: 320, pivotY: 424 };
const CITY_XS = [60, 150, 240, 400, 490, 580];
const CITY_W = 56, CITY_H = 28;
const FIRE_COOLDOWN = 0.35, MAX_SHELLS = 3, SHELL_SPEED = 520, TARGET_MAX_Y = 400;
const BLAST_R = 44, BLAST_GROW = 0.3, BLAST_HOLD = 0.4, BLAST_SHRINK = 0.3;
const WARHEAD_POINTS = 25, CITY_BONUS = 50, REBUILD_EVERY = 3;
const FIRST_WAVE_DELAY = 1.0, INTERMISSION_S = 2.0;
```

Conventions:

- Logic canvas is 640×480, origin top-left, units in pixels; time in seconds; speeds in px/s.
- Wave size and spawn interval come from formulas, not tables: no `levels.ts` is needed.
- Entities are lists: `shells { x, y, tx, ty }`, `blasts { x, y, age, kills }`, `warheads { sx, sy, tx, x, y }`, plus `cities: boolean[]` (alive flags in the order of `CITY_XS`).
- Physics is `dt`-based; nothing depends on the frame rate.

## Implementation plan

1. Create `lib/games/missile-defense/constants.ts` with the constants above and the colors. Manual check: `npm run lint` passes.
2. Create `lib/games/missile-defense/engine.ts`, first part: closure state, `reset`, wave director (counts, intervals, intermission, bonus, rebuild), warhead movement and city destruction, snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: mouse input (canvas listeners, `getBoundingClientRect` conversion, left button only), shells, cooldown, blasts and kill scoring with the `25 × n` rule. Manual check: lint and tsc pass.
4. Extend `engine.ts`: draw (sky, stars, ground, cities, turret, shells, blasts, warheads, crosshair), cursor hiding in `start` / restore in `stop`, rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/missile-defense/jugar` is still the not-found page because the DB row does not exist yet; the other five games still play.
6. Add the `.cover-missile-defense` rule to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview and no other cover changes.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `missile-defense` row; `/biblioteca` shows the card with the new cover; `/juegos/missile-defense/jugar` plays; cities, wave and score update.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

The cover is new UI: `/spec-impl` must use `/frontend-design` for it. The in-canvas art is primitives and follows the colors above.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `missile-defense` with title `MISSILE DEFENSE`, the copy above, category `SHOOTER`, cover `cover-missile-defense`, color `magenta` and `sort_order` 8 (or the value re-checked at promotion).
- [ ] `/juegos/missile-defense/jugar` shows a 640×480 canvas with 6 cities, the turret at `x = 320`, HUD cities 6 (six hearts), wave 01 and score 0; the first warhead appears 1.0 s after the start.
- [ ] The crosshair follows the mouse and stays accurate when the canvas is scaled by CSS (a click at the canvas center bursts at `(320, 240)` at any size).
- [ ] The system cursor is hidden over the canvas and restored after leaving the page.
- [ ] A left click fires one shell at 520 px/s; right and middle clicks do nothing.
- [ ] A click at `y = 450` fires at `y = 400`.
- [ ] Shots are ignored for 0.35 s after a shot and while 3 shells are in flight.
- [ ] A blast reaches radius 44 px at 0.30 s, holds 0.40 s and is gone at 1.00 s.
- [ ] A warhead whose center is inside a blast disappears and adds 25 points; two warheads in the same blast add 25 and 50; three add 25, 50 and 75.
- [ ] Blasts never destroy cities.
- [ ] Wave 1 spawns 6 warheads at 46 px/s, one every 1.20 s; wave 2 spawns 8 at 52 px/s, one every 1.14 s; wave 14 spawns 30 at 120 px/s, one every 0.45 s.
- [ ] A warhead reaching `y = 420` destroys its target city: the HUD hearts drop by 1 and the dome is drawn as rubble.
- [ ] The turret is never destroyed.
- [ ] When a wave ends, `+50` points per alive city are added once, then 2.0 s later the wave number increases by 1.
- [ ] After waves 3, 6 and 9, one destroyed city (lowest index) is rebuilt, HUD hearts rise by 1 and it gives no bonus that wave.
- [ ] Losing the sixth city opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'missile-defense'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=missile-defense`, on `/juegos/missile-defense` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/missile-defense` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and ignore clicks; pressing again resumes with no jump (shells, blasts and warheads do not advance while paused).
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, cities, shells, blasts, warheads and score; no duplicate loops run (wave 1 spawn interval stays 1.20 s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors, listeners are removed and the cursor is restored.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/missile-defense/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with its own look: one central turret, six glass domes, cooldown-limited shells. **No:** copying the layout, ammo batteries, colors or art of any existing missile game.
- **Yes:** `id` `missile-defense` (the planner's id), title `MISSILE DEFENSE`.
- **Yes:** a cooldown (0.35 s) and a cap of 3 shells instead of an ammo count. **No:** ammo per battery: it adds HUD fields and a resource system beyond the brief.
- **Yes:** the turret is indestructible and the cities are the lives (HUD `cities`, hearts). **No:** a separate lives counter.
- **Yes:** every 3rd wave rebuilds one city. **No:** no recovery at all: sessions would be a pure downhill slide.
- **Yes:** `25 × n` in one blast and `+50` per alive city at wave end, so double kills and protecting cities pay more. **No:** flat points only: it removes the aiming skill.
- **Yes:** wave size and speed from formulas capped at 30 warheads and 120 px/s. **No:** a level table: the data is tiny.
- **Yes:** endless game; the end is losing every city. **No:** a win state.
- **Yes:** mouse only, left button fires. **No:** keyboard or touch: out of scope and the brief asks for mouse-aimed intercepts.
- **Yes:** the engine hides the cursor and draws its own crosshair. **No:** CSS changes in the shell.
- **Yes:** primitives only, no assets (no SPEC 08 dependency). **No:** sprites: not needed.
- **Yes:** new cover `.cover-missile-defense` with `/frontend-design`. **No:** reusing `.cover-invaders`: it belongs to a pending suggestion.
- **Yes:** color `magenta` as the planner's pick. **No:** a different color.
- **Yes:** `sort_order` 8 (next free value in this batch), re-checked on promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks the spawn interval after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size; criterion clicks the canvas center at two sizes.       |
| Hidden cursor stays hidden after leaving the page                         | `stop()` restores `canvas.style.cursor`; criterion checks it.                                                   |
| Mouse input stuck or clicks fired while paused                            | Ignore clicks while paused; clear state on `setPaused`, on `window` blur and on `stop`.                         |
| Waves too hard or too easy                                                | Formulas and caps live in `constants.ts`; tune them in play, keep the criteria values in sync.                  |
| A late click handler fires after `stop()`                                 | Remove canvas listeners in `stop()`.                                                                            |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                          |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for MISSILE DEFENSE (no touch controls); fixing it needs its own change.            |
| Touch devices show the on-screen pad that sends arrow keys, which this game ignores | Touch is out of scope; flag it, a later spec decides.                                                 |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- Splitting warheads and bombers.
- Keyboard fire or aiming.
- Sound and music.
- Touch controls, on-screen gamepad and gamepad support.
- Skins, extra turrets, ammo counts and upgrades.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
