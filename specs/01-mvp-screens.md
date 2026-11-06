# SPEC 01 — MVP screens (visual only)

> **Status:** Implemented
> **Depends on:** none (styles already ported to `app/globals.css` in PR #1 `01-styles`)
> **Date:** 2026-10-27
> **Objective:** Implement the five Arcade Vault screens from `references/templates` (library, game detail, game player, auth, hall of fame) as Next.js App Router routes with mock data and no real game logic.

## Scope

**In:**

- Five routes: `/` (library), `/juegos/[id]` (detail), `/juegos/[id]/jugar` (player), `/acceso` (auth), `/salon` (hall of fame).
- Shared shell: top nav (desktop links, credits counter, auth button, mobile hamburger + side panel) and footer, rendered from `app/layout.tsx`.
- Mock data ported from `data.jsx`: 8 games, categories, `seededScores` generator.
- Mock session: any username logs in, stored in `localStorage` key `av_user`; "play as guest" clears it.
- Library: search by title + category chips + empty state + tilt-on-hover game card.
- Detail: cover, tags, stats strip, "JUGAR AHORA", top-10 leaderboard.
- Hall of fame: game tabs, podium (top 3), 12-row table, "your best mark" row when logged in.
- Player: HUD (player, score, lives, level), pause/resume, end, exit, CRT frame with decorative arena, simulated score ticking, game-over modal with "save score" (writes to `localStorage` key `av_scores`).
- UI copy stays in Spanish as in the templates.
- Reuse the existing classes in `app/globals.css` (`av-*`, `btn`, `chip`, `crt`, `modal`, `cover-*`, etc.); add Tailwind utilities only where a template used inline styles.
- `generateStaticParams` for `[id]` from the games list; unknown id → `notFound()`.

**Out of scope (for future specs):**

- Any real game (Bloque Buster, Caída, etc.). The player only simulates.
- Real authentication, OAuth (Google/GitHub buttons are inert), backend, database.
- Real leaderboards: reading back `av_scores` into rankings.
- Credits/coins system (counter is static "03").
- Sound, gamepad/keyboard controls, i18n, tests.

## Data model

```ts
// lib/data.ts
export type GameColor = "cyan" | "magenta" | "green" | "yellow";
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;          // "bloque-buster" ... "duelo-pixel"
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;       // CSS class "cover-bricks" etc., already in globals.css
  color: GameColor;
  best: number;
  plays: string;       // "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"

export const GAMES: Game[];
export const CATS: ["TODOS", ...Category[]];
export function seededScores(seed: number, count?: number): ScoreRow[]; // deterministic

// lib/session.tsx (client)
export type User = { name: string };            // uppercase, max 10 chars
// localStorage "av_user":   User | absent
// localStorage "av_scores": { game: string; score: number; name: string; at: number }[]
```

Conventions:

- Numbers formatted with `toLocaleString("es-ES")`.
- All `localStorage` access in try/catch and inside effects (never during SSR render).

## Implementation plan

1. Create `lib/data.ts` with types, `GAMES`, `CATS`, `seededScores` (port of `data.jsx`). Manual check: import compiles, `npm run lint` passes.
2. Create `lib/session.tsx` (`"use client"` `SessionProvider` + `useSession()` with `user`, `login`, `signOut`, `saveScore`). Not yet wired.
3. Create `components/nav.tsx` (client: `usePathname` for active link, mobile panel state) and `components/footer.tsx`. Wire both plus `SessionProvider` into `app/layout.tsx`, set `lang="es"`, wrap children in `<main className="av-main">`. Manual check: shell shows on the scaffold page, hamburger opens/closes.
4. Replace `app/page.tsx` with the library: `components/game-card.tsx` (client, tilt) and `components/library.tsx` (client, search + chips + empty state). Manual check: filter by text and category, empty state appears.
5. Create `app/juegos/[id]/page.tsx` (detail, server component, `generateStaticParams`, `notFound`). Manual check: card click → detail; bad id → 404.
6. Create `app/salon/page.tsx` + `components/hall-of-fame.tsx` (client: tabs, podium, table, "you" row from session). Manual check: switching tabs changes rows; logged-in shows "you" row.
7. Create `app/acceso/page.tsx` + `components/auth-form.tsx` (client: login/signup tabs, submit → `login` → `router.push("/")`, guest button). Manual check: login shows username in nav; sign-out works.
8. Create `app/juegos/[id]/jugar/page.tsx` + `components/game-player.tsx` (client: HUD, CRT, pause, end, modal, save score). Manual check: score ticks, pause stops it, end opens modal, save writes `av_scores`.
9. Remove unused scaffold assets (`public/*.svg` not referenced) and run `npm run lint` + `npm run build`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] `/`, `/salon`, `/acceso`, `/juegos/caida`, `/juegos/caida/jugar` all render without console errors.
- [x] `/juegos/no-existe` and `/juegos/no-existe/jugar` return the 404 page.
- [x] Library shows 8 game cards; typing "caí" leaves only CAÍDA; chip PUZZLE leaves only CAÍDA; a query with no match shows "NO HAY RESULTADOS".
- [x] Clicking a card or its JUGAR button navigates to `/juegos/[id]`.
- [x] Detail shows title, 4 tags, plays, global best, and exactly 10 leaderboard rows sorted by score descending.
- [x] "JUGAR AHORA" goes to `/juegos/[id]/jugar`; "VOLVER AL VAULT" goes to `/`.
- [x] Hall of fame shows 8 game tabs, 3 podium slots, 12 table rows; selecting another tab changes rows deterministically (same tab → same rows on reload).
- [x] Logged-out hall of fame has no "TU MEJOR MARCA" row; logged-in has it with the user's name.
- [x] Submitting `/acceso` with username "px_kai" redirects to `/` and the nav button shows `PX_KAI`; reloading keeps it.
- [x] Clicking the user button signs out and the nav shows "Iniciar Sesión" again.
- [x] "JUGAR COMO INVITADO" redirects to `/` with no user stored.
- [x] Player score increases while running, stops on PAUSA (overlay "EN PAUSA"), resumes on REANUDAR.
- [x] FIN opens the modal with the final score; GUARDAR PUNTUACIÓN appends one entry to `localStorage.av_scores` and shows "PUNTUACIÓN GUARDADA_"; JUGAR DE NUEVO resets score to 0.
- [x] SALIR in the player goes to `/juegos/[id]`.
- [x] At viewport width ≤ 768px the hamburger shows the side panel with Biblioteca, Salón de la Fama, and the auth link; backdrop click closes it.
- [x] Active nav link is highlighted on `/`, `/juegos/*` (Biblioteca) and `/salon`.
- [x] With `localStorage` blocked, all pages still render (no crash).

## Decisions

- **Yes:** real App Router routes (`/juegos/[id]`, `/acceso`, `/salon`). URLs are shareable and fit Next; the template's hash routing is a prototype artifact.
- **No:** single-route state machine. Fidelity to the prototype isn't worth fighting the framework.
- **Yes:** reuse the classes already in `app/globals.css`. The 01-styles PR ported them; rewriting as Tailwind utilities would duplicate 970 lines for no visual gain.
- **Yes:** mock session in `localStorage` (`av_user`, `av_scores`) as in the template. Zero backend, enough to demo nav/hall states.
- **No:** real auth or OAuth. Own spec when a backend exists.
- **Yes:** simulated player (timer-driven score). Gives the HUD/modal a real flow to design against; the real games plug in later.
- **Yes:** server components for detail/pages, client components only for interactive parts (nav, library, hall, auth, player, card tilt). Keeps compatibility with `cacheComponents`.
- **Yes:** UI copy in Spanish (taken from templates); code, identifiers, and this spec in English.
- **Yes:** `lib/` and `components/` at repo root, imported through the `@/*` alias.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Hydration mismatch from reading `localStorage` during render | Read session in `useEffect` inside `SessionProvider`; render logged-out state first. |
| `cacheComponents` / `partialPrefetching` behave differently from classic Next | Read the relevant guides in `node_modules/next/dist/docs/` before writing routes; keep dynamic access (`params`) per those docs. |
| `Math.random` in the player score causes server/client mismatch | Start the timer only in `useEffect`; initial score is `0`. |
| Template JSX uses globals (`window.GAMES`) | Port to ES module imports; no `window` globals. |

## What is **not** in this spec

- Any actual game logic or game assets.
- Real authentication, backend, or persistent global rankings.
- Credits/coins mechanics, sound, controller input.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
