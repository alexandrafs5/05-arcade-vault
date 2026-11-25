# SPEC JAM-missile-defense-01 — Missile Defense game (MISSILE-DEFENSE) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-25
> **Objective:** Add MISSILE DEFENSE as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/missile-defense/jugar`.

## Why this spec exists

The game is a mouse-aimed defense shooter designed from scratch: missiles rain on four cities, the player clicks to launch interceptors that explode where they are aimed, and blasts destroy any missile that touches them. It adds a second SHOOTER with a different input style (mouse only, no ship) and a "protect something" loss condition. It comes from the `missile-defense` entry of `references/game-suggestions-todo.md`. Art is original and drawn with canvas primitives.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-missile-defense-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/missile-defense/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`.
- The canvas draws only the world: sky, ground, four cities, the turret with its ammo pips, enemy missiles with trails, interceptors and blasts. Score, cities left, wave number, pause menu and game-over overlay are not drawn; the shell shows them. The ammo pips are part of the world (next to the turret).
- Mouse input: `mousemove` and `mousedown` listeners on the canvas, with pointer coordinates converted with `getBoundingClientRect` and the logic size 800×600. The canvas gets `style.cursor = "crosshair"` in `start()` and the previous value is restored in `stop()`. Keyboard is not used (arrow-key scrolling is not blocked).
- Entry in `lib/games/registry.ts` with `id: "missile-defense"`, logic size 800×600, HUD fields `cities` and `wave`. No `touch` entry: the pad cannot aim.
- Migration `supabase/migrations/20261125000300_add_missile_defense_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-missile` in `app/globals.css`, designed with `/frontend-design`: magenta palette, dark sky with light-magenta missile trails falling on a skyline and one expanding blast circle. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none fits and the last two are reserved for pending suggestions.
- Rules:
  - Ground line at `y = 560`. Four cities (48×22 px) centered at x = 100, 260, 540 and 700 on the ground line. One turret at x = 400. Each city starts alive.
  - Aiming: a click at point `(x, y)` launches one interceptor from the turret toward the point. The target point is clamped to `y ≤ 520` and `x` between 0 and 800. The interceptor flies at `INTERCEPT_SPEED = 520` px/s in a straight line and explodes when it reaches the point.
  - Fire limits: `SHOT_COOLDOWN = 0.25` s between launches, and one ammo is spent per launch. With 0 ammo clicks do nothing.
  - Ammo per wave: `min(12 + 2 × (n − 1), 30)`, refilled at the start of every wave. Remaining ammo is drawn as pips next to the turret.
  - Blast: a blast has radius that grows linearly from 0 to `BLAST_MAX_R = 44` in 0.35 s, holds 0.15 s, and shrinks linearly to 0 in 0.5 s (total 1.0 s). Any enemy missile whose head is inside a blast circle is destroyed.
  - Chain: a destroyed enemy missile spawns a smaller blast with max radius `0.6 × 44 = 26` (same timeline). That blast can destroy other missiles.
  - Enemy missile: starts at a random x in [20, 780] at y = 0, picks a target x among the cities alive at spawn time, and flies in a straight line to `(target x, 560)` at speed `min(40 + 6 × (n − 1), 120)` px/s. It leaves a thin trail from its start.
  - Impact: when an enemy missile head reaches y = 560, a city at that x (within 24 px) that is still alive is destroyed. If the city was already destroyed, the missile only makes a ground flash. The impact itself does not spawn a blast that kills other missiles.
  - Wave `n` has `min(6 + 2 × (n − 1), 30)` enemy missiles; their spawn times are random and uniform inside the first `SPAWN_WINDOW = 12` s of the wave (sorted at wave start). The wave ends when every missile has spawned and no missile, interceptor or blast remains. Then the wave bonus is added, and after `WAVE_PAUSE = 2.5` s the next wave starts. There is no last wave.
  - Game over: when the fourth city is destroyed, `state = "gameover"` and `onGameOver(score)` fires once. No wave bonus is added for the wave in progress.
- Scoring (integer, always between 0 and 10,000,000): +25 per enemy missile destroyed by a blast (including chain kills); at the end of a wave +100 per surviving city and +5 per unused ammo.
- `CLAUDE.md` update: the `games` table row for `missile-defense`.

**Out of scope (for future specs):**

- Enemy variety, city rebuilding and bonus items (see `02-missile-defense-threats.md`).
- Several turrets, targetable turret, keyboard control.
- Touch controls, gamepad, sound and music.
- Neon recolor and skins, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'missile-defense'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'missile-defense',
  'MISSILE DEFENSE',
  'Intercepta los misiles antes de que caigan.',
  'Cuatro ciudades dependen de ti. Haz clic para lanzar interceptores y destruye los misiles enemigos con las explosiones. Cada oleada trae más misiles y más rápidos. Si caen las cuatro ciudades, se acabó.',
  'SHOOTER',
  'cover-missile',
  'magenta',
  9
);
```

`color` is one of `cyan`, `magenta`, `green`, `yellow` (check constraint). Today `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green; `magenta` is the planner's pick. `sort_order` 9 is the next free value after the `arena` (7) and `minesweeper` (8) jam games; the live maximum is 5 and `scramble` reserves 6. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`) and than the other two jam migrations. Both are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "cities", label: "Ciudades", format: "hearts", initial: 4 },
  { key: "wave", label: "Oleada", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { cities, wave } }
```

```ts
// lib/games/missile-defense/constants.ts
const W = 800, H = 600, GROUND_Y = 560, AIM_MAX_Y = 520;
const CITIES_X = [100, 260, 540, 700], CITY_W = 48, CITY_H = 22, TURRET_X = 400;
const INTERCEPT_SPEED = 520, SHOT_COOLDOWN = 0.25;
const BLAST_MAX_R = 44, BLAST_GROW = 0.35, BLAST_HOLD = 0.15, BLAST_SHRINK = 0.5, CHAIN_SCALE = 0.6;
const ENEMY_SPEED_BASE = 40, ENEMY_SPEED_STEP = 6, ENEMY_SPEED_MAX = 120;
const WAVE_BASE = 6, WAVE_STEP = 2, WAVE_MAX = 30, SPAWN_WINDOW = 12, WAVE_PAUSE = 2.5;
const AMMO_BASE = 12, AMMO_STEP = 2, AMMO_MAX = 30;
const ENEMY_POINTS = 25, CITY_BONUS = 100, AMMO_BONUS = 5;
```

Conventions:

- Logic canvas is 800×600, origin top-left, units in pixels. Speeds are in px/s and multiplied by `dt` (already capped at 0.05 s).
- Entities are plain objects in arrays inside the closure (`enemies`, `shots`, `blasts`). Collision is point-in-circle for the enemy head against each blast.
- The HUD `cities` is the count of cities alive (4 at the start, 0 at game over).
- State `dead` is unused: the game goes from `playing` to `gameover` directly.

## Implementation plan

1. Create `lib/games/missile-defense/constants.ts` with the constants above and the colors. Manual check: `npm run lint` passes.
2. Create `lib/games/missile-defense/engine.ts`, first part: closure state, `reset`, the wave scheduler (spawn times, ammo refill, wave end detection, bonus, pause) and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: enemy missiles, impact and city loss, game over on the fourth city. Manual check: lint and tsc pass.
4. Extend `engine.ts`: mouse handling, interceptors, ammo and cooldown, blasts and chain blasts, scoring. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (sky, ground, cities, turret and ammo pips, trails, blasts), rAF loop with `dt` cap and idle-frame skip while paused or game over, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/missile-defense/jugar` is still the not-found page because the DB row does not exist yet; the existing games still play.
7. Add `.cover-missile` to `app/globals.css` with `/frontend-design`. Manual check: the class renders in a card preview with no layout change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the row; `/biblioteca` shows the card; `/juegos/missile-defense/jugar` plays.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `missile-defense` with title `MISSILE DEFENSE`, the copy above, category `SHOOTER`, cover `cover-missile`, color `magenta` and `sort_order` 9 (or the value re-checked on promotion).
- [ ] `/juegos/missile-defense/jugar` shows an 800×600 canvas with 4 cities at x = 100, 260, 540, 700, the turret at x = 400 and 12 ammo pips; HUD shows cities 4, wave 01, score 0.
- [ ] A click launches one interceptor from the turret to the cursor at 520 px/s; it explodes at the target point; clicks below y = 520 aim at y = 520.
- [ ] Launches are at least 0.25 s apart; each launch removes 1 ammo pip; with 0 ammo clicks do nothing.
- [ ] A blast reaches radius 44 at 0.35 s, holds until 0.5 s and is gone at 1.0 s.
- [ ] Wave 1 spawns exactly 6 enemy missiles at 40 px/s, within the first 12 s; wave 2 spawns 8 at 46 px/s with 14 ammo; speed never exceeds 120 px/s and a wave never has more than 30 missiles.
- [ ] An enemy missile inside a blast is destroyed, adds exactly 25 and spawns a chain blast of max radius 26.
- [ ] An enemy missile reaching y = 560 within 24 px of a living city destroys it and lowers HUD cities by 1; hitting an already destroyed city changes nothing in the HUD.
- [ ] Ending a wave with 3 cities and 5 unused ammo adds `3 × 100 + 5 × 5 = 325`; 2.5 s later the next wave starts, the ammo refills and HUD wave goes from `01` to `02`.
- [ ] Losing the fourth city opens the game-over modal with the final score once, and no wave bonus is added.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'missile-defense'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=missile-defense`, on `/juegos/missile-defense` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/missile-defense` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze missiles, interceptors, blasts and spawn timers; clicks while paused launch nothing; pressing again resumes with no jump.
- [ ] The aim is correct when the canvas is scaled by CSS (at 375 px width the interceptor goes to the clicked point).
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, cities, ammo, missiles and score; no duplicate loops or listeners run (one click launches exactly one interceptor after 3 restarts).
- [ ] Leaving the page stops the loop, removes the listeners and restores the canvas cursor; no console errors.
- [ ] The five existing games still play exactly as before.
- [ ] No console errors on `/juegos/missile-defense/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with its own layout (four cities, one turret, abstract shapes). **No:** copying the look, city silhouettes, colors, sounds or wave tables of any existing game.
- **Yes:** `id` `missile-defense`, kebab-case as the planner brief says; title `MISSILE DEFENSE`.
- **Yes:** four cities (HUD `hearts` with 4) and one turret. **No:** six cities and three batteries: more scope, and 6 hearts may not fit the HUD.
- **Yes:** limited ammo per wave, refilled every wave. **No:** infinite ammo: there would be no decision in where to shoot.
- **Yes:** a destroyed missile spawns a smaller chain blast. **No:** no chaining: kills would be too hard to score by clever aiming.
- **Yes:** the clamp `y ≤ 520` for the aim point. **No:** shooting at the ground: blasts would be wasted on the ground line.
- **Yes:** the game ends only when all four cities fall; no last wave. **No:** a win state: waves are capped by constants and the score is open ended.
- **Yes:** score +25 per kill, +100 per surviving city and +5 per unused ammo at wave end. **No:** a combo multiplier: it needs more UI.
- **Yes:** the turret is not targetable in the core. **No:** a turret loss mechanic: it needs a rebuild rule, left for a later spec.
- **Yes:** no `touch` entry: the pad cannot aim. **No:** a fake touch scheme.
- **Yes:** HUD `cities` (`hearts`, 4) and `wave` (`pad2`, 1), as the planner brief says. **No:** a `ammo` HUD field: ammo pips are in the world.
- **Yes:** new cover `.cover-missile`, designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games.
- **Yes:** `sort_order` 9, re-checked on promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and duplicates listeners | `GameCanvas` cleanup calls `engine.stop()`, which removes listeners; criterion checks one launch per click.   |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                               |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the 800×600 logic size.                                               |
| Wave never ends because a missile or blast is stuck                       | Every entity has a finite end (impact, blast timeline of 1.0 s, interceptor reaches its point).                |
| Balance: 4 cities fall too fast on wave 3 to 5                            | Numbers are constants; the criteria fix waves 1 and 2; tuning is a later change.                               |
| Chain blasts end waves instantly and give huge scores                     | Chain blast is 0.6 × radius and gives the same 25 per kill; the total is bounded by 30 missiles per wave.     |
| The page scrolls on click or drag on the canvas                           | Clicks do not scroll; arrow keys are not used; no `preventDefault` on keys is needed.                          |
| Mouse-only game advertised as touch on the detail page                    | Flag that the `TÁCTIL` tag is false for this game; fixing it needs its own change.                             |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                         |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.         |

## What is **not** in this spec

- Enemy variety, city rebuilding and bonus items.
- Several turrets, a targetable turret and keyboard control.
- Touch controls, gamepad, sound and music.
- Neon recolor and skins.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
