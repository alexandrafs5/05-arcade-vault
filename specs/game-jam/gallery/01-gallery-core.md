# SPEC JAM-gallery-01 — Shooting Gallery game (GALLERY) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-26
> **Objective:** Add GALLERY as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/gallery/jugar`.

## Why this spec exists

There is no reference folder: the game is written from scratch from the `gallery` entry in `references/game-suggestions-todo.md` (SHOOTER, magenta, "mouse target shooting, tiny scope, fast sessions"). The suggestion flags low depth and replay value as the risk, so the core already includes the two depth tools that carry the leaderboard: a hit-streak multiplier and three target rows with different size, speed and value. Further variety is in `JAM-gallery-02`.

The whole game is drawn with canvas primitives (fairground rails, wooden discs); no assets, no sprites. The shooting is hitscan: a click hits whatever is under the crosshair at that instant.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-gallery-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/gallery/` (`constants.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; the canvas cursor is set to `none` in `start` and restored in `stop`; `preventDefault` on `Space` except while typing in an `INPUT` or `TEXTAREA`; `contextmenu` is prevented on the canvas only.
- The canvas draws only the world: backdrop, rails, targets, muzzle flash, the small crosshair ("tiny scope"). Score, time, ammo, pause menu and game-over overlay are not drawn; the shell shows them.
- Mouse coordinates convert with `getBoundingClientRect` and the logic size.
- Entry in `lib/games/registry.ts` with `id: "gallery"`, logic size 640×480, HUD fields `time` and `ammo`.
- Migration `supabase/migrations/20261126000200_add_gallery_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-gallery` in `app/globals.css`, designed with `/frontend-design`. Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows a target (`.cover-invaders` is used by the jam game `invaders`, `.cover-duelo` is reserved for a pending suggestion, `.cover-glot` shows a maze eater).
- Rules:
  - 45 seconds per game. The clip holds 8 rounds. Fire with the left mouse button. `R` reloads (only when the clip has fewer than 8 rounds). An empty clip reloads automatically. Reload takes 1.2 s; clicks during reload are ignored (neither hit nor miss).
  - Three rails (rows), each with its own target size, speed, direction and base value:

    | Row | y   | Radius | Speed (px/s) | Direction | Base points |
    | --- | --- | ------ | ------------ | --------- | ----------- |
    | 0   | 150 | 30     | 90           | right     | 10          |
    | 1   | 260 | 24     | 150          | left      | 20          |
    | 2   | 370 | 18     | 230          | right     | 40          |

  - Targets spawn just outside the screen (`x = -R` or `x = 640 + R`), at a random interval between 0.7 s and 1.5 s per row, at most 4 per row, and are removed when they leave on the other side.
  - A shot hits the topmost target whose center is within its radius of the crosshair (the most recently spawned wins ties). The ring is decided by `d / R`: bullseye at `d / R <= 0.25` (×3), inner ring at `<= 0.6` (×2), outer ring above (×1).
  - Points of a hit are `base × ring × combo`. The combo multiplier is `min(1 + floor(hits / 3), 4)`, where `hits` is the number of consecutive hits before this one (hits 1–3 count ×1, 4–6 ×2, 7–9 ×3, 10 and later ×4).
  - A shot that hits nothing is a miss and resets the consecutive hit counter to 0. A target leaving the screen does not reset it.
  - A hit target plays a 0.4 s falling animation and can no longer be hit.
  - The game ends when the time reaches 0. Score is the points total.
- Spanish UI strings: HUD labels `Tiempo`, `Munición`.
- `CLAUDE.md` update: the `games` table (row `gallery`) and the "Five games" sentence.

**Out of scope (for future specs):**

- Decoys, time targets, armored and golden targets (`JAM-gallery-02`).
- Sound and music.
- Touch controls, gamepad, multiplayer.
- Weapon variety, scope zoom, recoil.
- Neon recolor of the in-canvas world.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'gallery'`). The theoretical maximum of a 45 s game is under 5,000 points, far below 10,000,000.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'gallery',
  'SHOOTING GALLERY',
  'Acierta las dianas antes de que se acabe el tiempo.',
  'Apunta con el ratón y dispara a las dianas que cruzan las tres filas. Cuanto más pequeña y rápida es la diana, más vale; los aciertos seguidos multiplican tus puntos hasta x4. Fallar rompe la racha. Tienes 45 segundos.',
  'SHOOTER',
  'cover-gallery',
  'magenta',
  8
);
```

`color` must be one of `cyan`, `magenta`, `green`, `yellow`. Today: `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green. `magenta` is the planner's pick. `sort_order` 8 is the next free value at this moment (1 to 5 taken, 6 held by the draft `scramble`, 7 by the jam game `hoops`, 9 by `invaders`). The timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "time", label: "Tiempo", format: "number", initial: 45 },
  { key: "ammo", label: "Munición", format: "number", initial: 8 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { time, ammo } }
```

```ts
// lib/games/gallery/constants.ts
const W = 640, H = 480;
const TIME_START = 45, CLIP = 8, RELOAD_S = 1.2;
const ROWS = [
  { y: 150, r: 30, speed: 90, dir: 1, base: 10 },
  { y: 260, r: 24, speed: 150, dir: -1, base: 20 },
  { y: 370, r: 18, speed: 230, dir: 1, base: 40 },
];
const SPAWN_MIN = 0.7, SPAWN_MAX = 1.5, MAX_PER_ROW = 4;
const RING = { bull: 0.25, inner: 0.6 }, RING_MULT = { bull: 3, inner: 2, outer: 1 };
const COMBO_STEP = 3, COMBO_MAX = 4, FALL_S = 0.4;
```

Conventions:

- Logic canvas is 640×480, origin top-left, units in pixels and seconds. Target positions use `x` for the center; the rail `y` is fixed.
- HUD `time` is `ceil(secondsLeft)`. HUD `ammo` is the rounds in the clip and shows 0 during reload.
- State is `playing` until the time ends, then `gameover` directly. `dead` is unused.
- The first targets spawn immediately at start (one per row at `t = 0`) so the player never waits for the first target.

## Implementation plan

1. Create `lib/games/gallery/constants.ts` with the constants above. Manual check: `npm run lint` passes.
2. Create `lib/games/gallery/engine.ts`, first part: closure state (targets, clip, reload timer, time, score, hit counter), spawn timers per row, `update(dt)` (move, remove, countdown), `shoot(x, y)` (hit test, ring, combo, miss), and the snapshot with `onChange` / `onGameOver`. Manual check: `npx tsc --noEmit` passes.
3. Extend `engine.ts`: input (`mousedown` on the canvas with `getBoundingClientRect` conversion, `mousemove` for the crosshair, `R`, `contextmenu` prevented on the canvas, cursor `none`), input cleared on pause, blur and stop. Manual check: lint and tsc pass.
4. Extend `engine.ts`: draw (backdrop, rails, discs with rings, fall animation, muzzle flash, small crosshair of 10 px radius), rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`, skip idle redraws when paused. Manual check: lint and tsc pass.
5. Add the `registry.ts` entry. Manual check: `/juegos/gallery/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
6. Add `.cover-gallery` to `app/globals.css` with `/frontend-design` (project rule for any UI). Manual check: the class renders in a card preview with no layout change to other covers.
7. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `gallery` row; `/biblioteca` shows the card; `/juegos/gallery/jugar` plays.
8. Update `CLAUDE.md`.
9. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `gallery` with title `SHOOTING GALLERY`, the copy above, category `SHOOTER`, cover `cover-gallery`, color `magenta` and `sort_order` 8 (or the next free value at promotion).
- [ ] `/juegos/gallery/jugar` shows a 640×480 canvas; the game starts with score 0, HUD time 45, HUD ammo 8 and one target already on each of the 3 rails.
- [ ] The system cursor is hidden over the canvas and a crosshair of 10 px radius follows the pointer; leaving the page restores the normal cursor.
- [ ] Each left click with rounds left lowers HUD ammo by exactly 1.
- [ ] `R` with fewer than 8 rounds starts a 1.2 s reload and the clip returns to 8; an empty clip reloads on its own; clicks during reload change neither ammo nor score nor the hit counter.
- [ ] Rows move at 90 (right), 150 (left) and 230 (right) px/s, with radii 30, 24 and 18.
- [ ] No row ever holds more than 4 targets.
- [ ] A first hit on row 0 (outer ring) adds exactly 10; on row 1 adds 20; on row 2 adds 40.
- [ ] A hit within `0.25 × R` of the center multiplies the points by 3; within `0.6 × R`, by 2.
- [ ] Hits 1 to 3 in a row use combo ×1, hits 4 to 6 use ×2, hits 7 to 9 use ×3, hit 10 and later use ×4.
- [ ] A click on empty space resets the consecutive hit counter to 0; a target leaving the screen does not.
- [ ] A hit target cannot be hit again during its 0.4 s fall.
- [ ] HUD time counts down from 45 and the game-over modal opens when it reaches 0, once, with the current score.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'gallery'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=gallery`, on `/juegos/gallery` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/gallery` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the targets and the timer, and clicks while paused do not fire; pressing again resumes with no jump.
- [ ] While the game is mounted, `Space` does not scroll the page and right click on the canvas shows no context menu; typing in an `INPUT` is not blocked.
- [ ] With the canvas scaled by CSS, a click on the visual center of a target hits it (check at 375 px width and at 1280 px width).
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, targets, clip and score; no duplicate loops run (row 0 speed stays 90 px/s after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/gallery/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch, hitscan fairground gallery. **No:** copying any existing light-gun game's targets, characters or look.
- **Yes:** `id` `gallery`, from the planner entry. Title `SHOOTING GALLERY`.
- **Yes:** three rails with different size, speed and value so risk and reward differ per row. **No:** one uniform row: no decisions for the player.
- **Yes:** consecutive-hit combo up to ×4 and bullseye rings. They answer the "low depth" risk with a precision-and-consistency score. **No:** a flat points-per-hit.
- **Yes:** limited clip (8) with a 1.2 s reload: shooting is a trade-off between spam and accuracy. **No:** unlimited ammo.
- **Yes:** mouse only for aim and fire, `R` as the only key. **No:** keyboard aiming, touch, gamepad: out of scope.
- **Yes:** crosshair drawn in the canvas and the system cursor hidden over it. **No:** the system cursor: it hides the "tiny scope" feeling and is bigger than the hit area.
- **Yes:** 45 s sessions. Fast, replayable. **No:** longer rounds.
- **Yes:** HUD fields `time` (`number`, 45) and `ammo` (`number`, 8), as the brief says. **No:** `hearts` or `pad2`.
- **Yes:** new cover `.cover-gallery` with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`.
- **Yes:** color `magenta`, the planner's pick. **No:** picking by catalog count.
- **Yes:** `sort_order` 8 (next free value, re-checked on promotion).
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Low depth and replay value (the suggestion's own risk)                    | Combo, rings, three row values and clip management in the core; target variety in `JAM-gallery-02`.        |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size; criterion checks two viewport widths.            |
| Hidden cursor leaks to other pages                                        | Restore `canvas.style.cursor` in `stop`; criterion checks it.                                             |
| A click that resumes from pause also fires a shot                         | Ignore `mousedown` while paused and in the first frame after resume.                                       |
| Right click opens the browser menu in the middle of a run                 | Prevent `contextmenu` on the canvas only.                                                                 |
| `mousedown` listener attached to `window` would shoot when clicking the shell buttons | Attach the listener to the canvas, not to `window`.                                            |
| Input stuck after pause or blur                                           | Clear the reload key state on `setPaused`, on `window` blur and on `stop`.                                |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                          |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                    |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for GALLERY (no touch controls); fixing it needs its own change.              |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.    |

## What is **not** in this spec

- Decoys, time targets, armored and golden targets.
- Sound and music.
- Touch controls, gamepad and multiplayer.
- Weapon variety, scope zoom and recoil.
- Neon recolor.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
