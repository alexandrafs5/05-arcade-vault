# SPEC 05 — Asteroids game (ROCAS) playable in the platform

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-16
> **Objective:** Port the vanilla-canvas Asteroids game from `references/started-games/02-asteroids/` into a React canvas component and make it the real player for the existing `rocas` game, inside the current player shell (HUD, pause, game-over modal, score saving).

## Why this spec exists

`/juegos/[id]/jugar` currently renders a mock player for every game: a fake score ticking up on a timer. This is the first real game on the platform. It sets the pattern later games will follow: a game engine isolated from React, mounted in a client component, reporting score, lives, level, and game over to the shared shell.

## Scope

**In:**

- Port `game.js` (classes `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, game state, update/draw loop) to TypeScript modules under `lib/games/asteroids/`, with no DOM globals at module level.
- New client component `components/asteroids-canvas.tsx`: owns the `<canvas>` (800×600 logic size), starts and stops the loop, and calls callbacks into the shell.
- Per-game dispatch: `/juegos/rocas/jugar` uses the real canvas game; the other 7 games keep the mock arena exactly as today.
- Reuse the shell in `components/game-player.tsx`: HUD stats (player, score, lives, level), PAUSA / REANUDAR, FIN, SALIR, CRT frame, game-over modal, name input, `saveScore`, JUGAR DE NUEVO, VOLVER AL VAULT.
- For `rocas`, HUD score, lives, and level come from the engine, not from the mock timer or `POINTS_PER_LEVEL`.
- Game-over modal opens when the engine reaches `gameover` or when the player clicks FIN.
- Pause with the PAUSA button and with the `P` or `Esc` key. The loop freezes while paused.
- Prevent page scroll on `Space` and arrow keys while the game is mounted.
- Canvas scales to its container with CSS; game logic stays 800×600.
- Keep the original look: white vector strokes on black, cyan power-up. The CRT frame supplies the arcade feel.
- Keep original rules: 3 lives, 3 s spawn invincibility, asteroid sizes 3/2/1 worth 20/50/100 points, level clear spawns `3 + level` asteroids, triple-shot power-up (15% drop, guaranteed after 5 kills, 5 s duration, 12 s time to live).
- Update the `rocas` entry in `lib/data.ts`: remove the UFO claim from `long`, since the game has none.
- Short note in `CLAUDE.md` about the game-engine pattern and the `rocas` dispatch.
- Controls: `←` `→` rotate, `↑` thrust, `Space` fire (as in the original).

**Out of scope (for future specs):**

- UFOs / enemy saucers.
- Touch or on-screen controls for mobile.
- Sound and music.
- Neon recolor of the in-canvas world.
- Persisting scores in Supabase (scores still go to `av_scores` through `saveScore`).
- Replacing the other 7 mock players.
- Gamepad support.
- Tests.

## Data model

No database objects and no new `localStorage` keys. Scores reuse `SavedScore` from `lib/session.tsx` (`{ game: "rocas", score, name }`).

The engine exposes a small interface so the shell never touches engine internals:

```ts
// lib/games/asteroids/engine.ts
export type EngineState = "playing" | "dead" | "gameover";

export type EngineSnapshot = {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
};

export type EngineCallbacks = {
  onChange: (s: EngineSnapshot) => void; // fired only when a snapshot field changes
  onGameOver: (finalScore: number) => void;
};

export type Engine = {
  start: () => void; // begin the rAF loop
  stop: () => void; // cancel the loop and remove window listeners
  setPaused: (paused: boolean) => void;
  restart: () => void; // initGame(): score 0, lives 3, level 1
};

export function createEngine(
  canvas: HTMLCanvasElement,
  cb: EngineCallbacks,
): Engine;
```

Conventions:

- Logic size is fixed at `W = 800`, `H = 600`. Positions wrap toroidally via `wrap(v, max)`.
- `dt` is capped at 0.05 s (as in the original). On resume from pause, the first frame uses `dt = 0`.
- Constants (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`) keep the original values and names.
- Game state lives inside the `createEngine` closure, not in module-level globals, so mounting twice or hot reload cannot share state.
- Key listeners are attached to `window` in `start` and removed in `stop`.
- The canvas draws only the world (rocks, ship, bullets, particles, power-ups, power-up timer). The canvas HUD (`SCORE`, `NIVEL`, life icons) and the `GAME OVER` overlay are removed; the React shell shows them.

## Implementation plan

1. Create `lib/games/asteroids/` with `constants.ts` (constants and `wrap`, `dist`, `rand`, `randInt`) and `entities.ts` (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, each taking `ctx` or receiving it in `draw(ctx)`). Manual check: `npm run lint` passes.
2. Create `lib/games/asteroids/engine.ts` with `createEngine`: input tracking, update, draw, spawn, level logic, loop, snapshot callbacks, pause, restart. Manual check: `npm run lint` and `npx tsc --noEmit` pass.
3. Create `components/asteroids-canvas.tsx` (client): creates the engine in `useEffect`, cleans up with `stop`, forwards `paused` and a `restartKey` prop, calls `onChange` and `onGameOver`. Manual check: mount it temporarily on a scratch page; ship moves and fires.
4. Extend `components/game-player.tsx`: when `gameId === "rocas"`, render `<AsteroidsCanvas>` in place of `.game-arena` and drive score, lives, level from snapshots; skip the mock timer for that game; open the modal on `onGameOver` or FIN. Other games unchanged. Manual check: `/juegos/rocas/jugar` plays; `/juegos/caida/jugar` still shows the mock arena.
5. Add `P` / `Esc` pause toggle and `preventDefault` on `Space` and arrow keys while mounted. Manual check: keys pause and resume; page does not scroll.
6. Add CSS so the canvas fills `.crt-screen` with `width: 100%`, `aspect-ratio: 4 / 3`, black background. Manual check: resize the window; canvas scales, game still plays.
7. Wire JUGAR DE NUEVO to `engine.restart()` and reset `saved`, and SALIR / VOLVER AL VAULT to stop the engine (unmount). Manual check: play, die three times, save score, play again.
8. Update the `rocas` `long` text in `lib/data.ts` and add the `CLAUDE.md` note.
9. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] `/juegos/rocas/jugar` shows an 800×600 canvas with 4 asteroids and a ship at the center, blinking for 3 s.
- [ ] `←` / `→` rotate the ship, `↑` thrusts, `Space` fires one bullet with a 0.2 s cooldown.
- [ ] Destroying a size 3 / 2 / 1 asteroid adds exactly 20 / 50 / 100 to the HUD score.
- [ ] A size 3 or 2 asteroid splits into two asteroids of the next smaller size; a size 1 asteroid does not split.
- [ ] Hitting an asteroid after invincibility ends removes one life; the HUD shows lives going 3 → 2 → 1 → 0.
- [ ] Clearing all asteroids raises the HUD level by 1 and spawns `3 + level` asteroids.
- [ ] After the third death the game-over modal opens with the final score.
- [ ] Clicking FIN opens the game-over modal with the current score.
- [ ] GUARDAR PUNTUACIÓN stores `{ game: "rocas", score, name }` in `av_scores` and `/salon` for ROCAS lists it for the local player.
- [ ] JUGAR DE NUEVO resets score 0, lives 3, level 1, and a fresh asteroid field; no duplicate loops run (speed stays constant after 3 restarts).
- [ ] PAUSA, `P`, and `Esc` each freeze the canvas (asteroids stop moving); pressing again resumes with no jump in positions.
- [ ] While the game is mounted, `Space` and arrow keys do not scroll the page.
- [ ] Canvas shrinks and grows with the viewport while keeping a 4:3 ratio; at 375 px width it fits with no horizontal scroll.
- [ ] Leaving the page (SALIR, VOLVER AL VAULT, or browser back) stops the loop: no console errors and `window` key listeners are removed.
- [ ] `/juegos/caida/jugar` (and the other 6 games) still show the mock arena and the mock timer exactly as before.
- [ ] `/juegos/rocas` detail text no longer mentions UFOs.
- [ ] No console errors on `/juegos/rocas/jugar` during a full play session.

## Decisions

- **Yes:** reuse the existing `rocas` entry. It is the same game in the catalog; a 9th entry would leave a mock duplicate.
- **No:** new `asteroides` entry. Extra catalog churn and a dead mock game.
- **Yes:** reuse the player shell (HUD, modal, `saveScore`). The game becomes part of the platform and scores reach the leaderboard flow from SPEC 01.
- **No:** standalone canvas with its own HUD and overlay. Less work, but no score saving and an inconsistent UI.
- **Yes:** engine isolated in `lib/games/asteroids/` behind `createEngine`, React only mounts it. Keeps the loop testable later and gives a pattern for the next games.
- **No:** porting the game as a React state machine (`useState` per frame). Re-rendering at 60 fps would hurt performance and is unnecessary.
- **Yes:** snapshot callbacks fire only on change (score, lives, level, state), not every frame. Avoids 60 re-renders per second.
- **Yes:** remove the canvas HUD and `GAME OVER` overlay. The React shell already shows them; duplicates would conflict.
- **Yes:** keep the white vector look. It is the game's identity and the CRT frame already provides the neon context.
- **No:** neon recolor now. Needs design work and is not needed to ship the game.
- **Yes:** `P` / `Esc` pause, scroll prevention, and responsive canvas. Space and arrows scroll the page otherwise, and fixed 800 px breaks mobile widths.
- **No:** touch controls. They need a UI design of their own, so they go in a later spec.
- **Yes:** keep the triple-shot power-up even though the original README does not mention it. It exists in `game.js`.
- **No:** UFOs. The original game has none; the catalog text is corrected instead.
- **Yes:** the level in the HUD is the engine level, not `1 + floor(score / 2500)`, for `rocas` only.
- **Yes:** UI strings stay Spanish (HUD labels, buttons) and code, identifiers, and this spec stay in English, per project convention.

## Risks

| Risk                                                                       | Mitigation                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| React 19 Strict Mode mounts effects twice in dev, starting two loops       | `useEffect` cleanup always calls `engine.stop()`; engine state is per-instance; acceptance criterion checks constant speed after restarts. |
| `canvas` access during SSR or under `cacheComponents`                      | Engine is created only inside `useEffect` in a `"use client"` component; the page stays a server component with `<Suspense>`.              |
| Frame-rate dependence: `DRAG = 0.987` is applied per frame, not per second | Keep original behavior for fidelity; note it in `constants.ts`. Fix only if play feels different on 120/144 Hz screens.                    |
| Key `justPressed` state stuck after pause or blur                          | Clear `keys` and `justPressed` on `setPaused`, on `window` blur, and on `stop`.                                                            |
| Game-over fired twice (engine and FIN button)                              | Shell ignores `onGameOver` when the modal is already open.                                                                                 |
| Next.js 16 behavior differs from training data                             | Read the relevant guide in `node_modules/next/dist/docs/` before changing routes or client components.                                     |

## What is **not** in this spec

- UFOs or any new enemy.
- Touch controls and gamepad support.
- Sound.
- Supabase-backed scores.
- Real players for the other 7 games.
- Neon recolor.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
