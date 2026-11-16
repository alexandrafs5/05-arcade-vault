# Template for a game spec

Reference the `/new-game` skill consults in Phase 3. It follows the `/spec` template (`~/.agents/skills/spec/template.md`) section by section and adds the fixed contract every game shares. **It is not text to copy verbatim.** Replace every `<placeholder>` with real values from Phase 2. Model specs: `specs/05-asteroids-game.md` (engine port) and `specs/06-leaderboard-and-games-table.md` (games and scores in Supabase).

---

## Header

```markdown
# SPEC NN — <Title> game (<TITLE>) playable in the platform

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** YYYY-MM-DD
> **Objective:** Add <TITLE> as a real game with its own engine, catalog row and leaderboard, so players can play it and save scores from `/juegos/<id>/jugar`.
```

One sentence. If the source is a reference folder, name it in "Why this spec exists", not in the objective. Add other specs to `Depends on` if they changed the shared player (`components/game-player.tsx`, `lib/games/registry.ts`).

---

## Why this spec exists

Short. Say where the game comes from (`references/started-games/<folder>/` or from scratch) and what the port changes: DOM globals leave module scope, canvas HUD and overlays move to the React shell, state moves into the `createEngine` closure.

---

## Scope

**In** (keep these standard items, add the game-specific ones):

- Engine in `lib/games/<id>/` (`constants.ts`, `entities.ts` or equivalent, `engine.ts`) exporting `createEngine: CreateEngine` from `lib/games/types.ts`. No DOM globals at module level. All state in the `createEngine` closure.
- Engine behaviour: `dt` capped at 0.05 s; first frame after resume uses `dt = 0`; `onChange` fires only when `score`, `state` or a `hud` value changes; `onGameOver` fires once per game; window listeners attached in `start`, removed in `stop`; input cleared on pause, on `blur` and on `stop`; `preventDefault` on the game's scroll keys except while typing in an `INPUT` or `TEXTAREA`.
- The canvas draws only the world. HUD, score, lives, level, pause menu and game-over overlay are removed; the shell shows them.
- If the canvas is scaled by CSS and the game reads the mouse: convert pointer coordinates with `getBoundingClientRect` and the logic size.
- Entry in `lib/games/registry.ts`: `id`, `createEngine`, logic `width` and `height`, `hud` fields (`key`, Spanish `label`, `format`, `initial`).
- Migration `supabase/migrations/<YYYYMMDDHHMMSS>_add_<id>_game.sql` that inserts the `games` row, applied with the Supabase MCP `apply_migration`. The timestamp is later than the last file in `supabase/migrations/`. Types regenerated only if the schema changes (it does not for a plain insert).
- Cover CSS `.cover-<id>` in `app/globals.css` (or reuse an existing unused cover, stated here).
- Assets (if any) under `public/games/<id>/`, loaded inside the engine, never at module level.
- Scores through the existing `saveScore` (`lib/session.tsx`) into `scores`. Nothing new in the shell. The new game shows on `/salon?game=<id>`, `/juegos/<id>` (top 10), the home lists and the game card stats with no extra code.
- `CLAUDE.md` update: the `games` table row list, and the engine note if the pattern changed.
- Game-specific items from Phase 2 (rules, scoring, controls, levels).

**Out of scope (for future specs):** list everything deferred in Phase 2. Defaults when not chosen: touch or on-screen controls, gamepad, sound and music, neon recolor of the in-canvas world, realtime scores, auth-linked scores, automated tests, any other game.

---

## Data model

Always include the catalog row and the snapshot. Use real values.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('<id>', '<TITLE>', '<Spanish short>', '<Spanish long>', '<CAT>', 'cover-<id>', '<color>', <next unique sort_order>);
```

```ts
// HUD fields in lib/games/registry.ts
hud: [
  { key: "<key>", label: "<Etiqueta>", format: "number" | "hearts" | "pad2", initial: <n> },
],
// Snapshot sent by the engine
// { score, state: "playing" | "dead" | "gameover", hud: { <key>: <n> } }
```

Conventions to state: logic canvas size, coordinate origin, units (px/s or px/frame), constants that keep the original names and values, where frame-rate-dependent physics stays as in the original. No new tables, no new `localStorage` keys. Say so explicitly.

---

## Implementation plan

Numbered steps. Each leaves the app runnable and is committable alone. Skeleton to adapt (split any step that needs more than 30–50 lines):

1. Create `lib/games/<id>/constants.ts` (and `entities.ts` if the game has entities). Manual check: `npm run lint` passes.
2. Create `lib/games/<id>/engine.ts` with `createEngine`: input, update, draw, loop, snapshot, pause, restart. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
3. Add the `registry.ts` entry. Manual check: `/juegos/<id>/jugar` is still the not-found page because the DB row does not exist yet, and ASTEROIDS still plays.
4. Add the cover CSS and any assets. Use `/frontend-design` for the cover (project rule for any UI).
5. Apply the migration with `apply_migration` and save the SQL file. Manual check: `execute_sql` shows the new row; `/biblioteca` shows the card; `/juegos/<id>/jugar` plays.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

Add game-specific steps (levels, sprites, mouse) between 2 and 4.

---

## Acceptance criteria

Standard boolean items (adapt names and numbers, add game-specific rules with exact values):

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `games` has a row `<id>` with the agreed title, copy, category, cover, color and `sort_order`.
- [ ] `/juegos/<id>/jugar` shows a `<W>×<H>` canvas and the game starts with <initial state>.
- [ ] Controls: <each key or mouse action and its effect>.
- [ ] Scoring: <each event and the exact points it adds to the HUD score>.
- [ ] HUD fields <labels> come from the engine and update on change.
- [ ] Losing (or winning, if it ends the game) opens the game-over modal with the final score once.
- [ ] FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN inserts one row in `scores` with `game_id = '<id>'`, the typed name and the final score (check with `execute_sql`).
- [ ] The saved score shows on `/salon?game=<id>`, on `/juegos/<id>` (top 10), and in the home "recent" list after a reload.
- [ ] The card and `/juegos/<id>` show `best` and `plays` equal to `max(score)` and `count(*)` for the game.
- [ ] PAUSA, `P` and `Esc` freeze the canvas; pressing again resumes with no jump.
- [ ] While the game is mounted, its scroll keys do not scroll the page.
- [ ] The canvas scales with the viewport; at 375 px width it fits with no horizontal scroll.
- [ ] JUGAR DE NUEVO resets the HUD and the game; no duplicate loops run (speed stays constant after 3 restarts).
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar` still plays exactly as before.
- [ ] No console errors on `/juegos/<id>/jugar` during a full session.

---

## Decisions

Always record, with a reason: why this source (reference port or scratch), why this `id`, which original features were kept or dropped (sound, sprites, mouse, level select, theme toggle), win-state handling, HUD fields, cover choice. Always include the standing decisions:

- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row through a new migration file. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

---

## Risks

Include only what applies. Defaults for a game:

| Risk                                                                      | Mitigation                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| React 19 Strict Mode mounts effects twice in dev and starts two loops     | `GameCanvas` cleanup calls `engine.stop()`; state is per instance; criterion checks speed after restarts. |
| Canvas access during SSR or under `cacheComponents`                       | Engine is created only inside `useEffect` of a client component.                                          |
| Frame-rate-dependent physics (per-frame drag, per-frame speeds)           | Keep original behaviour for fidelity; note it in `constants.ts`; fix only if 120/144 Hz play differs.     |
| `keys` or `justPressed` stuck after pause or blur                         | Clear input on `setPaused`, on `window` blur and on `stop`.                                               |
| Game over fired twice (engine and FIN)                                    | The shell ignores `onGameOver` when the modal is open.                                                    |
| Assets (sprites, sounds) fail to load or load at module level             | Load inside the engine; keep files in `public/games/<id>/`; the game must start or fail visibly.          |
| Mouse coordinates wrong after CSS scaling                                 | Convert with `getBoundingClientRect` and the logic size.                                                  |
| `/juegos/[id]` tags (`TÁCTIL`, `RETRO 1985`) and difficulty are hardcoded | Flag it if a claim is false for this game; fixing it needs its own change.                                |
| Next.js 16 differs from training data                                     | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.    |

---

## What is **not** in this spec

Repeat the Out-of-scope list at the end, one bullet each, then:

Each one of those, if it lands, goes in its own spec.

---

## Global rules about the whole document

- One sentence per idea. Concrete names: file paths, exact strings, exact numbers.
- No TODOs. A TODO means the decision was not made: make it, or write it as a pending decision with a reason.
- No long executable code. Short snippets for data structures only.
- Standard markdown that renders on GitHub.
- Status `Draft` on creation. Never `Approved` automatically.
