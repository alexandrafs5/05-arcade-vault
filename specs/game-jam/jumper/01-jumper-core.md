# SPEC JAM-jumper-01 — Neon Jump game (NEON JUMP) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-18
> **Objective:** Add NEON JUMP as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/jumper/jugar`.

## Why this spec exists

There is no reference game folder. NEON JUMP is a vertical auto-bounce climber written from scratch: a glowing spark bounces by itself, the player only steers left and right, and the score is the height reached. The classic risk in this genre is a generator that creates a jump nobody can make. This spec solves it with a "spine": a chain of solid platforms built under hard distance limits derived from the physics, plus optional decoy platforms around it. Every run is reachable by construction.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the player name, score, HUD, pause, game-over modal and score saving. A new game only adds files; the shell is not changed. No asset is loaded (primitives only), so SPEC 08 is not a dependency.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-jumper-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table.

## Scope

**In:**

- Engine in `lib/games/jumper/` (`constants.ts`, `engine.ts`, `platforms.ts` for the generator) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on `ArrowLeft` and `ArrowRight` except while typing in an `INPUT` or `TEXTAREA`.
- Physics runs on a fixed step `PHYS_DT = 1 / 120` s over the capped `dt`.
- The canvas draws only the world: background, platforms, the spark. Score, height, pause menu and game-over overlay are not drawn; the shell shows them.
- Entry in `lib/games/registry.ts` with `id: "jumper"`, logic size 480×720, HUD field `height`.
- Migration `supabase/migrations/20261118060200_add_jumper_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file today (`20261118050845_revoke_rls_auto_enable_execute.sql`).
- New cover `.cover-jumper` in `app/globals.css`, designed with `/frontend-design` (project rule for any UI). Unused covers today are `.cover-glot`, `.cover-invaders` and `.cover-duelo`; none shows a tower of platforms, and `.cover-invaders` / `.cover-duelo` are reserved for pending suggestions.
- Rules:
  - Logic canvas 480×720, origin top-left, `y` grows downward. The world is taller than the canvas: a camera offset `camY` scrolls up as the player climbs.
  - The spark is a 34 × 34 px box. It bounces automatically: whenever it lands on a platform while falling, `vy = -JUMP_V` with `JUMP_V = 900` px/s. `GRAVITY = 2200` px/s². The bounce peaks at `JUMP_V² / (2 × GRAVITY) = 184` px.
  - Steering: `←` or `A` moves left, `→` or `D` moves right at `MOVE_SPEED = 360` px/s; both or none gives `vx = 0`. No inertia.
  - Wrap: the spark's center `x` wraps around the canvas (`x < 0` appears at `x + 480` and vice versa).
  - Start: a start platform 120 px wide, centered at `x = 240`, top at `y = 680`; the spark rests on it at the start and bounces at the first step. The camera starts with `camY = 0`.
  - Landing: a platform is landed on only when `vy > 0`, the feet were above the platform top in the previous step and are at or below it now, and the horizontal overlap is positive (`|spark.x − platform.x| < platform.w / 2 + 12`). The spark passes through platforms when moving up.
  - Camera: `camY = min(camY, spark.y − CAM_LINE)` with `CAM_LINE = 300`: it only moves up, never down.
  - Height and score: `riseMax` is the greatest `START_FEET_Y − feet.y` reached (`START_FEET_Y = 680`); `score = floor(riseMax / 10)` metres. The HUD `height` equals the score.
  - Death: the spark's top passes below the bottom of the camera view by 40 px (`spark.y − 17 > camY + 720 + 40`). Then `state = "gameover"` and `onGameOver(score)` fires once.
  - A run can never be won; it ends only by falling.
- Platform generation (the "spine" rule), in `platforms.ts`:
  - Platform size 72 × 14 px.
  - A **spine** platform is solid and always generated. Each new spine platform is placed above the previous one at a vertical gap `dy` uniform in `[SPINE_GAP_MIN, spineGapMax(score)]` with `SPINE_GAP_MIN = 60` and `spineGapMax(score) = min(150, 90 + 0.1 × score)` px (reaches 150 at 600 m), and at a horizontal offset `dx` uniform in `[−MAX_DX, +MAX_DX]` with `MAX_DX = 140` px, measured as the shortest wrapped distance between the two centers.
  - The caps come from the physics: 150 px is 82 % of the 184 px bounce, and 140 px is below what the spark can steer on the way down to a platform 150 px up (`360 px/s × 0.585 s = 210 px`). So every spine platform is reachable from the one below it.
  - **Decoy** platforms are extras: for each spine platform, with probability 50 % one decoy is added at a random `x` and a `y` between the previous and the current spine, not within 24 px vertically of any other platform (unless more than 80 px apart horizontally). A decoy is `normal` or, from `score ≥ 100`, `crumble` with probability 40 %. A `crumble` platform breaks 0.15 s after the spark lands on it (the bounce still happens) and disappears. Decoys are never required: the spine alone is always enough to climb.
  - Generation keeps platforms ready up to 1,440 px (two canvas heights) above the camera top; platforms more than 100 px below the camera bottom are discarded.
- Controls: `←` `→` and `A` `D`. No mouse. Touch, sound and gamepad are out of scope.
- Drawing (primitives only, cyan accent, no recolor per skin): near-black sky with three star layers at 20 %, 40 % and 60 % parallax; `normal` platforms as a cyan bar with a glow; `crumble` platforms as a dashed magenta bar that shakes for the 0.15 s before breaking; the spark as a cyan-white orb with a short trail that stretches while rising. Exact shapes are a detail for `/spec-impl`.
- `CLAUDE.md` update: add the `jumper` row to the Games table (spec number after promotion, `sort_order` 9, canvas notes, HUD height (`number`)).

**Out of scope (for future specs):**

- Springs, moving platforms, enemies (spec `JAM-jumper-02`).
- Jetpacks, shields and other power-ups.
- Mouse steering.
- Sound and music.
- Touch controls (done later by `@mobile-porter`), gamepad.
- Skins (done later by `@skin-designer`), bitmap sprites.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'jumper'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'jumper',
  'NEON JUMP',
  'Rebota hacia arriba sin caer.',
  'Una chispa rebota sin parar por una torre de plataformas de neón. Muévela a izquierda y derecha, cruza los bordes de la pantalla y sube todo lo que puedas. Si caes, se acaba.',
  'ARCADE',
  'cover-jumper',
  'cyan',
  9
);
```

`color` is one of `cyan`, `magenta`, `green`, `yellow`; `cyan` is the planner's pick (`arkanoid` also uses it). `sort_order` 9 is the next free value for the jam: the table holds 1–5, `scramble` (jam) reserves 6, `dragrush` 7 and `runner` 8. Both the timestamp and `sort_order` are re-checked when the spec is promoted.

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "height", label: "Altura", format: "number", initial: 0 },
],
// Snapshot sent by the engine
// { score, state: "playing" | "gameover", hud: { height } }
```

```ts
// lib/games/jumper/constants.ts
const W = 480, H = 720;
const PHYS_DT = 1 / 120;
const GRAVITY = 2200, JUMP_V = 900, MOVE_SPEED = 360;
const SPARK = 34;
const PLATFORM = { w: 72, h: 14 };
const START_PLATFORM = { w: 120, x: 240, y: 680 };
const CAM_LINE = 300;
const SPINE_GAP_MIN = 60, SPINE_GAP_CAP = 150, MAX_DX = 140;
const DECOY_CHANCE = 0.5, CRUMBLE_CHANCE = 0.4, CRUMBLE_FROM = 100, CRUMBLE_DELAY = 0.15;
const PX_PER_M = 10;
const GEN_AHEAD = 1440;
```

Conventions:

- Logic canvas is 480×720, units in pixels and seconds, `y` grows downward; world coordinates have `y` decreasing as the spark climbs. Platforms hold `{ x, y, w, kind: "normal" | "crumble", spine: boolean }`.
- The generator is a pure function of the last spine platform, the current score and a random source, in `platforms.ts`, so the reachability limits can be checked on their own.
- Tall canvas: the player's `max-height` handling in `.game-canvas` limits the displayed size; the shell is not changed.
- The state `dead` is unused.

## Implementation plan

1. Create `lib/games/jumper/constants.ts` with the constants above and the palette. Manual check: `npm run lint` passes.
2. Create `lib/games/jumper/platforms.ts`: spine generation with the gap and offset caps, decoys, crumble kind and discard. Manual check: `npx tsc --noEmit` passes; a temporary run of 10,000 spine steps at scores 0, 300 and 1,000 never gives `dy > 150`, `dy < 60` or wrapped `|dx| > 140` (remove the log after).
3. Create `lib/games/jumper/engine.ts`, first part: closure state (spark, platforms, camera, `riseMax`, score, state), fixed-step physics, landing rule, wrap, crumble timer, death and the snapshot with `onChange` / `onGameOver`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: key handling (`←` `→` `A` `D`), `preventDefault`, input cleared on pause, blur and stop. Manual check: lint and tsc pass.
5. Extend `engine.ts`: draw (sky, star layers, platforms, spark and trail), rAF loop with `dt` cap and accumulator, `start`, `stop`, `setPaused`, `restart`. Manual check: lint and tsc pass.
6. Add the `registry.ts` entry. Manual check: `/juegos/jumper/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
7. Add `.cover-jumper` to `app/globals.css`, designed with `/frontend-design`. Manual check: the class renders in a card preview with no layout change to other covers.
8. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `jumper` row; `/biblioteca` shows the card with the `.cover-jumper` art; `/juegos/jumper/jugar` plays; the height updates.
9. Update `CLAUDE.md`.
10. Run `npm run lint` and `npm run build`.

The cover is new UI: `/spec-impl` must use `/frontend-design` for it. The shell is unchanged.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `jumper` with title `NEON JUMP`, the copy above, category `ARCADE`, cover `cover-jumper`, color `cyan` and `sort_order` 9.
- [ ] `/juegos/jumper/jugar` shows a 480×720 canvas; the spark starts on a 120 px platform centered at `x = 240`, the HUD height is 0 and the score is 0.
- [ ] The spark bounces by itself on every landing; the bounce peaks at 184 px (±3 px) above the platform top.
- [ ] `←` / `A` move the spark left and `→` / `D` move it right at 360 px/s; with both pressed or none it does not move horizontally.
- [ ] Leaving the canvas on one side makes the spark appear on the other side with the same speed and height.
- [ ] The spark passes up through platforms and lands only while falling.
- [ ] Every spine platform is 60 to 150 px above the previous one and at most 140 px away horizontally (wrapped distance); at score 0 the maximum gap is 90 px and at score 600 or more it is 150 px.
- [ ] A run that only lands on spine platforms can climb 2,000 m without a single unreachable jump (checked by the step 2 generator run and a scripted run in the browser).
- [ ] A `crumble` platform never appears before score 100, and the spine never contains one; it breaks 0.15 s after the first landing and the bounce still happens.
- [ ] The camera never moves down; the score is `floor(riseMax / 10)`, so reaching 1,840 px above the start gives 184.
- [ ] Falling 40 px below the bottom of the view opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'jumper'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=jumper`, on `/juegos/jumper` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/jumper` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; pressing again resumes with no jump in position or speed.
- [ ] While the game is mounted, `←` and `→` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The height reached after the first 10 bounces is the same (±1 m) at 60 Hz and at 144 Hz.
- [ ] The canvas scales with the viewport (tall canvas, limited by `max-height`); at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets score, camera, platforms and spark; no duplicate loops run (bounce peak is still 184 px after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/jumper/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch as an auto-bounce climber with the spark and neon platforms. **No:** copying the look or characters of a known jumper.
- **Yes:** `id` `jumper`, English slug, title `NEON JUMP`.
- **Yes:** a solid "spine" with hard gap and offset caps guarantees reachability. **No:** pure random platforms with a "usually reachable" check: the brief's risk is exactly an impossible jump.
- **Yes:** spine gap capped at 150 px (82 % of the bounce) and offset at 140 px. **No:** gaps up to the full 184 px: a perfect-timing steer would be required.
- **Yes:** the gap cap grows with the score from 90 px to 150 px. **No:** the cap from the start: it would be hard at the beginning and not a ramp.
- **Yes:** crumble platforms only as decoys. **No:** crumble in the spine: a required platform would disappear.
- **Yes:** `A` / `D` alongside the arrows, no inertia. **No:** inertia or mouse: they add tuning; mouse is left for a later spec.
- **Yes:** the score is `floor(riseMax / 10)` metres, an integer, never decreasing. **No:** current height: falling back would lower the score.
- **Yes:** the camera never moves down. **No:** a free camera: it would let the player see below and break the death rule.
- **Yes:** fixed physics step 1/120 s. **No:** per-frame integration: bounce height would change with refresh rate.
- **Yes:** the HUD `height` equals the score, as the brief asks. **No:** a different HUD field: there is nothing else to show.
- **Yes:** a 480×720 tall canvas. **No:** a wide canvas: the climb needs vertical view.
- **Yes:** new cover `.cover-jumper` designed with `/frontend-design`. **No:** reusing `.cover-invaders` or `.cover-duelo`: they belong to pending games.
- **Yes:** color `cyan`, as requested in the brief.
- **Yes:** `sort_order` 9, re-checked on promotion (`scramble` reserves 6, `dragrush` 7, `runner` 8).
- **Yes:** primitives only, no assets. **No:** loading sprites: no SPEC 08 dependency.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| An unreachable jump (the brief's main risk)                               | Spine rule with caps of 150 px and 140 px derived from the physics; step 2 checks 10,000 steps at three scores.        |
| Decoys block the spine path or overlap it                                 | Decoys keep a 24 px vertical (or 80 px horizontal) distance from every other platform.                                |
| Bounce height changes with refresh rate                                   | Fixed 1/120 s physics step; criterion compares 60 Hz and 144 Hz.                                                      |
| The tall 480×720 canvas does not fit short screens                        | `.game-canvas` already limits height with `max-height`; check at 375 px and at 1280×720; flag if the shell needs CSS. |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks the bounce peak after restarts.   |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                      |
| Steering keys stuck after pause or blur                                   | Clear input on `setPaused`, on `window` blur and on `stop`.                                                           |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                                |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for NEON JUMP (no touch controls yet); fixing it needs its own change.                    |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.                |

## What is **not** in this spec

- Springs, moving platforms and enemies.
- Jetpacks, shields and other power-ups.
- Mouse steering.
- Sound and music.
- Touch controls and gamepad.
- Skins and bitmap sprites.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
