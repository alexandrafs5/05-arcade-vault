# Security audit log

Last audit: 2026-11-17, scope `all` (db + app), branch `spec-16-security-hardening`, commit b311aa2.

## Status

| id      | severity | surface | title                                                                                                                                                           | status   | first seen | last seen  |
| ------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ---------- |
| SEC-001 | Medium   | db      | `anon`/`authenticated` hold full table grants (incl. TRUNCATE, DELETE, UPDATE) on all public tables and `game_stats`; only RLS blocks writes                    | open     | 2026-11-17 | 2026-11-17 |
| SEC-002 | Low      | db      | Migration version drift: applied versions (e.g. 20261116194233) differ from file prefixes (20261116000000); names and order match                               | open     | 2026-11-17 | 2026-11-17 |
| SEC-003 | Low      | app     | `react` 19.3.0 and `resend` 6.37.0 behind patch releases (19.3.1, 6.38.1)                                                                                       | open     | 2026-11-17 | 2026-11-17 |
| SEC-004 | Low      | db      | `rls_auto_enable` has `search_path=pg_catalog` instead of `''` (EXECUTE revoked from API roles, so not callable)                                                | open     | 2026-11-17 | 2026-11-17 |
| ACC-001 | Accepted | db      | Advisor `auth_leaked_password_protection` (Pro plan only), SPEC 16 Decisions                                                                                    | accepted | 2026-11-17 | 2026-11-17 |
| ACC-002 | Accepted | app     | SPEC 16 open items: no CSP, no CAPTCHA, no rate limit on score inserts / contact form, default SMTP 2/h, `weak_password` UX, guest can type registered username | accepted | 2026-11-17 | 2026-11-17 |

Evidence

- SEC-001: `information_schema.role_table_grants` shows DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE for both roles on `games`, `scores`, `profiles`, `game_stats`. `pg_policies` has no update/delete policy, so PostgREST writes are denied; TRUNCATE is not exposed by PostgREST. Defence in depth gap only. Fix: new migration `revoke all on public.games, public.scores, public.profiles, public.game_stats from anon, authenticated;` then grant back select (all), insert on `scores` (anon, authenticated), insert on `profiles` (authenticated). Needs a migration.
- SEC-002: `list_migrations` vs `supabase/migrations/` (11 each, same names, different timestamps). Fix: align via migration repair or record as known; no code change.
- SEC-003: `npm outdated`. `npm audit --omit=dev` = 0 vulnerabilities.
- SEC-004: `pg_proc.proconfig` for `rls_auto_enable` = `search_path=pg_catalog`; `handle_new_user` = `search_path=""`. Both not executable by anon/authenticated. Platform-owned function; leave unless it is user-created.

## Manual checks for the user

Not verifiable from the MCP; expected values from SPEC 16 "Results". Last confirmed 2026-11-18 by the user in SPEC 16, not re-confirmed this run.

- Email provider: Confirm email ON, min password 8, all character classes required.
- Rate limit sign-ups and sign-ins: 10 requests / 5 min / IP.
- Leaked password protection: off (accepted).
- Email rate limit: 2/h (default SMTP).
- URL Configuration: Site URL and Redirect URLs allow-list (localhost and production callbacks only).
- Google and GitHub OAuth client secrets set only in the dashboard.
- Live signup test with a 7-character password: skipped this run (needs a user-approved throw-away address).

## Run 2026-11-17 (all)

Scope: DB and app, full checklist.

New: SEC-001 (Medium), SEC-002, SEC-003, SEC-004 (Low). Critical 0, High 0.
Closed: none (first run).

Verified OK

- Advisors: only `auth_leaked_password_protection` (security).
- RLS enabled on `games`, `scores`, `profiles`; policies match SPEC 15 contract (games select only; scores select + insert guest-or-owner with username match; profiles select + insert own id; no update/delete; no `true` on writes).
- Constraints: `scores_name_check` 1-12, `scores_score_check` 0-10,000,000, `profiles_username_check`, unique `lower(username)` index present. `game_stats` is `security_invoker=true`.
- No public functions executable by anon/authenticated; `handle_new_user` has `search_path=""`.
- Data: 0 name mismatches, 0 out-of-range scores, 0 duplicate usernames, 0 storage buckets. Extensions installed: only default ones (pgcrypto, uuid-ossp, pg_stat_statements, vault, plpgsql).
- Logs (24 h): 198 auth log rows, 63 postgres, 7 postgrest; no detailed brute-force analysis beyond counts (summary only).
- Headers: all five present on `/`, `/juegos/snake/jugar`, `/auth/callback`, `/acceso` (curl -I on dev server).
- proxy.ts: single file; guest on `/acceso/usuario` and `/acceso/nueva-clave` -> 307 `/acceso`; probe paths (`/.env`, `/.git/config`, `/wp-admin`, `/phpmyadmin`, `/xmlrpc.php`, `/wp-login.php`) -> 404; cookies copied to redirects. Logged-in redirects checked by code only.
- Open redirect: `/auth/callback?next=` with `//evil.com`, `https://evil.com`, `/%5Cevil.com`, `/%09/evil.com` all end at `/acceso?error=callback` (no code); `safeNext` logic reviewed; callback always prefixes `origin`, so no off-site redirect possible.
- Contact action: server-side length limits (80/254/2000), email regex, honeypot, subject whitespace collapsed (no CR/LF injection), plain-text email, generic errors.
- Secrets: `.env*` ignored, only `.env.example` tracked; no `service_role`/`sb_secret` in code; only `NEXT_PUBLIC_SUPABASE_*` public vars. `eyJ` matches are in package-lock integrity hashes and a template HTML asset (not JWTs).
- XSS: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` in `app`, `components`, `lib`.
- `npm audit --omit=dev`: 0 vulnerabilities.

Skipped: Playwright browser/console/localStorage checks; live signup tests (7-char password, unconfirmed login); logged-in proxy redirect test (no test account); deep static review of `lib/session.tsx`, `lib/queries.ts`, `UsernameGate` (not read in detail this run).

Next audit: after the next migration, new Server Action, auth change or new game that saves data.
