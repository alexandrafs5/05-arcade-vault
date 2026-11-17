# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online games platform where players compete for the highest score. The UI copy and the README are in Spanish; code, comments, specs and commits are in English. Five games are playable today (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`), each with a real leaderboard in Supabase. Auth is still mock.

The project follows Spec Driven Design: every feature starts as a spec in `specs/NN-<slug>.md` (01–12 so far, all `Implemented`) and is then implemented step by step.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- No test runner configured. Verify changes in the browser (Playwright MCP is available).

## Workflow and skills

- `/spec` writes a spec (questions first, then the file, status `Draft`); `/spec-impl NN-<slug>` implements it on a `spec-NN-<slug>` branch, one commit per plan step, merged through a pull request. `specs/.spec-config.yml` sets `AutoCreateBranch: true` (branch is created without asking). Both skills come from `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).
- `/new-game` (project skill, `.claude/skills/new-game/`, user-invoked only) is `/spec` specialised for adding a playable game: it ports a folder from `references/started-games/` or designs a game from scratch, and saves `specs/NN-<id>-game.md`. It never writes code; run `/spec-impl` afterwards.
- `/spec-impl-game NN-<id>-game` (project skill, `.claude/skills/spec-impl-game/`, user-invoked only) wraps `/spec-impl` for a game spec: it reads and follows the `/spec-impl` skill, and once the spec is `Implemented` and committed it runs `@skin-designer <id>` and then `@mobile-porter <id>` (sequentially, never in parallel), merging `skins-<id>` and `mobile-<id>` locally into the spec branch (`--no-ff`). It never pushes or opens a PR.
- `@game-planner` (project subagent, `.claude/agents/game-planner.md`) decides which game fits the platform next. It records every suggestion and its status in `references/game-suggestions-todo.md` (read first, updated on every run) and keeps durable user preferences in `.claude/agent-memory/game-planner/`. It never writes specs or code; run `/new-game <id>` with its top pick.
- `@game-jam` (project subagent, `.claude/agents/game-jam.md`) takes a theme and designs three original games. For each it writes at least two Draft specs (core + feature) into `specs/game-jam/<game-id>/`, in the style of SPEC 07–09, and lists its assumptions in the answer. It never writes code. To build one: review it, copy it to `specs/NN-<id>-game.md` (next free number, re-check migration timestamp and `sort_order`), then run `/spec-impl`.
- `@skin-designer` (project subagent, `.claude/agents/skin-designer.md`) gives ONE game the skins `classic` (default), `neon` and `retro`: it writes the code directly (no spec), verifies it with Playwright, commits on a `skins-<id>` branch (no push, no PR) and records the game in `references/game-with-themes.md`, which it owns. Run it as `@skin-designer <game-id>`; it never skins more than one game per run.
- `@mobile-porter` (project subagent, `.claude/agents/mobile-porter.md`) brings ONE game to the SPEC 10 mobile standard (touch pad mapping in the registry, touch layout check): it writes the code directly (no spec), verifies desktop and touch emulation with Playwright, commits on a `mobile-<id>` branch (no push, no PR) and records the game in `references/game-mobile-ready.md`, which it owns. Run it as `@mobile-porter <game-id>`; it never ports more than one game per run and never edits the shell or `globals.css`.
- Always use `/frontend-design` to design user interface.
- `/worktree` creates an isolated git worktree in `.trees/<name>` for parallel work.
- MCP: `supabase` (project-scoped in `.mcp.json`; use it for migrations, SQL and type generation) and `playwright` (browser checks; its logs in `.playwright-mcp/` are gitignored).

## Layout

- `app/` — routes (Spanish slugs): `/` (home landing), `/biblioteca` (game catalog), `/juegos/[id]` (game detail + leaderboard), `/juegos/[id]/jugar` (player), `/salon` (hall of fame), `/acceso` (mock login), `/acerca` (about + contact form). All styles are in `app/globals.css` (`av-*` classes, `.cover-*` game covers, `.game-canvas`).
- `components/` — shared UI (`nav`, `footer`, `game-card`, `library`, `hall-of-fame`, `game-player`, `game-canvas`, `auth-form`, `contact-form`, ...).
- `lib/` — `queries.ts` (Supabase reads), `session.tsx` (mock user + `saveScore`), `format.ts` (display helpers), `data.ts` (static Spanish copy only: categories, features, FAQ), `games/` (engines + registry), `supabase/` (client factories + generated types).
- `supabase/migrations/` — schema and catalog rows. Never edit an applied migration; add a new file.
- `references/` — read-only source material, not part of the app: `templates/` (original HTML/JSX design), `started-games/` (vanilla JS games to port), `source-assets/`, `implemented-games.md`. Exceptions: `game-suggestions-todo.md` is owned and edited by `@game-planner`; `game-mobile-ready.md` by `@mobile-porter`.

## Stack / gotchas

- Next.js 16.4.6, React 19.3, Tailwind v4 (via `@tailwindcss/turbopack` loader rule in `next.config.ts`), TypeScript. App Router only (`app/`); path alias `@/*` → repo root.
- AGENTS.md warns this Next.js version has breaking changes vs. training data: read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, etc.) before writing Next code. The AGENTS.md block is regenerated by `next dev`; commit it instead of removing it.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback` and `experimental.agentUpgrade: "security"` — caching/prefetch behavior differs from classic Next; check the docs before using data fetching or caching APIs.
- Request-time data must sit inside `<Suspense>`. This includes `<Nav>` in `app/layout.tsx` (it reads `usePathname()`) and every Supabase read.
- Layouts use the globally generated `LayoutProps<"/">` type (no import needed) instead of hand-written props types.
- Fonts come from `next/font/google` in `app/layout.tsx`: Press Start 2P, JetBrains Mono, Courier Prime (CSS variables `--font-press-start`, `--font-jetbrains-mono`, `--font-courier-prime`).
- Contact email (SPEC 03): the `/acerca` form calls the Server Action `sendContactMessage` in `app/acerca/actions.ts`, which validates the fields, has a honeypot field (`website`), and sends through Resend. Env vars `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` are server-only. With the `onboarding@resend.dev` sender, the recipient must be the Resend account owner until a domain is verified.
- Supabase client factories: `createClient()` in `lib/supabase/client.ts` (browser, used only by `saveScore`) and `lib/supabase/server.ts` (async, cookie-aware; call inside a Server Action, Route Handler, or `<Suspense>` because `cookies()` is request-time). Both are typed with `Database` from `lib/supabase/database.types.ts` (regenerate with the Supabase MCP `generate_typescript_types` after schema changes). Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. All env var names are in `.env.example`; real values go in `.env.local`.
- Auth is still mock: `SessionProvider` in `lib/session.tsx` keeps `av_user` (`{ name }`) in `localStorage` and reads it after mount. No Supabase Auth and no `proxy.ts` yet.
- Data (SPEC 06): tables `games` (catalog, `id` is the URL slug) and `scores` (`game_id`, `name` 1–12 chars, `score` 0–10,000,000), plus view `game_stats` (`best`, `plays` per game). RLS: public read; anyone can insert scores; no update/delete. Server-side reads go through `lib/queries.ts` (`getGames`, `getGame`, `getTopScores`, `getRecentScores`, `getGameStats`, `getHomeStats`), always inside `<Suspense>`, no caching (fresh on every request). Scores are saved with `saveScore` in `lib/session.tsx` (async insert, throws on failure); `av_scores` no longer exists. Games, scores, and stats are never mock: do not add fake data, and never add a catalog row without a working engine.

## Games

| `games.id`  | Spec | `sort_order` | Canvas notes                                                 | HUD (besides player and score)   |
| ----------- | ---- | ------------ | ------------------------------------------------------------ | -------------------------------- |
| `asteroids` | 05   | 1            | vector drawing, keyboard                                     | lives (`hearts`), level (`pad2`) |
| `tetris`    | 07   | 2            | 450×600, "next piece" in a side strip                        | lines (`number`), level (`pad2`) |
| `arkanoid`  | 08   | 3            | spritesheet, keyboard + mouse, level data in `levels.ts`     | lives (`hearts`), level (`pad2`) |
| `snake`     | 09   | 4            | apple sprite (`fruits.png`), keyboard                        | length (`number`)                |
| `frogger`   | 12   | 5            | 640×560, primitives only, lane data in `levels.ts`, keyboard | lives (`hearts`), level (`pad2`) |

Game engine pattern (SPEC 05):

- A game lives in `lib/games/<id>/` (`engine.ts`, `constants.ts`, optional data files) as a framework-free engine exposing `createEngine(canvas, { onChange, onGameOver })` → `{ start, stop, setPaused, restart }`. State stays in the closure; `onChange` fires only on snapshot changes (not per frame).
- Shared types (`Engine`, `EngineSnapshot` = `{ score, state, hud }`, `GameDefinition`) live in `lib/games/types.ts`. Every playable game is registered in `lib/games/registry.ts` (`getGameDefinition(id)`, keyed by `games.id`) with its logic canvas size and HUD fields (`key`, Spanish `label`, `format` `number` / `hearts` / `pad2`, `initial`).
- `components/game-canvas.tsx` mounts any registered engine in `useEffect` and calls `stop()` on cleanup; `components/game-player.tsx` looks the game up in the registry and renders the HUD from `definition.hud`. The shell owns pause, game over, restart and score saving; there is no mock arena. A new game only adds files; it does not change the shell.
- Skins: `lib/games/skins.ts` defines `SkinId` (`classic` | `neon` | `retro`). `createEngine` takes an optional third argument `{ skin }` and the engine may expose `setSkin(skin)` (live swap, no restart; repaint one frame when paused). A game that implements skins keeps `PALETTES: Record<SkinId, Palette>` in its `constants.ts` and lists `skins: [...]` in its registry entry; only then does the player show the picker (`components/skin-picker.tsx`, one shared radio group, rendered twice: in the HUD, and in the pause overlay as `.pause-skins` for touch, SPEC 13). The choice is saved per game in `localStorage` key `av_skin_<id>`. Skin status per game is in `references/game-with-themes.md`.
- Extra canvases from a reference game (e.g. Tetris "next piece") are drawn inside the single game canvas. Tall canvases are limited by `max-height` in `.game-canvas`.
- Image assets live in `public/games/<id>/` and load inside `start()` (never at module level; ignore late `onload` after `stop()`).
- Engines that read the mouse convert pointer coordinates with `getBoundingClientRect` and the logic size.
- Touch controls (SPEC 10): `components/touch-controls.tsx` is an on-screen gamepad (fixed d-pad = arrow keys, plus buttons A and B) mounted by `game-player.tsx` under the CRT. It dispatches virtual `keydown`/`keyup` `KeyboardEvent`s (with both `code` and `key`) on `window`, so engines stay keyboard-only and need no touch code. A and B are per game through the optional `touch: { a?, b? }` field (`TouchAction` = `{ code, key, label }`) in the registry entry; a missing button is drawn dimmed and does nothing. Held keys are released on pause, game over, window `blur` and unmount. The pad uses the "Gamepad MK-II" look (SPEC 11; source in `references/gamepad-assets/`): a lit key gets `data-on`, driven by one `window` `keydown`/`keyup` listener, so it follows both fingers and the physical keyboard (only for codes the pad sends); style the lit state through `[data-on]`, not `:active`. The pad is always in the DOM and shown by CSS only under `@media (pointer: coarse)` (no JS detection, no hydration mismatch). On touch the player is a `100dvh` column: nav, footer, `.crt-bottom` and the skin picker are hidden and the canvas letterboxes above the pad. The HUD skin picker is hidden on touch (no room); players change skin from the pause overlay instead, where `.pause-skins` is shown only under `pointer: coarse` (CSS-only, no JS detection). Nav and footer are hidden through the `is-playing` class that `GamePlayer` puts on `<body>` while mounted; do not use `:has(.av-player)` for this, because `cacheComponents` keeps the previous page in the DOM, hidden, and the selector would keep matching after leaving the player.
- Phone testing on the LAN: set `DEV_ORIGINS` (comma-separated hosts, e.g. the PC's IP) in `.env.local` and restart `npm run dev`; it feeds `allowedDevOrigins` in `next.config.ts`. Unset means localhost only.
- Performance measurement (SPEC 14): `scripts/perf/frame-cost.js` is a Playwright snippet for the `playwright` MCP `browser_run_code_unsafe` tool (paste it inline). It measures the CPU time of one rAF callback plus a forced canvas flush, per game, skin and CPU throttle (1×, 4×), on a software canvas (`willReadFrequently`; a GPU canvas makes the per-frame `getImageData` a ~35 ms readback that wrongly punishes `drawImage`). Compare before/after in the same session against `main`: absolute numbers drift up to 2× between sessions. Target: avg < 8 ms at 4× (see SPEC 14 for what was reachable). `shadowBlur` is the main cost of the neon skins; neon Frogger bakes its glowing entities into `ImageBitmap` sprites (`bakeSprite` in `lib/games/frogger/engine.ts`).
- Dev gotcha: the dev server can serve a stale `app/globals.css` after an edit (OneDrive file watching). If a CSS change does not show up, edit the file again or restart `npm run dev`.
- No sound yet in any game.
- A new game needs its own engine, a registry entry, a `.cover-*` rule in `app/globals.css` (reuse an unused one or add one), its own `games` row (new migration), and its own spec: create it with `/new-game`, then implement with `/spec-impl`. Update the table above when it lands.
