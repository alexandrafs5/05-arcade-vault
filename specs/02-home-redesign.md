# SPEC 02 — Home landing page and nav redesign

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-05
> **Objective:** Add the new Home landing page at `/`, move the library to `/biblioteca`, update the nav to Inicio / Biblioteca / Salón de la Fama / Acerca de, and ship `/acerca` as a "PRÓXIMAMENTE" placeholder, following `references/templates/home-about/` (minus the About content).

## Scope

**In:**

- New Home at `/` with the sections from `references/templates/home-about/home.jsx`: hero (floating silhouettes, title, 2 CTAs, scroll hint), "¿POR QUÉ ARCADE VAULT?" (4 feature cards), "JUEGOS DISPONIBLES AHORA" (6 mini cards), stats strip, "ACTIVIDAD EN VIVO" (ticker + top players), "PRECIOS" (price card + FAQ), final CTA.
- Scroll-reveal animation (`.reveal` → `.in` via `IntersectionObserver`).
- Library moves from `/` to `/biblioteca` (same component, no behavior change).
- Nav (desktop + mobile panel) gets four links: Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon`), Acerca de (`/acerca`).
- `/acerca` page: arcade-styled "PRÓXIMAMENTE" placeholder. No About content from `about.jsx`.
- Home CSS ported from `references/templates/home-about/styles.css` lines 930–1069 (`/* ===== HOME PAGE ===== */` through `.reveal.in`) into `app/globals.css`.
- Links updated for the new library route (see plan step 7).
- Static mock data for activity, top players, stats, features and FAQ in `lib/data.ts`.
- UI copy stays in Spanish, as in the template.

**Out of scope (for future specs):**

- The About page content (`about.jsx` and the `/* ===== ABOUT PAGE ===== */` CSS block).
- Real activity feed, real stats, or deriving anything from `av_scores` / `seededScores`.
- Hiding or changing Home CTAs based on session; they always go to `/acceso`.
- Real pricing, payments, or account plans.
- Any change to detail, player, hall of fame, or auth screens beyond link targets.
- Tests, i18n, SEO metadata per page.

## Data model

```ts
// lib/data.ts (additions)
export type NeonColor = "cyan" | "magenta" | "green" | "yellow";

export type Feature = { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: NeonColor };
export type RecentScore = { player: string; game: string; score: number; when: string; color: NeonColor };
export type TopPlayer = { rank: number; player: string; score: number };
export type HomeStat = { value: string; unit: string; sub: string };
export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[];       // 4 items, copied from home.jsx
export const RECENT_SCORES: RecentScore[]; // 7 items
export const TOP_PLAYERS: TopPlayer[];  // 5 items
export const HOME_STATS: HomeStat[];    // 3 items
export const FAQ: FaqItem[];            // 3 items
export const PRICE_FEATURES: string[];  // 6 bullet lines
```

Conventions:

- Values are copied verbatim from `home.jsx`; no new copy is invented.
- Scores formatted with `toLocaleString("es-ES")`.
- The mini-cards use `GAMES.slice(0, 6)` from SPEC 01. No new game data.
- No new `localStorage` keys.

## Implementation plan

1. Port the Home CSS block (template lines 930–1069) into `app/globals.css`, after the existing styles. Manual check: `npm run dev` still renders all current pages unchanged.
2. Add the new types and constants to `lib/data.ts`. Manual check: `npm run lint` passes.
3. Move the library: create `app/biblioteca/page.tsx` rendering `<Library />`. Manual check: `/biblioteca` shows the 8-card library.
4. Create `components/silhouettes.tsx` (8 decorative SVGs, server component) and `components/feature-icon.tsx` (4 pixel icons). Manual check: both compile and render when imported temporarily.
5. Create `components/reveal.tsx` (client wrapper: adds `.in` with `IntersectionObserver`, threshold `0.12`, unobserves after first hit; accepts `className`, `style`, `as`). Manual check: wrapped content fades in on scroll.
6. Create `components/mini-card.tsx` and replace `app/page.tsx` with the Home composed from the sections above. Manual check: `/` shows every section; CTAs and mini cards navigate.
7. Update links to the library:
   - `app/juegos/[id]/page.tsx` "VOLVER AL VAULT" → `/biblioteca`.
   - `components/game-player.tsx` "VOLVER AL VAULT" → `/biblioteca`.
   - `components/hall-of-fame.tsx` "VOLVER A LA BIBLIOTECA" → `/biblioteca`.
   - `components/auth-form.tsx` keeps `router.push("/")` (lands on Home).
   Manual check: each button lands where its label says.
8. Create `app/acerca/page.tsx`: "ACERCA DE" kicker, "PRÓXIMAMENTE" title with blinking `_`, one short line, a button back to `/`. Manual check: `/acerca` renders, no console errors.
9. Update `components/nav.tsx`: add Inicio and Acerca de, Biblioteca → `/biblioteca`, same changes in the mobile panel, active-state logic per the criteria below. Manual check: highlight is correct on every route; hamburger panel lists all four links.
10. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `/`, `/biblioteca`, `/acerca`, `/salon`, `/acceso`, `/juegos/caida`, `/juegos/caida/jugar` render without console errors.
- [ ] `/` shows, in order: hero, "¿POR QUÉ ARCADE VAULT?" (4 cards), "JUEGOS DISPONIBLES AHORA" (6 mini cards), stats strip (3 blocks), "ACTIVIDAD EN VIVO" (7 ticker rows, 5 top rows), "PRECIOS" (1 price card, 3 FAQ items), final CTA.
- [ ] Hero title reads "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA" on three lines and shows 8 floating silhouettes.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" and "INSERTAR MONEDA →" go to `/biblioteca`.
- [ ] "CREAR CUENTA" and "EMPEZAR GRATIS →" go to `/acceso`, with or without a session.
- [ ] "VER SALÓN →" goes to `/salon`.
- [ ] Clicking a mini card goes to `/juegos/[id]` for that game.
- [ ] Sections with `.reveal` start hidden and gain `.in` when scrolled into view.
- [ ] `/biblioteca` behaves like the old `/`: 8 cards, search "caí" leaves CAÍDA, chip PUZZLE leaves CAÍDA, no match shows "NO HAY RESULTADOS".
- [ ] `/acerca` shows "PRÓXIMAMENTE" and no other About content.
- [ ] Desktop nav shows Inicio, Biblioteca, Salón de la Fama, Acerca de, in that order; the mobile panel shows the same four plus the auth link.
- [ ] Active nav link: Inicio only on `/`; Biblioteca on `/biblioteca` and `/juegos/*`; Salón de la Fama on `/salon`; Acerca de on `/acerca`.
- [ ] "VOLVER AL VAULT" (detail and player) and "VOLVER A LA BIBLIOTECA" (hall of fame) go to `/biblioteca`.
- [ ] Submitting `/acceso` with "px_kai" redirects to `/` (Home) and the nav shows `PX_KAI`.
- [ ] At width ≤ 980px feature cards use 2 columns; at ≤ 520px, 1 column; mini-rail uses 3 columns at ≤ 1100px and 2 at ≤ 600px.
- [ ] With `localStorage` blocked, `/` still renders.

## Decisions

- **Yes:** `/` = Home, `/biblioteca` = library. Matches the template's nav (Inicio / Biblioteca) and makes the landing the site root.
- **No:** Home at `/home`, library stays at `/`. Less code churn, but the landing would not be the root URL.
- **Yes:** `/acerca` with a "PRÓXIMAMENTE" placeholder. Keeps the Spanish route convention (`/juegos`, `/acceso`, `/salon`) and exposes the nav item now.
- **No:** `/about`. Breaks the Spanish URL convention.
- **Yes:** static mock data in `lib/data.ts` for activity, top players and stats. Same approach as SPEC 01; no logic needed for a visual redesign.
- **No:** deriving activity from `av_scores` / `seededScores`. Adds client logic and empty states; belongs with a real leaderboard spec.
- **Yes:** CTAs always point to `/acceso`. Same as the template; avoids making Home depend on the session and hydration.
- **Yes:** post-login redirect stays `/`. Users land on Home, which links onward to the library.
- **Yes:** Home is a server component; only `Reveal` is a client component. Keeps compatibility with `cacheComponents`.
- **Yes:** reuse the template CSS classes verbatim in `app/globals.css`, same as SPEC 01.
- **Yes:** Home is built with `/frontend-design` guidance per `CLAUDE.md`, but the template is the visual source of truth; no redesign beyond it.
- **Yes:** the template's `navigate({ name })` calls become `next/link` links.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Moving the library breaks hardcoded links to `/` | Plan step 7 lists every known link; a grep for `href="/"` and `push("/")` is part of the manual checks. |
| `.reveal` hides content (opacity 0) if JS fails or the observer never fires | Add `@media (prefers-reduced-motion: reduce)` override that shows `.reveal` content, and `<noscript>` is not needed since the page is client-hydrated; verify the hero (not `.reveal`) is always visible. |
| Hydration mismatch from `IntersectionObserver` class changes | Add `.in` only in `useEffect`; server HTML always renders the hidden state. |
| `home-hero` uses `min-height: calc(100vh - 60px)`, which may not match the real nav height | Check visually at desktop and mobile widths; adjust the constant only if the hero overflows. |
| `cacheComponents` / `partialPrefetching` behave differently from classic Next | Read the relevant guides in `node_modules/next/dist/docs/` before writing routes; Home uses no dynamic APIs. |

## What is **not** in this spec

- The About page content.
- Real data for activity, rankings, or stats.
- Session-aware Home behavior.
- Pricing or payments.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
