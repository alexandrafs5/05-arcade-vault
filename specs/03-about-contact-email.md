# SPEC 03 — About page and contact email (Resend)

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-05
> **Objective:** Replace the `/acerca` placeholder with the About page from `references/templates/home-about/about.jsx` and make its contact form send a real email to the team through Resend using a Server Action.

## Scope

**In:**

- `/acerca` page matching `references/templates/home-about/about.jsx` exactly: "ACERCA DE ARCADE VAULT" hero with mission text, 3 highlight cards with pixel icons (HEART, BROWSER, PLANT), animated divider, and the contact section (intro + 3 tips + form).
- Scroll-reveal on the divider and the contact section, using the existing `components/reveal.tsx`.
- CSS ported from `references/templates/home-about/styles.css` lines 1071–1146 (`/* ===== ABOUT PAGE ===== */` through `.term-body .caret`) into `app/globals.css`.
- Contact form behavior from the template: empty-field check on the client with the shake animation, terminal-style success box with `ENVIAR OTRO MENSAJE` reset.
- Real email delivery with Resend from a Server Action (`sendContactMessage`).
- Server-side validation: trim, all three fields required, valid email format, max lengths (name 80, email 254, message 2000).
- `Reply-To` header set to the sender's email.
- Honeypot field: if filled, the action returns success and sends nothing.
- Failure state in the same terminal box: red `[ERROR]` line and a `REINTENTAR` button that keeps the typed data.
- Environment variables `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, with a committed `.env.example`.
- UI copy stays in Spanish, as in the template.

**Out of scope (for future specs):**

- Confirmation email to the sender (needs a verified domain in Resend).
- Rate limiting, captcha, or storing messages in a database.
- Verifying a custom sending domain in Resend.
- HTML-styled email templates (React Email). The email is plain text.
- Any change to Home, nav, or other screens. The nav already links to `/acerca`.
- Tests, i18n, SEO metadata beyond the existing page title.

## Data model

```ts
// app/acerca/actions.ts
export type ContactState =
  | { status: "idle" }
  | { status: "sent"; name: string }
  | { status: "invalid" }   // client shows shake
  | { status: "error" };    // Resend or config failure; client shows [ERROR] + retry
```

Form fields (`FormData` keys): `name`, `email`, `msg`, and the honeypot `website`.

Environment variables (`.env.local`, never committed; `.env.example` lists the names only):

```
RESEND_API_KEY=
CONTACT_TO_EMAIL=alexandra051009@gmail.com
CONTACT_FROM_EMAIL=onboarding@resend.dev
```

Conventions:

- Email subject: `[Arcade Vault] Mensaje de <name>`.
- Email body: plain text with name, email, and message.
- The API key is read only inside the Server Action; it never reaches the client bundle.
- No new `localStorage` keys.

## Implementation plan

1. Install the SDK: `npm install resend`. Add `.env.example` and a `!.env.example` exception to `.gitignore`. Manual check: `npm run dev` still starts.
2. Port the About CSS block (template lines 1071–1146) into `app/globals.css`, after the existing styles. Check the template's `.kicker`, `blink`, and `.field` rules already exist; add only what is missing. Manual check: existing pages render unchanged.
3. Create `components/highlight-icon.tsx` (HEART, BROWSER, PLANT pixel SVGs, server component, copied from `about.jsx`). Manual check: compiles when imported.
4. Create `app/acerca/actions.ts` with the `sendContactMessage` Server Action: validate, honeypot check, send with Resend, return `ContactState`. Manual check: calling it with valid data and a real key delivers an email.
5. Create `components/contact-form.tsx` (client component): controlled fields, `useActionState`, shake on empty or `invalid`, terminal success box, terminal error box with `REINTENTAR`, `ENVIAR OTRO MENSAJE` reset, hidden honeypot input. Markup and class names copied from `about.jsx`. Manual check: renders inside the contact section.
6. Replace `app/acerca/page.tsx` with the About page composed from the hero, highlights, divider, and contact section, wrapping the divider and contact section in `Reveal`. Keep the `metadata` title. Manual check: `/acerca` matches the template visually.
7. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] `/acerca` renders without console errors and no longer shows "PRÓXIMAMENTE".
- [x] `/acerca` shows, in order: hero ("ACERCA DE ARCADE VAULT" + mission text), 3 highlight cards, divider with 24 pixels, contact section with title "CONTÁCTANOS", 3 tips, and the form.
- [x] Texts, class names, and styles match `references/templates/home-about/about.jsx` and `styles.css`; no copy is invented beyond the error state.
- [x] Submitting with any empty field shakes the form and sends nothing.
- [x] Submitting valid data with a valid `RESEND_API_KEY` delivers an email to `CONTACT_TO_EMAIL` with subject `[Arcade Vault] Mensaje de <name>`.
- [x] Replying to that email targets the sender's address (`Reply-To`).
- [x] After a successful send the terminal box shows `MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, <NAME>.` and `ENVIAR OTRO MENSAJE` resets the form to empty.
- [x] With a missing or invalid `RESEND_API_KEY`, the terminal box shows an `[ERROR]` line and `REINTENTAR` returns to the form with the typed data intact.
- [x] A submission with the honeypot field filled shows success and no email arrives.
- [x] A message longer than 2000 characters or an invalid email format is rejected by the Server Action even if the client check is bypassed.
- [x] `RESEND_API_KEY` does not appear in any client bundle or in the committed files.
- [x] `.env.local` is ignored by git and `.env.example` is tracked.
- [x] The divider and contact section start hidden and gain `.in` on scroll.
- [x] At width ≤ 820px highlights stack in 1 column; at ≤ 900px the contact grid stacks in 1 column.

## Decisions

- **Yes:** Server Action for sending. No public endpoint to design, and only this form uses it.
- **No:** Route Handler `/api/contacto`. More boilerplate; revisit if another client needs the endpoint.
- **Yes:** recipient, sender, and key in environment variables. Changing the sender later (for example to a verified domain) needs no code change.
- **No:** hardcoded addresses. They would leak the inbox into the repo.
- **Yes:** default sender `onboarding@resend.dev`. Works without a verified domain.
- **Yes:** `Reply-To` = sender's email, so replies go straight to the visitor.
- **Yes:** honeypot field plus server-side validation. Cheap spam defense without a captcha or a rate-limit store.
- **No:** confirmation email to the sender. Requires a verified domain; separate spec.
- **Yes:** terminal-style error with `REINTENTAR`. Stays inside the template's visual language and keeps the user's text.
- **Yes:** reuse `components/reveal.tsx` instead of the template's global `querySelectorAll(".reveal")` effect.
- **Yes:** `/acerca` route and Spanish copy stay, per SPEC 02 conventions.
- **Yes:** built with `/frontend-design` guidance per `CLAUDE.md`, but the template is the visual source of truth; no redesign beyond it.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `onboarding@resend.dev` only delivers to the email of the Resend account owner | `CONTACT_TO_EMAIL` must equal the Resend account email until a domain is verified; document it in `.env.example`. |
| Missing `RESEND_API_KEY` in dev or deploy breaks sending | The action catches the failure and returns `{ status: "error" }`; the UI shows the `[ERROR]` terminal instead of crashing. |
| `.gitignore` ignores `.env*`, so `.env.example` would be untracked | Plan step 1 adds a `!.env.example` exception. |
| Next.js 16 `cacheComponents` and Server Action behavior differ from classic Next | Read the relevant guides in `node_modules/next/dist/docs/` before writing the action. |
| Public form can be abused to send mail | Honeypot and length limits now; rate limiting is a future spec. |

## What is **not** in this spec

- Confirmation email to the sender.
- Rate limiting, captcha, or message storage.
- Custom sending domain setup.
- HTML email templates.
- Changes to any screen other than `/acerca`.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
