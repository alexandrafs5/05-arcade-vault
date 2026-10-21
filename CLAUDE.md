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
- Layouts use the globally generated `LayoutProps<"/">` type (no import needed) instead of hand-written props types.
