# SPEC 16 — Basic security hardening

> **Status:** Approved
> **Depends on:** SPEC 04, SPEC 06, SPEC 15
> **Date:** 2026-11-17
> **Objective:** Apply the basic security checklist in `references/security/checklist.md`: verify RLS, enforce the password minimum, set signup rate limits, add security headers in Next.js, add route protection in `proxy.ts`, and clear the Supabase security advisor warnings that can be fixed.

## Why this spec exists

`references/security/checklist.md` lists five basic measures plus a pass over the Supabase warnings panel. State on 2026-11-17 (checked with the Supabase MCP):

| Checklist item              | Current state                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RLS on `games` and `scores` | Already on (also on `profiles`). Needs a documented verification, not a change.                                                                        |
| Minimum password length 8   | Set in SPEC 15 as a manual dashboard step and mirrored client-side. Never verified server-side.                                                        |
| Leaked password protection  | Off (advisor `auth_leaked_password_protection`). HIBP check is a Pro-plan feature.                                                                     |
| Max signup rate per IP      | Supabase defaults only (SPEC 15 left "rate limiting beyond Supabase defaults" out of scope).                                                           |
| Security headers in Next.js | None. `next.config.ts` has no `headers`.                                                                                                               |
| Route protection (proxy)    | `proxy.ts` exists (SPEC 15) but only refreshes the session cookie: no redirects, no gating. The `/acceso` redirect for logged-in users is client-side. |
| Supabase warnings panel     | 3 WARN: `rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon` and `authenticated` (2 lints), plus leaked password protection.             |

The work is small and mixes code (headers, one migration) with manual dashboard steps, so the spec records the dashboard steps and how each one is verified.

## Scope

**In:**

- Security headers for every route through `headers()` in `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (the three in the checklist), plus `Strict-Transport-Security: max-age=63072000; includeSubDomains` and a restrictive `Permissions-Policy` (camera, microphone, geolocation, payment and usb denied).
- New migration that revokes `EXECUTE` on `public.rls_auto_enable()` from `public`, `anon` and `authenticated`.
- RLS verification for `games`, `scores` and `profiles` (`list_tables` shows `rls_enabled`; anon cannot update or delete; anon cannot insert into `games`).
- Dashboard step (manual): Authentication → Providers → Email → minimum password length 8. Verified with a real signup attempt using a 7-character password.
- Dashboard step (manual): Authentication → Rate Limits → lower "Rate limit for sign-ups and sign-ins" (the panel counts sign-ups and sign-ins together, per IP, per 5 minutes) to 10 requests / 5 min (120 / hour); keep the other values at defaults unless the panel shows a weaker one.
- Re-run `get_advisors` (security) and record what remains.
- `CLAUDE.md`: add a short "Security" bullet (headers live in `next.config.ts`; dashboard settings; accepted warnings).
- Route protection in the existing `proxy.ts` (Next.js proxy, https://nextjs.org/docs/app/getting-started/proxy; read the local docs in `node_modules/next/dist/docs/` first). It keeps the cookie refresh from SPEC 15 and adds three rules after `supabase.auth.getClaims()`:
  1. **Logged-in users leave the login pages:** with a session, `/acceso` and `/acceso/recuperar` redirect to `/`. `/acceso/nueva-clave` is excluded (a recovery link creates a session and must reach it). `/acceso/usuario` is excluded (needs a session).
  2. **Guests cannot open session-only pages:** without a session, `/acceso/usuario` and `/acceso/nueva-clave` redirect to `/acceso`.
  3. **Probe paths get a 404:** `/.env*`, `/.git*`, `/wp-admin*`, `/wp-login.php`, `/xmlrpc.php`, `/phpmyadmin*` return `404` from the proxy (bots scanning for known files).
- Game pages (`/juegos/*/jugar`) stay public: guests keep playing (SPEC 06 and SPEC 15 decision). Redirect responses from the proxy copy the refreshed session cookies, so a redirect never drops a refreshed token.

**Out of scope (for future specs):**

- Leaked password protection (HIBP): Pro-plan only, **skipped**. The advisor warning stays and is recorded as accepted until the plan changes.
- CAPTCHA (Turnstile, hCaptcha) on signup.
- Content-Security-Policy (needs nonce work with `cacheComponents`, high breakage risk).
- Rate limiting of score inserts and of the contact form (Server Action).
- Custom SMTP, MFA, session timeouts, audit logging.
- Dependency audit, secret scanning and CI security gates.
- Automated tests.

## Data model

This feature introduces no new tables or types. One migration changes function privileges only.

New migration `supabase/migrations/20261118050845_revoke_rls_auto_enable_execute.sql` (timestamp re-checked against the latest applied one; never edit applied migrations):

```sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

Headers added in `next.config.ts` (shape only):

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];
// headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

Proxy rules in `proxy.ts` (shape only; keep the existing cookie-sync code):

```ts
const GUEST_BLOCKED = ["/acceso/usuario", "/acceso/nueva-clave"]; // need a session
const USER_BLOCKED = ["/acceso", "/acceso/recuperar"]; // exact paths, logged-in users leave
const PROBE = /^\/(\.env|\.git|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin)/i;
// claims = (await supabase.auth.getClaims()).data?.claims -> session = !!claims
```

Conventions:

- Only one `proxy.ts` is allowed by Next.js: the rules extend the existing file and keep the same `matcher`.
- Path matching ignores a trailing slash; `/acceso/usuario` and `/acceso/nueva-clave` are not in `USER_BLOCKED`, so no redirect loop is possible.
- Redirects keep `next` query params untouched and copy the refreshed cookies onto the redirect response.
- Headers apply to every route, including `/auth/callback`.
- `X-Frame-Options: DENY` means the site cannot be embedded in an iframe anywhere.
- Dashboard values are recorded in the spec's "Results" section when applied (no secrets in the repo).

## Implementation plan

1. Read `node_modules/next/dist/docs/` for the `headers` config of this Next.js version, then add `securityHeaders` and `headers()` to `next.config.ts`. Check: `npm run dev`, `curl -I http://localhost:3000/` (and `/juegos/snake/jugar`, `/auth/callback`) lists the five headers; the home, a game and `/acceso` still render with no console errors.
2. Migration: revoke `EXECUTE` on `rls_auto_enable()`. Apply with the Supabase MCP, run `get_advisors` (security). Check: the two `*_security_definer_function_executable` lints are gone; the app still loads games and saves a score (guest and logged-in).
3. RLS verification with `list_tables` and `execute_sql` under the `anon` role: `update` and `delete` on `scores`, any write on `games` and `profiles` update/delete are rejected. Record the outcome. No change expected; if a gap appears, fix it with a new migration.
4. Dashboard (manual, the user does it; no API available): set minimum password length 8 and the signup/sign-in rate limits. Check: a signup with a 7-character password is rejected by the server (bypass the client check by calling the Auth REST endpoint); the new rate limit values are visible in the panel.
5. Extend `proxy.ts` with the three route rules (read the Next.js proxy docs first). Keep the cookie refresh; copy cookies to redirect responses. Check with `curl -I` and the browser: guest on `/acceso/usuario` and `/acceso/nueva-clave` goes to `/acceso`; logged-in user on `/acceso` and `/acceso/recuperar` goes to `/`; password reset link still reaches `/acceso/nueva-clave`; first OAuth login still reaches `/acceso/usuario`; `/.env` returns 404; `/`, `/biblioteca`, `/juegos/snake/jugar` stay public.
6. Re-run `get_advisors`; the only remaining security warning must be `auth_leaked_password_protection` (accepted). Update `CLAUDE.md` (Security bullet, and the `proxy.ts` mention in the Auth bullet), fill "Results" and set this spec to `Implemented`. Run `npm run lint`, `npx tsc --noEmit` and `npm run build`.

## Acceptance criteria

- [ ] `curl -I` on `/`, `/juegos/snake/jugar` and `/auth/callback` shows `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` and `Permissions-Policy`.
- [ ] Home, `/biblioteca`, `/juegos/snake/jugar`, `/acceso` render with no new console errors; Google/GitHub OAuth redirect and email login still work with the headers on.
- [ ] `list_tables` shows `rls_enabled: true` for `games`, `scores` and `profiles`.
- [ ] As `anon`, `update`/`delete` on `scores`, and `insert`/`update`/`delete` on `games`, are rejected; guest score insert still works.
- [ ] `public.rls_auto_enable()` is no longer executable by `anon` or `authenticated`; `get_advisors` (security) no longer lists `anon_security_definer_function_executable` nor `authenticated_security_definer_function_executable`.
- [ ] A signup request with a 7-character password sent straight to the Auth REST endpoint is rejected by the server.
- [ ] The dashboard shows the sign-up and sign-in rate limits set to the values recorded in "Results".
- [ ] The only security advisor warning left is `auth_leaked_password_protection`, recorded as accepted.
- [ ] As a guest, `/acceso/usuario` and `/acceso/nueva-clave` redirect to `/acceso`; as a logged-in user, `/acceso` and `/acceso/recuperar` redirect to `/`; no redirect loop in any case.
- [ ] The password reset email link still ends on `/acceso/nueva-clave` and the new password can be saved; a first OAuth login still ends on `/acceso/usuario`.
- [ ] `GET /.env`, `/.git/config`, `/wp-admin` and `/phpmyadmin` return `404`.
- [ ] `/`, `/biblioteca`, `/juegos/snake`, `/juegos/snake/jugar`, `/salon` and `/acerca` stay reachable as a guest; a guest score still saves; the contact form Server Action still works.
- [ ] The session cookie still refreshes (user stays logged in after reload) and `proxy.ts` is the only proxy file.
- [ ] No secret appears in the repo or in `NEXT_PUBLIC_*` variables.
- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` finish with no errors.

## Decisions

- **Yes:** the three headers from the checklist plus HSTS and `Permissions-Policy`. **No:** CSP now: needs nonces with `cacheComponents` and can break inline scripts, fonts and Supabase calls; own spec if wanted.
- **Yes:** revoke `EXECUTE` on `rls_auto_enable()`. **No:** drop the function: it is probably owned by the platform (event trigger) and dropping could break it. **No:** leave it: it clears two real warnings and the function should not be callable through `/rest/v1/rpc`.
- **Yes:** skip leaked password protection (Pro plan only), keep the warning as accepted. **No:** client-side HIBP check: extra code and an external call for a small gain.
- **Yes:** Supabase dashboard rate limits for signups. **No:** CAPTCHA now: needs a site key and new UI; noted as a follow-up if bots appear.
- **Yes:** verify RLS instead of rewriting it: SPEC 06 and SPEC 15 already enabled it on all three tables.
- **Yes:** dashboard steps are manual and documented, not scripted: the Supabase MCP has no tool for Auth settings.
- **Yes:** extend the existing `proxy.ts` with route rules. **No:** a second proxy (Next allows one) and **No:** moving the security headers into the proxy: `next.config.ts` `headers()` is the checklist's method and is static.
- **Yes:** keep guest play; the proxy gates only auth pages. **No:** requiring login on `/juegos/*/jugar`: breaks the SPEC 06 and SPEC 15 decision.
- **Yes:** proxy redirect is the first guard for auth pages; **No:** removing the existing client-side checks in the pages: keep them as defense in depth (proxy only reads claims, it is not the only authorization layer; RLS stays the real data guard).
- **Yes:** 404 for a short list of known scanner paths. **No:** blocking by method or user agent: Server Actions use `POST` and UA rules cause false positives.
- **Yes:** code, comments and spec in English.

## Risks

| Risk                                                                                                                                       | Mitigation                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` breaks an embed we forgot                                                                                          | The app embeds nothing and is not embedded; check `/acerca` and the player.                                                                         |
| HSTS locks a custom domain to HTTPS for two years                                                                                          | No `preload`; the app is HTTPS-only in production; no `includeSubDomains` surprise on the shared host.                                              |
| `rls_auto_enable()` is used by an event trigger that needs the privilege                                                                   | Revoke only from API roles; the owner and event triggers keep working. Check a new table creation is not affected, or restore with a new migration. |
| Rate limits too low block real signups (shared IPs, classroom, phone networks)                                                             | Moderate value (10/hour/IP), revisit with real traffic.                                                                                             |
| Proxy redirect loop or a blocked recovery/OAuth flow (`/acceso/nueva-clave`, `/acceso/usuario` need the session the callback just created) | Exact-path lists, the two session pages are never in the logged-in redirect list; acceptance criteria test both flows.                              |
| Proxy runs on every request and `getClaims()` adds latency; redirect drops refreshed cookies                                               | Same cost as today (already called); copy cookies onto redirects; matcher unchanged.                                                                |
| Leaked password protection stays off                                                                                                       | Accepted and recorded; revisit on a plan upgrade.                                                                                                   |
| Dashboard settings drift (not in the repo)                                                                                                 | Values recorded in "Results" and `CLAUDE.md`.                                                                                                       |

## Results

Dashboard values applied on 2026-11-18 (no secrets):

| Setting                              | Value                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Minimum password length              | 8 (server rejects 7 characters: `422 weak_password`, reason `length`)                      |
| Password requirements                | Lowercase, uppercase, digits and symbols (was set in the dashboard; stricter than SPEC 15) |
| Rate limit for sign-ups and sign-ins | 10 requests / 5 min / IP (was 30)                                                          |
| Prevent use of leaked passwords      | Off (Pro plan only), accepted                                                              |
| Rate limit for sending emails        | 2 emails/h (default built-in SMTP; custom SMTP is a future spec)                           |

Follow-up (out of scope): the signup form should show a clear error for `weak_password` when the password misses a required character class, since the client check only enforces length 8.

## What is **not** in this spec

- Leaked password protection, CAPTCHA, CSP.
- Rate limiting of score saves and the contact form.
- Custom SMTP, MFA, audit logging, dependency audit, CI gates.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
