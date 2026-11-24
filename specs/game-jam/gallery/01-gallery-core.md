# SPEC JAM-gallery-01 — Neon Gallery game (NEON GALLERY) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-24
> **Objective:** Add NEON GALLERY as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/gallery/jugar`.

## Why this spec exists

There is no reference game folder. NEON GALLERY is written from scratch in the classic carnival shooting-gallery genre: moving targets on shelves, a limited magazine, a countdown. It is an original game with its own targets (neon lanterns, stars, decoys, clocks) drawn with canvas primitives, no sprites and no licensed names or art.

It is the SHOOTER entry of the "Neon Fairground" jam set (`bubbles`, `gallery`, `duelo`), taken from the `gallery` brief in `references/game-suggestions-todo.md`. That brief names the risk "low depth and replay value". The depth is built into this core spec, not postponed: three shelf speeds, four target kinds (one with a time penalty, one with a time bonus), bullseye zones, a streak multiplier, a reload cost and a difficulty ramp.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-gallery-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

## Scope

**In:**

- Engine in `lib/games/gallery/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: booth wall, three shelves, targets, counter, crosshair, small floating "+N" texts and the pop animation. Score, time, ammo, pause menu and game-over overlay are not drawn; the shell shows them. A reload progress ring is drawn around the crosshair.
- Mouse input: `mousemove` moves the crosshair, `mousedown` (button 0) on the canvas fires. Pointer coordinates are converted with `getBoundingClientRect` and the logic size. The engine sets `canvas.style.cursor = "none"` in `start` and restores the previous value in `stop`, so the shell CSS is not changed.
- Keyboard fallback: arrows move the crosshair at 360 px/s, `Space` fires, `R` reloads. The last input device used owns the crosshair.
- Entry in `lib/games/registry.ts` with `id: "gallery"`, logic size 640×480, HUD fields `time` and `ammo`.
- Migration `supabase/migrations/20261124000100_add_gallery_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- New cover `.cover-gallery` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none fits a shooting booth, and `.cover-duelo` is reserved for the `duelo` jam game.
- Rules:
  - A round lasts `ROUND_TIME = 60` s. The clock runs from the first frame of `playing`. When `timeLeft ≤ 0`, `state = "gameover"` and `onGameOver(score)` fires once. There is no other way to lose.
  - Booth: 640×480, origin top-left, units in pixels. Shelves are target lanes at y `170`, `255`, `340`. Shelf 1 and 3 move left to right, shelf 2 right to left. Base speeds `110`, `160`, `210` px/s. Counter band `y ≥ 410`.
  - Difficulty ramp: speed factor `min(1 + elapsed / 120, 2)` multiplies every target speed (elapsed = seconds played, so at 60 s it is 1.5).
  - Spawning: each shelf has its own timer; after each spawn the next one is drawn uniformly from 0.9 s to 1.8 s. A shelf holds at most 4 live targets. Targets spawn centered 40 px outside the screen edge they enter from and are removed when 40 px outside the opposite edge.
  - Target kinds (weights: lantern 60, star 20, decoy 15, clock 5):

    | Kind    | Radius | Speed × | Effect when hit                                      |
    | ------- | ------ | ------- | ---------------------------------------------------- |
    | lantern | 26     | 1.0     | +10 points                                           |
    | star    | 16     | 1.6     | +30 points                                           |
    | decoy   | 24     | 1.0     | −4 s of time, streak reset to 0, no points           |
    | clock   | 20     | 1.0     | +5 points and +3 s of time (`timeLeft` capped at 99) |

  - Hit test: the shot point is compared with every target that is not already popping; the topmost (latest spawned) containing the point wins. One shot hits at most one target.
  - Bullseye: a hit within `0.4 × radius` of the target center doubles the base points of lantern, star and clock. It has no effect on decoys.
  - Streak: `streak` counts consecutive scoring hits (lantern, star, clock). A shot with no target, or a decoy hit, sets `streak = 0`. Multiplier `min(1 + floor((streak − 1) / 3), 5)` computed after incrementing: hits 1–3 ×1, 4–6 ×2, 7–9 ×3, 10–12 ×4, 13 and up ×5.
  - Points for a scoring hit: `base × (bullseye ? 2 : 1) × multiplier`.
  - Magazine: 6 rounds, HUD `ammo`. Each shot uses 1. Minimum `0.12` s between shots. When `ammo` reaches 0, an automatic reload starts. `R` starts a reload when `ammo < 6`. A reload lasts `1.0` s, ignores fire input, and sets `ammo = 6` at the end. During a reload the HUD `ammo` shows 0.
  - A hit target plays a 0.25 s pop animation and cannot be hit again.
  - HUD `time` shows `ceil(timeLeft)` and changes once per second.
  - Start: score 0, `time` 60, `ammo` 6.
- Scores through the existing `saveScore` (`lib/session.tsx`) into `scores`. Nothing new in the shell. The game shows on `/salon?game=gallery`, `/juegos/gallery` (top 10), the home lists and the game card stats with no extra code.
- `CLAUDE.md` update: the `games` table row list.

**Out of scope (for future specs):**

- Rare targets, ammo crates, frost, booth changes and the accuracy bonus: JAM-gallery-02.
- Sound and music.
- Touch or on-screen controls, gamepad.
- Neon recolor skins (`classic`, `neon`, `retro`).
- A scope-zoom mechanic or recoil.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'gallery'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'gallery',
  'NEON GALLERY',
  'Apunta rápido y esquiva los señuelos.',
  'Tienes sesenta segundos y seis balas en el puesto de tiro de la feria. Acierta linternas y estrellas, encadena aciertos para multiplicar los puntos y no dispares a los señuelos: te quitan tiempo.',
  'SHOOTER',
  'cover-gallery',
  'magenta',
  8
);
```

`sort_order` 8 is the next free value at this moment: `asteroids` 1 to `frogger` 5, `scramble` (jam) reserves 6, `bubbles` (jam) 7; `duelo` (jam) takes 9. `color` must be one of `cyan`, `magenta`, `green`, `yellow` (check constraint). Both the migration timestamp (later than `20261118050845`, the last file today) and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "time", label: "Tiempo", format: "number", initial: 60 },
  { key: "ammo", label: "Balas", format: "number", initial: 6 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { time, ammo } }
```

```ts
// lib/games/gallery/constants.ts
const W = 640, H = 480;
const ROUND_TIME = 60, TIME_CAP = 99;
const SHELVES = [
  { y: 170, dir: 1, speed: 110 },
  { y: 255, dir: -1, speed: 160 },
  { y: 340, dir: 1, speed: 210 },
];
const KINDS = {
  lantern: { r: 26, speedMul: 1.0, weight: 60, points: 10 },
  star: { r: 16, speedMul: 1.6, weight: 20, points: 30 },
  decoy: { r: 24, speedMul: 1.0, weight: 15, points: 0 },
  clock: { r: 20, speedMul: 1.0, weight: 5, points: 5 },
};
const MAG_SIZE = 6, RELOAD_TIME = 1.0, FIRE_GAP = 0.12;
const DECOY_PENALTY = 4, CLOCK_BONUS = 3, BULLSEYE = 0.4, STREAK_STEP = 3, MULT_MAX = 5;
const KEY_CROSSHAIR_SPEED = 360, POP_TIME = 0.25;
```

Conventions:

- Logic canvas is 640×480, units in pixels, time inside the engine in seconds. Target speeds are px/s, so play is frame-rate independent.
- The engine uses `Math.random` for spawns; there is no seed.
- State `dead` is unused: the game goes from `playing` to `gameover` directly.
- No new tables, no new `localStorage` keys.

## Implementation plan

1. Create `lib/games/gallery/constants.ts` with the constants above. Manual check: `npm run lint` passes.
2. Create `lib/games/gallery/engine.ts`, first part: closure state (targets, timers, streak, ammo, reload, timeLeft, score), spawn per shelf, movement, removal, and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: crosshair input (mouse with `getBoundingClientRect`, arrow keys), fire, hit test, bullseye, streak, decoy and clock effects, magazine and reload, cursor hiding. Manual check: lint and tsc pass.
4. Extend `engine.ts`: draw (booth, shelves, targets, pop animation, floating texts, reload ring, crosshair), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/gallery/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
6. Add the `.cover-gallery` rule to `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview and does not change other covers.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `gallery` row; `/biblioteca` shows the card with the new cover; `/juegos/gallery/jugar` plays.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `gallery` with title `NEON GALLERY`, the copy above, category `SHOOTER`, cover `cover-gallery`, color `magenta` and `sort_order` 8.
- [ ] `/juegos/gallery/jugar` shows a 640×480 canvas; the game starts with HUD time 60, ammo 6 and score 0, and the system cursor is hidden over the canvas.
- [ ] Targets travel on three shelves at y 170, 255 and 340; shelves 1 and 3 move to the right, shelf 2 to the left, at 110, 160 and 210 px/s at the start.
- [ ] A shelf never holds more than 4 live targets.
- [ ] The crosshair follows the mouse; arrow keys move it at 360 px/s; at 375 px width the shot lands under the visible crosshair (coordinates converted with `getBoundingClientRect`).
- [ ] A left click on the canvas fires one shot; `Space` fires one shot; two shots are never fired within 0.12 s.
- [ ] A lantern hit (outside the bullseye, streak 1) adds exactly 10; a star adds 30; a clock adds 5 and 3 seconds.
- [ ] A hit inside 0.4 × radius doubles the base points: a lantern bullseye adds 20.
- [ ] The multiplier steps: the 4th consecutive scoring hit is ×2, the 7th ×3, the 10th ×4, the 13th ×5, and it never exceeds ×5.
- [ ] A shot that hits nothing resets the streak; a decoy hit removes 4 seconds, resets the streak and adds 0 points.
- [ ] A decoy hit with 3 seconds left ends the game immediately with the current score.
- [ ] The time never exceeds 99 after clocks.
- [ ] Each shot lowers HUD ammo by 1; at 0 a reload starts automatically; during the reload (1.0 s) fire input does nothing and HUD ammo shows 0; after it HUD ammo shows 6.
- [ ] `R` with ammo 3 starts a 1.0 s reload and ends with ammo 6; `R` with ammo 6 does nothing.
- [ ] Target speeds grow with play time: at 60 s elapsed a lantern on shelf 1 moves at 165 px/s.
- [ ] The HUD time shows 60 and decreases by 1 each second; at 0 the game-over modal opens with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'gallery'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=gallery`, on `/juegos/gallery` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/gallery` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas and the clock; pressing again resumes with no jump; clicks while paused do not fire.
- [ ] While the game is mounted, the arrow keys and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD, targets, streak and clock; no duplicate loops run (shelf speeds stay 110, 160, 210 px/s at the start after 3 restarts).
- [ ] Leaving the page stops the loop, restores the canvas cursor, removes window listeners and logs no console errors.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/gallery/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with the shooting-gallery genre rules. **No:** copying the targets, art or music of any existing gallery game.
- **Yes:** `id` `gallery`, English slug, title `NEON GALLERY`, same convention as the other games.
- **Yes:** category `SHOOTER`, color `magenta` (as in the planner brief). **No:** another color: the catalog already has `tetris` in magenta, flagged for review.
- **Yes:** the game ends only when time runs out, so every run is 60 s and scores compare fairly. **No:** lives or a win state.
- **Yes:** depth in the core: shelf speeds, penalty and bonus targets, bullseye, streak, reload cost and a ramp. **No:** shipping a flat core and promising depth later: the brief's risk is low replay value.
- **Yes:** a decoy never subtracts points: the score stays a non-negative integer and the penalty is time. **No:** negative scores.
- **Yes:** HUD `time` and `ammo` (`number`), as briefed. **No:** a streak HUD field: it needs no HUD format and is shown by "+N" floating texts in the world.
- **Yes:** the engine hides and restores the canvas cursor itself. **No:** changing `globals.css` or the shell for it.
- **Yes:** mouse first, with a keyboard fallback so the game is playable without a mouse. **No:** touch controls: out of scope.
- **Yes:** no sprites, everything drawn with canvas primitives. **No:** assets: no `public/games/gallery/` and no SPEC 08 dependency.
- **Yes:** new cover `.cover-gallery` designed with `/frontend-design`. **No:** reusing `.cover-duelo` (reserved for `duelo`), `.cover-invaders` or `.cover-glot`.
- **Yes:** `sort_order` 8 (next free value, re-checked on promotion).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Low depth and replay value (named in the brief)                           | Streak, bullseye, penalty and bonus targets, reload cost and speed ramp are in this spec; JAM-gallery-02 adds more. |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the 640×480 logic size; a criterion checks it at 375 px width.         |
| The hidden system cursor stays hidden after leaving the page              | `stop` restores the previous `canvas.style.cursor`; criterion checks it.                                         |
| Click on PAUSA or on a shell button fires a shot                          | Fire only on `mousedown` events whose target is the canvas, and not while paused.                               |
| Fast stars tunnel past a click point                                      | Hit test is a point-in-circle at the instant of the click, there is no projectile travel.                        |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speeds after restarts.      |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                |
| Input stuck after pause or blur                                           | Clear keys on `setPaused`, on `window` blur and on `stop`.                                                      |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                          |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for NEON GALLERY (no touch controls); fixing it needs its own change.               |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.          |

## What is **not** in this spec

- Rare targets, ammo crates, frost, booth changes and the accuracy bonus (JAM-gallery-02).
- Sound and music.
- Touch or on-screen controls and gamepad.
- Neon recolor skins.
- Scope zoom or recoil.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
