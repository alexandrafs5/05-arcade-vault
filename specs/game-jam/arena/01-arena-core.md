# SPEC JAM-arena-01 — Twin-stick Arena game (ARENA) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-25
> **Objective:** Add ARENA as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/arena/jugar`.

## Why this spec exists

The game is designed from scratch for the SHOOTER category, which today holds only ASTEROIDS. It is a top-down wave-survival shooter: the player moves with the keyboard and aims and shoots with the mouse. It is the first game that needs keyboard and mouse together. It comes from the `arena` entry of `references/game-suggestions-todo.md`.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal. All art is drawn with canvas primitives, so no assets are loaded.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-arena-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/arena/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: arena floor, player, bullets and drones. Score, lives, wave number, pause menu and game-over overlay are not drawn; the shell shows them. A short "wave start" flash drawn in the world is allowed.
- Mouse input: `mousemove` and `mousedown` listeners on the canvas, `mouseup` on `window`. Pointer coordinates are converted with `getBoundingClientRect` and the logic size 800×600. The canvas gets `style.cursor = "crosshair"` in `start()` and the previous value is restored in `stop()`.
- Entry in `lib/games/registry.ts` with `id: "arena"`, logic size 800×600, HUD fields `lives` and `wave`. No `touch` entry: the game needs a mouse (see Out of scope).
- Migration `supabase/migrations/20261125000100_add_arena_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-arena` in `app/globals.css`, designed with `/frontend-design` (project rule for any UI): cyan palette, a player dot in the middle with a cyan shot line and red-magenta drones around it. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none fits a top-down arena and the last two are reserved for pending suggestions.
- Rules:
  - Arena 800×600, no walls inside. The player is a circle of radius `PLAYER_R = 12`, clamped so it never leaves the canvas. It starts at (400, 300) with 3 lives.
  - Movement: `W` `A` `S` `D` and `←` `↑` `→` `↓` at `PLAYER_SPEED = 240` px/s. Diagonal movement is normalized (the speed does not exceed 240 px/s).
  - Aim: the player faces the mouse cursor. Before the first `mousemove` the aim point is (400, 0).
  - Shooting: holding the left mouse button fires one bullet every `FIRE_COOLDOWN = 0.15` s from the player center toward the cursor. Bullet radius 3, speed 640 px/s, removed when it leaves the canvas. Holding `Space` does not fire (mouse only).
  - Enemy "drone": circle of radius 10, 1 hit point, moves straight toward the player at speed `min(90 + 8 × (wave − 1), 180)` px/s. Spawns on a random point of the canvas border, 2 px outside it.
  - Wave `n` has `min(5 + 3 × (n − 1), 40)` drones, spawned one every `SPAWN_INTERVAL = 0.5` s. The wave ends when all drones have spawned and none is alive. After `WAVE_PAUSE = 2` s the next wave starts. There is no last wave.
  - Contact: when a drone touches the player (distance < 22) and the player is not invulnerable, the player loses 1 life, the drone is removed with no points, and the player is invulnerable for `INVULN = 1.5` s (blinking). Drones pass through an invulnerable player.
  - Game over: at 0 lives, `state = "gameover"` and `onGameOver(score)` fires once.
- Scoring: +10 per drone killed by a bullet; +100 × wave number when a wave ends (wave 1 gives 100, wave 4 gives 400). The score is an integer, always between 0 and 10,000,000.
- `CLAUDE.md` update: the `games` table row for `arena` and a note that the game uses keyboard plus mouse.

**Out of scope (for future specs):**

- Enemy and power-up variety (see `02-arena-enemies-powerups.md`).
- Touch or on-screen controls (the game needs a mouse), gamepad, sound and music.
- Neon recolor and skins, bosses, enemy bullets, obstacles inside the arena.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'arena'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'arena',
  'ARENA',
  'Sobrevive oleadas apuntando con el ratón.',
  'Muévete con el teclado, apunta y dispara con el ratón y sobrevive a oleadas cada vez más grandes de drones. Tienes tres vidas: cuando se acaban, se acaba la partida.',
  'SHOOTER',
  'cover-arena',
  'cyan',
  7
);
```

`color` is one of `cyan`, `magenta`, `green`, `yellow` (check constraint). Today `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green; `cyan` is the planner's pick. `sort_order` 7 is the next free value at this moment (the highest live value is 5; the `scramble` jam draft reserves 6, and the other two jam games in this batch take 8 and 9). The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`). Both are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
  { key: "wave", label: "Oleada", format: "pad2", initial: 1 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { lives, wave } }
```

```ts
// lib/games/arena/constants.ts
const W = 800, H = 600;
const PLAYER_R = 12, PLAYER_SPEED = 240, START_LIVES = 3, INVULN = 1.5;
const BULLET_R = 3, BULLET_SPEED = 640, FIRE_COOLDOWN = 0.15;
const DRONE_R = 10, DRONE_SPEED_BASE = 90, DRONE_SPEED_STEP = 8, DRONE_SPEED_MAX = 180;
const WAVE_BASE = 5, WAVE_STEP = 3, WAVE_MAX = 40;
const SPAWN_INTERVAL = 0.5, WAVE_PAUSE = 2;
const DRONE_POINTS = 10, WAVE_BONUS = 100; // wave bonus = WAVE_BONUS × wave
```

Conventions:

- Logic canvas is 800×600, origin top-left, units in pixels. Speeds are in px/s and multiplied by `dt` (already capped at 0.05 s).
- Entities are plain objects in arrays inside the closure (`bullets`, `drones`). Bullet and drone collisions are circle-circle checks; a bullet that hits a drone is removed and the drone dies in the same frame.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.

## Implementation plan

1. Create `lib/games/arena/constants.ts` with the constants above, the key map and the colors. Manual check: `npm run lint` passes.
2. Create `lib/games/arena/engine.ts`, first part: closure state, `reset`, player movement with normalized diagonal and clamping, key handling with `preventDefault` on arrows, input cleared on pause, blur and stop. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: mouse handling (`mousemove`, `mousedown` on the canvas, `mouseup` on `window`, `getBoundingClientRect` conversion, crosshair cursor), bullets with the 0.15 s cooldown. Manual check: lint and tsc pass.
4. Extend `engine.ts`: drones, wave spawner, collisions, invulnerability, scoring, wave bonus, snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (floor, player with aim line, bullets, drones, blink), rAF loop with `dt` cap and idle-frame skip while paused or game over, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/arena/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
7. Add `.cover-arena` to `app/globals.css` with `/frontend-design`. Manual check: the class renders in a card preview with no layout change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `arena` row; `/biblioteca` shows the card with the new cover; `/juegos/arena/jugar` plays; lives, wave and score update.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `arena` with title `ARENA`, the copy above, category `SHOOTER`, cover `cover-arena`, color `cyan` and `sort_order` 7 (or the value re-checked on promotion).
- [ ] `/juegos/arena/jugar` shows an 800×600 canvas; the game starts with the player at (400, 300), 3 lives, wave 1, score 0.
- [ ] `W` `A` `S` `D` and the arrow keys move the player at 240 px/s; moving diagonally does not exceed 240 px/s; the player never leaves the canvas.
- [ ] The player faces the cursor; holding the left button fires 1 bullet every 0.15 s (about 6.7 per second) at 640 px/s toward the cursor; releasing stops fire; `Space` does not fire.
- [ ] Wave 1 spawns exactly 5 drones, one every 0.5 s, moving at 90 px/s; wave 2 spawns 8 at 98 px/s; the drone speed never exceeds 180 px/s and a wave never has more than 40 drones.
- [ ] A bullet hit kills a drone and adds exactly 10 to the score.
- [ ] Ending a wave adds `100 × wave` to the score and, 2 s later, starts the next wave; the HUD wave goes from `01` to `02`.
- [ ] A drone touching the player removes 1 heart, adds no points and gives 1.5 s of invulnerability during which no life is lost.
- [ ] Losing the third life opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'arena'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=arena`, on `/juegos/arena` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/arena` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, bullets and spawn timer; pressing again resumes with no jump.
- [ ] While the game is mounted, the arrow keys do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The mouse aim is correct when the canvas is scaled by CSS (at 375 px width the bullet leaves toward the cursor).
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, player, bullets, drones and score; no duplicate loops run (fire rate stays 0.15 s after 3 restarts).
- [ ] Holding the mouse button, then pausing or switching windows, stops firing; it does not resume by itself.
- [ ] Leaving the page stops the loop: no console errors, window listeners are removed and the canvas cursor is restored.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/arena/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch as a generic top-down wave shooter with abstract shapes (circles and lines). **No:** copying the look, enemies or names of an existing twin-stick game.
- **Yes:** `id` `arena`, English slug; title `ARENA`. **No:** a longer id: the URL stays short.
- **Yes:** keyboard moves, mouse aims and shoots, as the planner brief says. **No:** aiming with the keyboard or gamepad sticks: out of scope.
- **Yes:** hold the left button to fire with a 0.15 s cooldown. **No:** one shot per click: it makes players wear out the mouse.
- **Yes:** drones are removed on contact and give no points. **No:** points for ramming: it would reward getting hit.
- **Yes:** 1.5 s invulnerability after a hit. **No:** instant chained hits: three drones on the same frame would end the game unfairly.
- **Yes:** single enemy type in the core. **No:** more types here: they go in `02-arena-enemies-powerups.md`.
- **Yes:** wave bonus `100 × wave` to reward surviving deeper. **No:** time bonus: it would need a visible timer.
- **Yes:** drone speed capped at 180 px/s and count capped at 40. **No:** unbounded growth: the arena would become unwinnable and unreadable.
- **Yes:** no `touch` entry in the registry. The on-screen pad sends keys only and cannot aim. **No:** a fake touch scheme.
- **Yes:** HUD `lives` (`hearts`, 3) and `wave` (`pad2`, 1). Score is shown by the shell. **No:** extra fields.
- **Yes:** new cover `.cover-arena`, designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games.
- **Yes:** color `cyan`: category SHOOTER already has a yellow game. **No:** `yellow` again.
- **Yes:** `sort_order` 7 (next free value), re-checked on promotion.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks fire rate after restarts.   |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                 |
| Mouse button stuck "held" after pause, blur or a release outside the page | `mouseup` is on `window`; the held flag is cleared on `setPaused`, `blur` and `stop`.                            |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the 800×600 logic size.                                                 |
| Keyboard and mouse together: key rollover drops diagonal keys             | Track keys in a set by `code`; no key combination other than two movement keys is required.                      |
| Enemy balance: wave 4+ too hard or too easy                               | Numbers are constants in `constants.ts`; the criteria fix wave 1 and 2 exactly; tuning is a later change.        |
| Drones spawning on top of the player                                      | Spawn is on the border, 2 px outside the canvas; the player is clamped inside, so the minimum distance is 2 px+. |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                           |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it: the `TÁCTIL` tag is false for ARENA (mouse needed); fixing it needs its own change.                     |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.           |

## What is **not** in this spec

- Enemy types, power-ups and pickups.
- Touch controls, gamepad, sound and music.
- Neon recolor and skins, bosses, enemy bullets, obstacles.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
