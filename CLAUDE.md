# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online games platform where players compete for the highest score (README is in Spanish). Early stage — `app/` is still the Create Next App scaffold. README says the project follows Spec Driven Design (`/spec` and `/spec-impl` workflow) using skills from `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- No test runner configured.

## Skills

Always use /frontend-design to design user interface.

## Stack / gotchas

- Next.js 16.4.2, React 19.3, Tailwind v4 (via `@tailwindcss/turbopack` loader rule in `next.config.ts`), TypeScript. App Router only (`app/`); path alias `@/*` → repo root.
- AGENTS.md warns this Next.js version has breaking changes vs. training data: read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`, etc.) before writing Next code.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback` — caching/prefetch behavior differs from classic Next; check the docs before using data fetching or caching APIs.
- Supabase client factories: `createClient()` in `lib/supabase/client.ts` (browser, used only by `saveScore`) and `lib/supabase/server.ts` (async, cookie-aware; call inside a Server Action, Route Handler, or `<Suspense>` because `cookies()` is request-time). Both are typed with `Database` from `lib/supabase/database.types.ts` (regenerate with the Supabase MCP `generate_typescript_types` after schema changes). Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (names in `.env.example`). Auth is still mock (`av_user` in `localStorage`); no `proxy.ts` yet.
- Data (SPEC 06): tables `games` (catalog, `id` is the URL slug, only `rocas` today) and `scores` (`game_id`, `name` 1–12 chars, `score` 0–10,000,000), plus view `game_stats` (`best`, `plays` per game). RLS: public read; anyone can insert scores; no update/delete. Migrations live in `supabase/migrations/`. Server-side reads go through `lib/queries.ts` (`getGames`, `getGame`, `getTopScores`, `getRecentScores`, `getGameStats`, `getHomeStats`), always inside `<Suspense>`, no caching (fresh on every request). Display helpers are in `lib/format.ts`. Scores are saved with `saveScore` in `lib/session.tsx` (async insert, throws on failure); `av_scores` no longer exists. Games, scores, and stats are never mock: do not add fake data.
- Game engine pattern (SPEC 05): real games live in `lib/games/<name>/` as a framework-free engine exposing `createEngine(canvas, { onChange, onGameOver })` → `{ start, stop, setPaused, restart }`; state stays in the closure, `onChange` fires only on snapshot changes (not per frame). A client component (e.g. `components/asteroids-canvas.tsx`) mounts it in `useEffect` and calls `stop()` on cleanup. `components/game-player.tsx` renders only the ROCAS canvas (HUD score/lives/level come from the engine); there is no mock arena. A new game needs its own engine, its own `games` row, and its own spec.
- Layouts use the globally generated `LayoutProps<"/">` type (no import needed) instead of hand-written props types.
