# SPEC 04 — Supabase integration (setup only)

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-09
> **Objective:** Connect the Next.js app to the existing Supabase project with the JS client (browser and server), environment variables, and a connectivity check, with no functional change to auth or data.

## Why this spec exists

Supabase will back auth, profiles, scores, and later Realtime and Edge Functions. Each of those is its own spec. This spec lays only the shared foundation so those specs can start from a working, verified connection. Auth and data persistence are deliberately not functional here.

## Scope

**In:**

- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Browser client factory: `lib/supabase/client.ts`.
- Server client factory: `lib/supabase/server.ts` (cookie-aware, for Server Components, Server Actions, and Route Handlers).
- Environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documented in `.env.example` and set in `.env.local`.
- A connectivity check that proves both clients reach the project (see Acceptance criteria).
- Short note in `CLAUDE.md` about the Supabase clients and env vars.

**Out of scope (for future specs):**

- Real authentication (email + password), sign up, login, logout. `/acceso` keeps the mock session from SPEC 01 (`av_user` in `localStorage`, guest flow).
- Proxy (`proxy.ts`) for session refresh. It belongs with the auth spec.
- Tables, migrations, RLS policies, profiles, scores, and replacing `av_scores` or the mock leaderboards.
- OAuth providers (Google, GitHub) and magic links.
- Realtime subscriptions and Edge Functions.
- Generated TypeScript database types (nothing to generate until tables exist).
- Tests.

## Data model

This feature introduces no new data structures and no database objects. It reuses the existing mock model from SPEC 01.

Environment variables (`.env.local` is never committed; `.env.example` lists names only):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Conventions:

- Only the publishable (anon-level) key is used. The secret/service-role key is never added to the app in this spec.
- `SUPABASE_DB_PASSWORD` already in `.env.local` is not read by app code.
- Client factories are functions (`createClient()`), not module-level singletons, so each request gets its own server client.

## Implementation plan

1. Install packages: `npm install @supabase/supabase-js @supabase/ssr`. Manual check: `npm run dev` still starts.
2. Add the two variables to `.env.example` (names only) and to `.env.local` (values from the Supabase dashboard or the MCP `get_project_url` / `get_publishable_keys` tools). Manual check: `.env.local` still ignored by git, `.env.example` tracked.
3. Create `lib/supabase/client.ts` exporting `createClient()` with `createBrowserClient`. Manual check: `npm run lint` passes.
4. Read the Next.js cookies and caching guides in `node_modules/next/dist/docs/`, then create `lib/supabase/server.ts` exporting async `createClient()` with `createServerClient` and the `cookies()` store. Manual check: `npm run lint` passes.
5. Add a temporary connectivity check (Route Handler or script) that calls `supabase.auth.getSession()` through the server client and a lightweight request through the browser client. Manual check: both return without error with an empty session. Remove the temporary check afterwards, or keep it only if it is harmless and documented.
6. Add a short "Supabase" note to `CLAUDE.md` (client locations, env var names, auth/data still mock).
7. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `package.json` lists `@supabase/supabase-js` and `@supabase/ssr`.
- [ ] `lib/supabase/client.ts` and `lib/supabase/server.ts` exist and each exports `createClient`.
- [ ] `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with no values and is tracked by git.
- [ ] `.env.local` is ignored by git and no Supabase key or URL value appears in committed files.
- [ ] The server client calls `auth.getSession()` against the project and returns no error (session is `null`).
- [ ] The browser client reaches the project from a client component with no error in the console.
- [ ] No secret or service-role key appears in the client bundle or in the repo.
- [ ] `/acceso` login, guest flow, nav user button, and `av_user` / `av_scores` behave exactly as in SPEC 01.
- [ ] All existing routes (`/`, `/salon`, `/acceso`, `/acerca`, `/juegos/caida`, `/juegos/caida/jugar`) render without console errors.
- [ ] The app still builds and runs if the two env vars are missing from a page that does not use Supabase (no import-time crash).

## Decisions

- **Yes:** `@supabase/ssr` with separate browser and server factories. It is the supported way to share auth cookies between client and server in the App Router.
- **No:** `@supabase/supabase-js` alone with a global client. Server code would not see the user session, and the auth spec would have to redo it.
- **Yes:** publishable key only. It is safe for the client and enough for the foundation; RLS protects data later.
- **No:** service-role key in the app. Not needed here and a leak risk; add it only to a server-only context if a future spec requires it.
- **Yes:** integration only, no functional auth. The user wants persistence and auth in later specs.
- **No:** replacing the mock session now. `/acceso` stays mock until the auth spec, so no behavior regresses.
- **No:** `proxy.ts` session refresh now. With no real auth there is no session to refresh, and Next.js 16 `cacheComponents` behavior should be checked in the auth spec.
- **Yes:** keep guest play and the mock `av_user` / `av_scores` keys for now. They are removed when auth and scores specs land.
- **No:** creating tables or migrations now. Schema decisions go with the specs that need the data.
- **Yes:** project already exists. This spec only connects to it; it does not create or configure it.
- **Yes:** code, identifiers, and this spec in English, per project convention.

## Risks

| Risk                                                                                           | Mitigation                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16 `cacheComponents` rejects `cookies()` access outside a dynamic or Suspense boundary | Read the Next.js docs before writing `server.ts`; the factory only calls `cookies()` when invoked, never at module level. |
| Missing env vars crash the build or unrelated pages                                            | Read env vars inside the factories only; fail with a clear error message when a factory is called without them.           |
| Publishable key confused with the secret key                                                   | Variable name is explicit (`..._PUBLISHABLE_KEY`); acceptance criteria check no secret key is added.                      |
| Supabase package APIs differ from training data                                                | Verify the current `@supabase/ssr` API in the installed package or Supabase docs (MCP `search_docs`) before coding.       |

## What is **not** in this spec

- Real sign up, login, logout, or any working auth flow.
- Database tables, migrations, RLS, profiles, or persisted scores.
- OAuth providers and magic links.
- Realtime and Edge Functions.
- Session-refresh proxy.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
