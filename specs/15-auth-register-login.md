# SPEC 15 — Registration, login and authentication

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 04, SPEC 06
> **Date:** 2026-11-17
> **Objective:** Replace the mock login with real Supabase Auth (email + password and Google/GitHub, email confirmation on, password reset, unique usernames in a `profiles` table) on the existing `/acceso` screen, and tie logged-in scores to the account while guests keep playing.

## Why this spec exists

SPEC 01 shipped `/acceso` as a mock: `AuthForm` accepts anything and `SessionProvider` stores `{ name }` in `localStorage` (`av_user`). SPEC 04 added the Supabase client factories and left session refresh "to the auth spec". Scores (SPEC 06) are anonymous: anyone can insert any name. This spec makes accounts real without removing guest play.

The feature touches DB, session, UI and OAuth configuration, so it is deliberately limited to authentication and identity. Profile editing, avatars, personal stats and account deletion are separate specs.

## Scope

**In:**

- Supabase Auth with email + password. **Email confirmation ON**: after signup the user must open the link before they can log in.
- Google and GitHub OAuth through `signInWithOAuth` (the two buttons already in `AuthForm`).
- `/acceso` keeps its two tabs (`INICIAR SESIÓN` / `CREAR CUENTA`). Signup asks username + email + password. Login asks email + password. The "username" field of the mock login becomes the email field.
- Password reset: `/acceso/recuperar` (ask email, send link) and `/acceso/nueva-clave` (set a new password after the link).
- `/auth/callback` Route Handler: exchanges the `code` from email links and OAuth for a session, then redirects to `next` (default `/`). If the user has no profile yet, it redirects to `/acceso/usuario`.
- `/acceso/usuario`: "choose a username" step. Shown to any logged-in user without a profile (first OAuth login).
- `profiles` table (unique username) created by a DB trigger on signup (email flow) or by the `/acceso/usuario` form (OAuth flow).
- `scores.user_id` (nullable). Logged-in scores store `user_id` and the profile username as `name`. Guests keep inserting scores with `user_id` null and a typed name.
- `proxy.ts` that refreshes the Supabase session cookie on each request.
- `SessionProvider` reads the real session. `useSession()` exposes `{ user, signOut, saveScore }` (the `login` function is removed).
- Nav: the username button opens a small menu with `CERRAR SESIÓN`. The mobile panel gets the same action.
- `/acceso` redirects to `/` when the user is already logged in.
- `JUGAR COMO INVITADO` stays: goes to `/` without a session.
- In the player, a logged-in user's name is fixed to the username (input read-only). A guest keeps typing a name (default `INVITADO`).
- Cleanup of the stale `av_user` key in `localStorage`.
- `CLAUDE.md`: update the Auth and Data bullets.

**Out of scope (for future specs):**

- Profile page, change username, avatar, change email or password while logged in.
- Account deletion and GDPR export.
- Per-user stats, "my scores" and showing profile links on the leaderboard.
- Roles, admin area, moderation of usernames.
- Blocking guests from using a registered username (see Risks).
- More OAuth providers, magic links, MFA, rate limiting beyond Supabase defaults.
- Custom SMTP and branded email templates (default Supabase mail is used; see Risks).
- Automated tests.

## Data model

New migration `supabase/migrations/20261117000000_create_profiles_and_user_scores.sql` (never edit applied migrations):

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_key on public.profiles (lower(username));

alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null;
```

RLS (all tables keep RLS on):

- `profiles`: public `select`; `insert` only when `id = auth.uid()`; no update, no delete (editing is out of scope).
- `scores` insert policy replaced: `user_id is null` (guest, same limits as SPEC 06) **or** `user_id = auth.uid()` and `name` equals that user's `profiles.username`. Public read, no update/delete unchanged.

Trigger `handle_new_user` (`security definer`, `set search_path = ''`) on `auth.users` insert: if `raw_user_meta_data->>'username'` matches the username pattern, insert the `profiles` row; otherwise insert nothing (OAuth users).

Client types in `lib/session.tsx`:

```ts
export type User = { id: string; name: string }; // name = profiles.username
type SessionValue = {
  user: User | null;
  status: "loading" | "guest" | "needs-username" | "user";
  signOut: () => Promise<void>;
  saveScore: (entry: NewScore) => Promise<void>; // adds user_id when logged in
};
```

Conventions:

- Username: 3–12 characters, letters, digits and `_`; unique case-insensitively; stored as typed, shown uppercase in the HUD only where the UI already uppercases.
- Password: minimum 8 characters (Supabase setting, mirrored by client validation).
- Query param `next` only accepts paths starting with `/` and not `//` (open-redirect guard).
- Regenerate `lib/supabase/database.types.ts` after the migration.

Supabase dashboard setup (manual, documented in the final commit and `CLAUDE.md`, no secrets in the repo): enable Email provider with "Confirm email" ON, enable Google and GitHub providers with their client IDs/secrets, set Site URL and add `http://localhost:3000/auth/callback` plus the production callback to the Redirect URLs.

## Implementation plan

1. Migration: `profiles`, `scores.user_id`, new RLS, `handle_new_user` trigger. Apply with the Supabase MCP, regenerate types, run `get_advisors`. Check: the game still saves a guest score; an insert with `user_id` of another user is rejected.
2. `proxy.ts` (read `node_modules/next/dist/docs/` for the Next 16 proxy convention first) that refreshes the session through `@supabase/ssr`; update the stale comment in `lib/supabase/server.ts`. Check: `npm run dev` pages load; no cookie errors.
3. `app/auth/callback/route.ts`: exchange code, validate `next`, redirect (to `/acceso/usuario` when there is no profile). Check: an invalid code redirects to `/acceso?error=callback`.
4. Rewrite `lib/session.tsx`: real session through `getUser` + `onAuthStateChange`, profile fetch, `status`, `signOut`, `saveScore` with `user_id`. Remove `login` and `av_user` (delete the stale key once). Rewrite `components/auth-form.tsx` for email login and signup (username availability check, `signUp` with `options.data.username` and `emailRedirectTo`, Spanish error messages, "revisa tu correo" state after signup, `?error` banner, `?next`). Check: sign up, click the email link, land logged in on `/`; wrong password shows an error.
5. Nav sign-out menu (desktop and mobile panel), `/acceso` redirect when logged in, `game-player.tsx` fixed name for logged-in users. Check: a logged-in score appears on the leaderboard with the username and has `user_id` set; a guest score still works.
6. OAuth: wire the Google and GitHub buttons to `signInWithOAuth` with `redirectTo` = `/auth/callback?next=…`. Add `/acceso/usuario` (choose username, availability check, insert profile, redirect to `next`); `SessionProvider` status `needs-username` redirects there from any page except the auth routes. Check: the buttons navigate to the provider; a user without profile is sent to `/acceso/usuario` and cannot reach other pages until a name is saved.
7. Password reset: link `¿OLVIDASTE TU CONTRASEÑA?` under the login password field, `/acceso/recuperar` (`resetPasswordForEmail`, same neutral message whether or not the email exists), `/acceso/nueva-clave` (`updateUser`, then redirect to `/`). Check: full reset with a real inbox.
8. Update `CLAUDE.md` (Auth bullet, Data bullet, layout routes, dashboard setup note) and set this spec to `Implemented`.

All new UI reuses `.av-auth-wrap`, `.auth-card`, `.field`, `.btn` and `.auth-tabs` from `app/globals.css`; new styles only for the error banner and the nav menu (use `/frontend-design` for the visual pass). UI copy in Spanish, code and comments in English.

## Acceptance criteria

- [x] Signing up with username, email and password creates an `auth.users` row and a `profiles` row with that username (checked with `execute_sql`).
- [x] After signup the login is refused until the email link is opened ("confirmación pendiente" message); after opening it the user is logged in and lands on `/`.
- [x] Signing up with a username already taken (any letter case) is rejected before the request, with a Spanish message; usernames outside `^[A-Za-z0-9_]{3,12}$` are rejected.
- [x] A weak password (< 8 characters) is rejected with a Spanish message; a wrong password on login shows an error and does not log in.
- [x] Reloading the page keeps the user logged in; the nav shows the username on first paint after hydration with no hydration warning.
- [x] `CERRAR SESIÓN` (desktop menu and mobile panel) ends the session; the nav goes back to `Iniciar Sesión`.
- [x] Visiting `/acceso` while logged in redirects to `/`.
- [x] `JUGAR COMO INVITADO` goes to `/` with no session and the player still saves a guest score with `user_id` null.
- [x] A logged-in score row has `user_id` = the user id and `name` = the profile username; the name input in the player is read-only.
- [x] An insert into `scores` with another user's `user_id`, or with a `name` different from the profile username, is rejected by RLS (checked with `execute_sql` / the REST API).
- [x] The Google and GitHub buttons redirect to the provider authorization page; after consent a user without a profile is sent to `/acceso/usuario`, and any other page redirects back there until a username is saved.
- [x] Password reset sends a link; opening it shows `/acceso/nueva-clave`; after saving, the new password works for login and the old one does not.
- [x] `/acceso/recuperar` shows the same message for a registered and an unregistered email.
- [x] `/auth/callback?next=//evil.com` and `?next=https://evil.com` redirect to `/`, never off-site.
- [x] `localStorage` has no `av_user` after the first load; no code references `av_user` or `login(`.
- [x] No secret (OAuth client secret, service role key) appears in the repo or in `NEXT_PUBLIC_*` variables.
- [x] No console errors on `/`, `/acceso`, `/juegos/snake/jugar` and the three new auth routes.
- [x] `get_advisors` (security) shows no new warnings for `profiles`, `scores` or the trigger.
- [x] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.

## Decisions

- **Yes:** Supabase Auth with email + password and Google/GitHub. **No:** magic link only (needs reliable mail) and custom auth (insecure, reinventing).
- **Yes:** email confirmation ON, as chosen. Cost: signup needs a working inbox and default Supabase mail is rate limited.
- **Yes:** `profiles` table with unique case-insensitive username. **No:** username only in user metadata (not unique, not queryable) and email prefix (weak identity).
- **Yes:** profile created by a DB trigger for the email flow. Reason: with confirmation ON the signup has no session, so a client-side insert would fail RLS. **No:** server action that creates the profile after signup (needs a service role key).
- **Yes:** OAuth users pick a username on `/acceso/usuario`. **No:** auto-generated names from the provider name (conflicts and surprising identities).
- **Yes:** keep guests; scores get nullable `user_id`. **No:** requiring login to save scores (would change the SPEC 06 contract and lose casual players).
- **Yes:** `@supabase/ssr` cookie session refreshed in `proxy.ts`. **No:** client-only session in `localStorage`: no server-side user and mismatches with the SSR clients already in the project.
- **Yes:** keep `/acceso` with tabs. **No:** separate `/registro` route: duplicates the card and the nav logic.
- **Yes:** password reset in scope, as requested.
- **Yes:** `name` in `scores` must equal the profile username for logged-in inserts, enforced by RLS. **No:** trusting the client to send the right name.
- **Yes:** read `node_modules/next/dist/docs/` before writing `proxy.ts` and the Route Handler (AGENTS.md warning).
- **Yes:** code, comments and spec in English; UI copy in Spanish.

## Risks

| Risk                                                                                            | Mitigation                                                                                                     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Default Supabase mail allows very few emails per hour, so signup and reset look broken          | Document it; configure custom SMTP (own spec) before real users. Test with one inbox.                          |
| A guest can type a registered username as the score name (impersonation)                        | Accepted for now (guests were always anonymous). Follow-up spec can reserve usernames or mark verified scores. |
| Trigger fails on a username race (two signups, same name) and signup returns a generic DB error | Client pre-checks availability; unique index is the final guard; map the error to the "name taken" message.    |
| OAuth redirect URLs or provider apps misconfigured                                              | Setup list in this spec and `CLAUDE.md`; acceptance criterion checks the redirect to the provider.             |
| `proxy.ts` with `cacheComponents` changes caching/prefetch behavior                             | Proxy only refreshes cookies, no rewrites; verify `/biblioteca` and `/juegos/*` still load fresh data.         |
| Session read after mount flashes the logged-out nav                                             | Same pattern as today (`status: "loading"`); nav shows nothing user-specific until resolved.                   |
| Open redirect through `next`                                                                    | `next` validated to a same-origin path; covered by acceptance criterion.                                       |
| Existing 6 scores have no `user_id`                                                             | Column is nullable; they stay as guest scores.                                                                 |

## What is **not** in this spec

- Profile page, editing username/email/password, avatar, account deletion.
- Per-user stats or leaderboard links to profiles.
- Roles, admin, username moderation or reserved names.
- More providers, magic links, MFA, custom SMTP and email templates.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
