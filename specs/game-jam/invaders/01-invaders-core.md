# SPEC JAM-invaders-01 — Hive Invaders game (INVADERS) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-26
> **Objective:** Add INVADERS as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/invaders/jugar`.

## Why this spec exists

There is no reference folder: the game is written from scratch from the `invaders` entry in `references/game-suggestions-todo.md` (SHOOTER, "classic score-chase, keyboard only, waves give clear game over and replay value"). The suggestion lists two risks:

- **Original alien art.** No licensed assets, names or silhouettes. The aliens here are "hive" creatures (a lantern-shaped Drone, a wing-shaped Weaver, a crowned Commander) drawn with canvas paths and two animation frames each. No sprite files, no copy of any pixel-art shape. `/spec-impl` must use `/frontend-design` for the silhouettes.
- **Distinct from Asteroids.** ASTEROIDS is free-flight vector shooting with inertia. INVADERS is a fixed-screen formation game: the player only moves along one line, the threat is a descending grid that speeds up as it thins, and there are destructible bunkers and a bonus comet. Different input feel (left/right only), different pressure (the floor is the clock) and different scoring (kill values by row).

The unused cover `.cover-invaders` already exists in `app/globals.css` (green and magenta dots on a dark blue gradient), so no cover CSS is added.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-invaders-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/invaders/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `ArrowLeft`, `ArrowRight`, `ArrowUp` and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: starfield, aliens, bunkers, ship, bullets, bombs, comet. Score, lives, wave, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "invaders"`, logic size 560×640, HUD fields `lives` and `wave`.
- Migration `supabase/migrations/20261126000300_add_invaders_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- Reuse the existing unused cover `.cover-invaders`. No new cover CSS.
- Rules:
  - Formation: 8 columns × 5 rows, alien box 36×24, spacing 56 px horizontally and 40 px vertically. Wave 1 top-left alien at `(56, 80)`; each next wave starts `16 px` lower, up to 5 extra steps (`startY = 80 + 16 × min(wave - 1, 5)`).
  - Alien types by row: row 0 Commander (30 points), rows 1 and 2 Weaver (20 points), rows 3 and 4 Drone (10 points).
  - The formation moves in steps. Each step moves it 8 px horizontally and toggles the animation frame. Step interval in seconds is `(0.04 + 0.46 × alive / 40) × max(0.5, 1 − 0.08 × (wave − 1))`, so 40 aliens step every 0.5 s in wave 1 and one alien steps every 0.05 s. When any alien would pass `x < 20` or `x + 36 > 540`, the formation descends 20 px instead of moving sideways and reverses direction.
  - Ship: 40×16 at `y = 596`, speed 280 px/s, clamped to `x 20–540` (ship center). Keys: `←` `→` or `A` `D` to move; `Space` or `↑` to fire. Holding the fire key fires again as soon as the bullet is gone.
  - Player bullet: 4×14, speed 560 px/s upward, one on screen at a time.
  - Alien bombs: 6×14, fall at `220 + 15 × (wave − 1)` px/s. Max on screen: `min(2 + floor((wave − 1) / 2), 5)`. A bomb is fired every random 0.5–1.1 s (if under the max) by a random alive alien that is the lowest in its column.
  - Bunkers: 4, at `x = 56, 192, 328, 464`, `y = 500`, each 8×5 blocks of 8 px (64×40, rounded top corners removed: blocks `(0,0)`, `(7,0)` are not created). A bullet or bomb that hits a block removes that block and its four direct neighbours and disappears. An alien overlapping a block removes it. Bunkers are rebuilt at the start of each wave.
  - A player bullet that overlaps a bomb removes both (no points).
  - Comet: every 22 s of play a 44×16 bonus comet crosses at `y = 44` at 120 px/s, alternating direction. Hit value depends on the number of shots fired in the whole game when it is hit: `[100, 50, 150, 300][shotsFired % 4]`.
  - Ship hit by a bomb: lives −1, bombs cleared, 1.5 s of invulnerability (blinking), ship returns to `x = 280`. At 0 lives: game over.
  - An alien whose bottom edge reaches `y >= 560` ends the game immediately (lives are ignored).
  - Wave clear: all 40 aliens dead. Bonus `50 × wave` points, then the next wave starts after 1.5 s (bullets and bombs cleared). There is no final wave.
  - Score is the sum of kills, comets and wave bonuses. Lives start at 3, with no extra life in this spec.
- Spanish UI strings: HUD labels `Vidas`, `Oleada`.
- `CLAUDE.md` update: the `games` table (row `invaders`) and the "Five games" sentence.

**Out of scope (for future specs):**

- Power cells, elite aliens and bosses (`JAM-invaders-02`).
- Sound and music.
- Touch controls, gamepad, multiplayer.
- Extra lives, shield variants, two-player mode.
- Neon recolor of the in-canvas world.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'invaders'`). Waves have no end, but the 720 point maximum from wave kills (8×30 + 16×20 + 16×10) and 3 lives keep scores far below 10,000,000.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'invaders',
  'HIVE INVADERS',
  'Frena la oleada antes de que toque el suelo.',
  'Una colmena alienígena desciende en formación y cada vez va más rápido. Muévete, dispara y refúgiate tras los búnkeres. Cada oleada es más dura; si te quedas sin vidas o los invasores llegan al suelo, se acabó.',
  'SHOOTER',
  'cover-invaders',
  'cyan',
  9
);
```

`color` must be one of `cyan`, `magenta`, `green`, `yellow`. Today: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. Jam games: `hoops` yellow, `gallery` magenta. `cyan` is chosen to keep the catalog colors balanced and because the cover background is dark blue. `sort_order` 9 is the next free value at this moment (1 to 5 taken, 6 held by the draft `scramble`, 7 by `hoops`, 8 by `gallery`). Both the timestamp and `sort_order` are re-checked when the spec is promoted.

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
// lib/games/invaders/constants.ts
const W = 560, H = 640;
const COLS = 8, ROWS = 5, ALIEN = { w: 36, h: 24 }, SPACING = { x: 56, y: 40 };
const FORM_START = { x: 56, y: 80 }, FORM_STEP_X = 8, FORM_DROP = 20, EDGE = { left: 20, right: 540 };
const ROW_TYPE = ["commander", "weaver", "weaver", "drone", "drone"] as const;
const POINTS = { commander: 30, weaver: 20, drone: 10 };
const SHIP = { w: 40, h: 16, y: 596, speed: 280 }, LIVES_START = 3, INVULN_S = 1.5;
const BULLET = { w: 4, h: 14, speed: 560 };
const BOMB = { w: 6, h: 14, speed: 220, speedPerWave: 15, gapMin: 0.5, gapMax: 1.1 };
const BUNKER_XS = [56, 192, 328, 464], BUNKER_Y = 500, BLOCK = 8, BUNKER_COLS = 8, BUNKER_ROWS = 5;
const COMET = { y: 44, w: 44, h: 16, speed: 120, every: 22, values: [100, 50, 150, 300] };
const FLOOR_Y = 560, WAVE_BONUS = 50, WAVE_PAUSE = 1.5;
```

Conventions:

- Logic canvas is 560×640, origin top-left, units in pixels and seconds. Movement is `px/s × dt`, so it does not depend on the frame rate; the formation moves on a step timer (like SNAKE).
- Bunker blocks are a boolean grid per bunker, not pixels.
- `shotsFired` counts every bullet the ship fires in the whole game (not reset per wave) and drives the comet value.
- State is `playing` until game over, then `gameover` directly. `dead` is unused (respawn is handled inside the engine by the invulnerability timer).

## Implementation plan

1. Create `lib/games/invaders/constants.ts` with the constants above. Manual check: `npm run lint` passes.
2. Create `lib/games/invaders/engine.ts`, first part: closure state (aliens, bunkers, ship, bullet, bombs, comet, score, lives, wave, state), `buildWave`, formation step with edge logic and the speed formula, and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: ship movement, bullet, bombs and fire timer, collisions (bullet-alien, bullet-bomb, bullet/bomb-bunker, alien-bunker, bomb-ship), lives, invulnerability, floor game over. Manual check: lint and tsc pass.
4. Extend `engine.ts`: comet timer and value table, wave clear and bonus, next wave scaling. Manual check: lint and tsc pass.
5. Extend `engine.ts`: key handling (arrows, `A` `D`, `Space`, `ArrowUp`), `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
6. Extend `engine.ts`: draw (starfield, three alien silhouettes with two frames each designed with `/frontend-design`, bunkers, ship, bullets, bombs, comet), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`, skip idle redraws when paused. Manual check: lint and tsc pass.
7. Add the `registry.ts` entry. Manual check: `/juegos/invaders/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `invaders` row; `/biblioteca` shows the card with the `.cover-invaders` art; `/juegos/invaders/jugar` plays.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `invaders` with title `HIVE INVADERS`, the copy above, category `SHOOTER`, cover `cover-invaders`, color `cyan` and `sort_order` 9 (or the next free value at promotion).
- [ ] `/juegos/invaders/jugar` shows a 560×640 canvas; the game starts with score 0, 3 hearts, wave `01`, 40 aliens in an 8×5 grid with the top-left alien at `(56, 80)`, 4 bunkers and the ship at `y = 596`.
- [ ] `←` `→` and `A` `D` move the ship at 280 px/s, clamped to `x 20–540`.
- [ ] `Space` and `↑` fire; there is never more than one player bullet on screen; holding the key fires again as soon as the bullet is gone.
- [ ] Killing a Commander adds 30, a Weaver 20 and a Drone 10.
- [ ] The formation steps every 0.5 s with 40 aliens in wave 1 and every 0.05 s with 1 alien, moving 8 px per step.
- [ ] At the left (`x < 20`) or right (`x + 36 > 540`) edge the formation descends exactly 20 px and reverses.
- [ ] A bullet or bomb that hits a bunker removes that block and its 4 direct neighbours.
- [ ] A bullet overlapping a bomb removes both and adds 0 points.
- [ ] A bomb hit lowers hearts by 1, clears all bombs, and the ship is invulnerable and blinking for 1.5 s.
- [ ] Never more than 2 bombs are on screen in waves 1 and 2, 3 in waves 3 and 4, up to a maximum of 5.
- [ ] A comet crosses at `y = 44` every 22 s of play time at 120 px/s; the points depend on `shotsFired % 4` as `[100, 50, 150, 300]`.
- [ ] An alien bottom edge reaching `y = 560` opens the game-over modal at once, even with lives left.
- [ ] Losing the last heart opens the game-over modal once with the final score.
- [ ] Clearing all 40 aliens adds `50 × wave` points and starts the next wave after 1.5 s; the HUD wave goes from `01` to `02`, the formation starts 16 px lower and bunkers are rebuilt.
- [ ] Wave 2 bombs fall at 235 px/s and the step interval is multiplied by 0.92.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'invaders'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=invaders`, on `/juegos/invaders` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/invaders` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and all timers; pressing again resumes with no jump (the formation does not take an extra step).
- [ ] While the game is mounted, the arrow keys and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, wave, aliens, bunkers and score; no duplicate loops run (step interval with 40 aliens stays 0.5 s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/invaders/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with the classic fixed-formation genre rules. **No:** reusing any existing invaders game's names, silhouettes, sounds, layouts or level data.
- **Yes:** `id` `invaders`, from the planner entry, and the original title `HIVE INVADERS`. **No:** a title that reuses a trademark.
- **Yes:** original "hive" creatures (Drone, Weaver, Commander) drawn with canvas paths and designed with `/frontend-design`. **No:** sprite sheets, pixel-art crabs or squids, or any file from outside the repo.
- **Yes:** keep it clearly different from ASTEROIDS: fixed formation, one-axis ship, bunkers, floor as the lose line, comet bonus. **No:** free flight, inertia or wrap-around.
- **Yes:** one bullet at a time. It keeps the skill in timing and forces target choice. **No:** rapid fire in the core (it comes as a power in `JAM-invaders-02`).
- **Yes:** the floor ends the game regardless of lives. **No:** lives as a buffer against the formation: it would remove the pressure.
- **Yes:** the comet value follows `shotsFired % 4`. It is a readable trick for score chasers, with no hidden randomness. **No:** random values.
- **Yes:** endless waves with a gentle ramp (bombs, speed, start height capped at 5 steps). **No:** a final wave: the shell only knows `gameover`.
- **Yes:** HUD fields `lives` (`hearts`, 3) and `wave` (`pad2`, 1). **No:** a `number` field for aliens left: it is visible in the canvas.
- **Yes:** reuse `.cover-invaders` (exists, unused). **No:** a new cover.
- **Yes:** color `cyan`, `sort_order` 9 (re-checked on promotion).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Alien art looks like a licensed game's aliens                             | Original lantern / wing / crown silhouettes, `/frontend-design` review; no existing sprite is traced.      |
| Feels like a reskinned Asteroids (same category)                          | The distinct mechanics listed in "Why this spec exists"; criteria check formation, bunkers and floor loss. |
| Step formula makes the last aliens unplayably fast                        | Minimum interval 0.05 s (8 px / 0.05 s = 160 px/s), below the ship speed of 280 px/s; tune only constants. |
| Aliens at wave 6+ start too low to survive                                | `startY` capped at `80 + 16 × 5 = 160`; the formation needs about 18 drops to reach the floor.            |
| Bunker block removal feels too strong or weak                             | One cross-shaped removal rule in one function; the 5-block footprint is a constant, not scattered logic.  |
| Input stuck after pause or blur                                           | Clear keys on `setPaused`, on `window` blur and on `stop`.                                                |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks the step after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                          |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                    |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for INVADERS (no touch controls); fixing it needs its own change.             |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.    |

## What is **not** in this spec

- Power cells, elite aliens and bosses.
- Sound and music.
- Touch controls, gamepad and multiplayer.
- Extra lives, shield variants and two-player mode.
- Neon recolor.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
