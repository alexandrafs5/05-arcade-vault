# SPEC JAM-invaders-01 — Hive Raid game (INVADERS) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-20
> **Objective:** Add HIVE RAID (`invaders`) as a real wave shooter with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/invaders/jugar`.

## Why this spec exists

The game comes from scratch: there is no reference folder in `references/started-games/`. `@game-planner` suggested a score-chase wave shooter (`invaders`, SHOOTER, effort M, unused `.cover-invaders` exists, keyboard only). The genre is classic (a marching formation, one cannon, rising waves), but the game is original: the title, the three alien designs, the colors, the wave rules and the scoring are written for this platform. No sprite, name, sound or level from any existing game is used. Aliens are drawn from small hand-authored bitmaps (no image file), so SPEC 08 is not a dependency.

SPEC 05 set the engine pattern and SPEC 06 put games and scores in Supabase. The engine is written directly into the `createEngine` contract: state lives in the closure, the canvas draws only the world, and the shell shows the HUD and the game-over modal.

This is a jam spec: it is not numbered yet. When it is promoted to `specs/NN-invaders-game.md`, the migration timestamp and the `sort_order` below are re-checked against `supabase/migrations/` and the live `games` table. Other jam drafts also claim `sort_order` values (`scramble` claims 6; its own timestamp `20261117000000` is older than the last migration and must be bumped when it is promoted).

## Scope

**In:**

- Engine in `lib/games/invaders/` (`constants.ts`, `entities.ts`, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the arrow keys and `Space` except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world: starfield, aliens, comet, cannon, bullets and a ground line. Score, lives, wave, pause menu and game-over overlay are not drawn; the shell shows them. A short wave banner is not drawn either.
- Entry in `lib/games/registry.ts` with `id: "invaders"`, logic size 560×640, HUD fields `lives` and `wave`.
- Migration `supabase/migrations/20261120000100_add_invaders_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`.
- Reuse the existing unused cover `.cover-invaders` (`app/globals.css`: blue gradient, green and magenta dots, cyan dot at the bottom). No new cover CSS.
- Original alien art: three alien types drawn from 8×6 bitmaps (two animation frames each) defined in `constants.ts` as `ALIEN_BITMAPS`, 4 px per bitmap cell (32×24 px per alien). No image asset.
- Rules:
  - Cannon: 36×16 px, top at `CANNON_Y = 584`, moves with `←` `→` or `A` `D` at 280 px/s, center clamped to 20..540. `Space` fires.
  - Player bullets: 4×14 px, 520 px/s upward, at most 2 on screen, 0.30 s cooldown between shots (holding `Space` auto-fires at that rate).
  - Formation: 8 columns × 5 rows = 40 aliens, pitch 52×38 px, alien size 32×24 px, left edge of column 0 at x = 82. Row 0 starts at `y = 90 + 20 × min(wave − 1, 5)`.
  - Formation moves in discrete steps: every `stepInterval` seconds it shifts 10 px horizontally; when any living alien would cross x < 16 or x + 32 > 544 it instead drops 20 px and reverses direction. `stepInterval = max(0.05, (0.04 + 0.016 × alive) × 0.9^(wave − 1))` seconds, where `alive` is the number of living aliens. Animation frame toggles on every step.
  - Alien fire: first shot 1.0 s after the wave starts, then every `max(0.35, 1.2 × 0.92^(wave − 1))` s. The shooter is the lowest living alien of a uniformly random column that has living aliens. Alien bullets: 4×12 px, speed `min(360, 200 + 15 × (wave − 1))` px/s, at most 3 on screen (4 from wave 5).
  - Comet (bonus ship): 40×16 px at `y = 56`, 110 px/s, crosses the full width, direction alternates per appearance. First spawn 20–30 s (uniform) after the wave starts, then 20–30 s after each despawn; it spawns only while the formation has 8 or more living aliens. Hit value is one of 50, 100, 150, 200 (uniform).
  - Hit rules: a player bullet that overlaps an alien removes both; one that overlaps the comet removes both. An alien bullet that overlaps the cannon costs 1 life.
  - Life lost: the cannon is invulnerable for 1.5 s (blinks) and cannot fire for 0.8 s; alien bullets on screen are cleared. Lives start at 3.
  - Game over (`state = "gameover"`, `onGameOver(score)` once): lives reach 0, or any living alien has `y + 24 ≥ 584` (the formation lands).
  - Wave clear: all 40 aliens destroyed. Bonus `100 × wave`, 1.5 s pause, then `wave + 1`: the formation resets to full, bullets and comet are cleared, lives are kept. Waves never end; there is no win state.
  - Scoring: row 0 (stinger) 30, rows 1–2 (moth) 20, rows 3–4 (drone) 10, comet 50/100/150/200, wave clear `100 × wave`. Integer, no multipliers.
- Drawing: background `#05060f`, 40 fixed stars, aliens in the project palette (stinger magenta, moth yellow, drone green, cannon and bullets cyan, alien bullets white-pink), ground line at `y = 612`. Use the literal values of `--magenta`, `--yellow`, `--green`, `--cyan` from `app/globals.css`. Neon glow with `shadowBlur` is allowed but must be switched off for the per-frame bullet loop if frame cost rises (see Risks).
- `CLAUDE.md` update: the `games` rows and the Games table.

**Out of scope (for future specs):**

- Destructible bunkers and elite aliens (JAM-invaders-02).
- Power-ups, weapon upgrades, boss waves.
- Sound and music.
- Touch controls, on-screen d-pad (the shell pad can be wired later by `@mobile-porter`), gamepad.
- Skins (`classic`, `neon`, `retro`), done later by `@skin-designer`.
- Extra lives from score, two-player, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables and no new `localStorage` keys. Scores reuse `saveScore` and the `scores` table (`game_id = 'invaders'`).

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values (
  'invaders',
  'HIVE RAID',
  'Frena a la colmena antes de que aterrice.',
  'Una colmena alienígena desciende por oleadas. Mueve tu cañón, dispara y destruye cada nave antes de que toque el suelo. Cada oleada es más rápida; consigue la mayor puntuación.',
  'SHOOTER',
  'cover-invaders',
  'cyan',
  7
);
```

`sort_order` 7 is the next free value at 2026-11-20: `asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4, `frogger` 5, and 6 is claimed by the `scramble` jam draft. Color `cyan` matches the cannon dot of `.cover-invaders`; it is a re-checkable choice (today `asteroids` yellow, `tetris` magenta, `arkanoid` cyan, `snake` green, `frogger` green). Both values are re-checked on promotion.

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
const CANNON = { w: 36, h: 16, y: 584, speed: 280, minX: 20, maxX: 540 };
const PLAYER_BULLET = { w: 4, h: 14, speed: 520, max: 2, cooldown: 0.3 };
const FORMATION = { cols: 8, rows: 5, pitchX: 52, pitchY: 38, startX: 82, startY: 90, stepDx: 10, drop: 20 };
const ROW_POINTS = [30, 20, 20, 10, 10]; // row 0 = stinger, 1-2 = moth, 3-4 = drone
const COMET_POINTS = [50, 100, 150, 200];
// ALIEN_BITMAPS[type][frame] = 6 strings of 8 chars ("#" filled, "." empty), hand-authored:
// stinger A: "...##..." "..####.." ".######." "########" "..#..#.." ".#....#."
// moth A:    "#......#" "##.##.##" "########" ".######." "..#..#.." ".##..##."
// drone A:   ".#....#." "..#..#.." ".######." "##.##.##" "########" "..#..#.."
// frame B of each type swaps the legs/wings row pattern (see step 1)
```

Conventions:

- Logic canvas is 560×640, units in pixels, origin top-left. Entities store `x, y` as the top-left corner. Speeds are px/s multiplied by the capped `dt`.
- The formation is a 5×8 grid of `{ alive }` slots plus an `offsetX`, `offsetY` and `dir`; an alien position is derived from its slot and the offsets. Formation steps use an accumulator on `dt` and run at most one step per frame.
- State `dead` is unused: a lost life keeps `state = "playing"` (HUD `lives` changes); the game goes from `playing` to `gameover` directly.
- Randomness uses `Math.random()`; there is no seed.

## Implementation plan

1. Create `lib/games/invaders/constants.ts` with the constants above, all three bitmap pairs (frame B of each type changes only rows 5 and 6 of frame A; the author draws them, they must differ from frame A and must not copy any existing game's sprites) and the palette. Manual check: `npm run lint` passes.
2. Create `lib/games/invaders/entities.ts` with the types (`Alien`, `Bullet`, `Comet`) and pure helpers: `formationStepInterval(alive, wave)`, `alienFireInterval(wave)`, `alienBulletSpeed(wave)`, `rectsOverlap`. Manual check: `npx tsc --noEmit` passes.
3. Create `lib/games/invaders/engine.ts`, first part: closure state, `reset`, `startWave`, cannon movement, player shooting with cooldown and the 2-bullet cap, rAF loop with `dt` cap, `start`, `stop`, `setPaused`, `restart`, snapshot with `onChange`. Manual check: lint and tsc pass.
4. Extend `engine.ts`: formation stepping (edge, drop, reverse, frame toggle), alien hits and scoring. Manual check: lint and tsc pass.
5. Extend `engine.ts`: alien fire, cannon hit, life loss with invulnerability, landing check, game over once. Manual check: lint and tsc pass.
6. Extend `engine.ts`: comet spawn and scoring, wave clear bonus and next wave, key handling (`preventDefault`, input cleared on pause, blur and stop). Manual check: lint and tsc pass.
7. Extend `engine.ts`: drawing (stars, bitmaps, cannon blink, bullets, comet, ground line), skipping redraw while paused or game over. Manual check: lint and tsc pass.
8. Add the `registry.ts` entry. Manual check: `/juegos/invaders/jugar` is still the not-found page because the DB row does not exist yet; the five existing games still play.
9. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the `invaders` row; `/biblioteca` shows the card with the `.cover-invaders` art; `/juegos/invaders/jugar` plays.
10. Update `CLAUDE.md`.
11. Run `npm run lint` and `npm run build`.

No UI is designed or created in this spec (the cover is reused, the shell is unchanged), so `/frontend-design` is not required. If `/spec-impl` finds the cover needs rework or the 560×640 canvas needs shell CSS changes, it must use `/frontend-design` per the project `CLAUDE.md`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `invaders` with title `HIVE RAID`, the copy above, category `SHOOTER`, cover `cover-invaders`, color `cyan` and `sort_order` 7 (or the value re-checked on promotion).
- [ ] `/juegos/invaders/jugar` shows a 560×640 canvas; the game starts with 40 aliens in 5 rows × 8 columns, the cannon centered at x = 280, HUD lives 3 and wave 01, score 0.
- [ ] `←` `→` and `A` `D` move the cannon at 280 px/s and it never leaves center x 20..540.
- [ ] `Space` fires; no more than 2 player bullets exist at once; holding `Space` fires at most once every 0.30 s.
- [ ] The formation moves 10 px per step; at an edge it drops 20 px and reverses; with 40 aliens in wave 1 the step interval is 0.68 s and with 1 alien it is 0.056 s.
- [ ] Killing a row 0 alien adds 30, rows 1–2 add 20, rows 3–4 add 10 to the score.
- [ ] Aliens fire first at 1.0 s into wave 1, never more than 3 alien bullets are on screen in wave 1, and the shooter is always the lowest living alien of its column.
- [ ] The comet appears between 20 s and 30 s into a wave, flies at 110 px/s at y = 56, awards one of 50, 100, 150, 200 and does not spawn while fewer than 8 aliens live.
- [ ] An alien bullet hit removes 1 life (HUD hearts update), clears alien bullets, blocks firing for 0.8 s and gives 1.5 s of invulnerability.
- [ ] Losing the third life opens the game-over modal with the final score once.
- [ ] An alien reaching `y + 24 ≥ 584` opens the game-over modal once even with lives left.
- [ ] Clearing all 40 aliens adds `100 × wave` to the score, shows wave 02 after 1.5 s, resets the formation to 40 aliens at `startY` 110 and keeps the lives.
- [ ] From wave 2 the alien fire interval is 1.104 s and alien bullet speed 215 px/s.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = 'invaders'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=invaders`, on `/juegos/invaders` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/invaders` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] `/salon` and `/biblioteca` list `invaders` with the category SHOOTER filter.
- [ ] PAUSA, `P` and `Esc` freeze the canvas, formation and bullets; pressing again resumes with no jump (no extra formation step).
- [ ] While the game is mounted, the arrow keys and `Space` do not scroll the page; typing in an `INPUT` is not blocked.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets HUD, formation, lives, wave and score; no duplicate loops run (step interval stays 0.68 s with 40 aliens after 3 restarts).
- [ ] The three alien bitmaps in `constants.ts` are 8×6, differ in silhouette from each other and no asset file is loaded.
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar`, `/juegos/snake/jugar` and `/juegos/frogger/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/invaders/jugar` during a full session.

## Decisions

- **Yes:** write the game from scratch with a generic wave-shooter ruleset and original art, title `HIVE RAID`. **No:** reusing any existing game's name, sprites, sounds or level layouts, even renamed.
- **Yes:** `id` `invaders` (the planner's id, English slug, it becomes the URL). The `id` is generic; the title is the original one.
- **Yes:** aliens drawn from bitmaps in code. **No:** an image file: nothing to license, no SPEC 08 dependency, no loading state.
- **Yes:** discrete formation steps that speed up as aliens die. **No:** smooth movement: stepping gives readable rhythm and the classic tension of the genre.
- **Yes:** up to 2 player bullets with a 0.30 s cooldown. **No:** a single bullet (slows play), unlimited bullets (removes aim).
- **Yes:** infinite waves; the run ends only by losing. **No:** a win state: there is no natural end and the leaderboard wants the longest run.
- **Yes:** wave clear bonus `100 × wave` and a comet bonus. **No:** score multipliers: integers stay easy to verify and far below 10,000,000.
- **Yes:** 3 lives, hearts format, and instant game over when the formation lands. **No:** lives refill per wave: the pressure must grow.
- **Yes:** HUD fields `lives` (`hearts`) and `wave` (`pad2`), the same formats as `asteroids` and `frogger`. **No:** a new HUD format.
- **Yes:** reuse `.cover-invaders` (exists, unused, shows rows of aliens and a cyan cannon). **No:** a new cover.
- **Yes:** color `cyan`, SHOOTER category (`asteroids` is the only SHOOTER today, this adds a second). **No:** changing the category list.
- **Yes:** `sort_order` 7 (next free value, claim re-checked on promotion).
- **Yes:** keyboard only (arrows or `A` `D`, `Space`). **No:** mouse, touch, gamepad, sound and multiplayer: out of scope.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                                      | Mitigation                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Alien art looks too close to a famous game                                | Bitmaps are hand-authored here with different silhouettes and 3 colors; criterion checks they are 8×6 and distinct. |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks step interval after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                                  |
| `Space` or keys stuck after pause or blur                                 | Clear input on `setPaused`, on `window` blur and on `stop`.                                                       |
| Wave difficulty ramps too fast or too slow                                | All curves are formulas in `constants.ts` / `entities.ts`; tune there, criteria pin the wave 1 and wave 2 values.  |
| Formation edge logic skips or double-drops when columns die               | Edge test uses the living aliens only and one step per frame; a manual check kills the edge columns.              |
| `shadowBlur` glow costs frame time (see SPEC 14)                          | Glow only on aliens and cannon; no glow in the bullet loop; measure with `scripts/perf/frame-cost.js` if needed.   |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                            |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game (no touch controls yet); fixing it needs its own change.                |
| Migration timestamp or `sort_order` collides with another jam draft       | Both are re-checked against `supabase/migrations/` and the live `games` table when the spec is promoted.          |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.            |

## What is **not** in this spec

- Destructible bunkers and elite aliens.
- Power-ups, weapon upgrades, boss waves.
- Sound and music.
- Touch controls and gamepad.
- Skins.
- Extra lives from score, two-player, realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
