# SPEC 10 — Touch controls for mobile play

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-17
> **Objective:** Make the four games playable on a touch-only phone with the canvas on top and an on-screen gamepad (d-pad plus two buttons A and B) below it.

## Why this spec exists

Today the four engines read only `window` keyboard events (and Arkanoid also reads `mousemove`). On a phone there is no keyboard, so no game can be played. A real-device check (Android, `http://192.168.50.34:3000/juegos/asteroids/jugar`) also shows the player page wastes the screen: nav and HUD fill the top half and the canvas ends up small, and the CRT footer text wraps badly.

The engines already respond to `KeyboardEvent` with `code` (and Snake also checks `key`). So the cheapest, lowest-risk path is a shell component that turns finger presses into virtual keyboard events on `window`. The engines stay almost untouched. This follows the SPEC 05 rule: a new capability lives in the shell and the engine contract does not change.

## Scope

**In:**

- New client component `components/touch-controls.tsx`: a gamepad with a d-pad (four arrows) on the left and two round buttons, A and B, on the right. The same look in every game.
- Virtual keys: each press dispatches `keydown` on `window` and each release dispatches `keyup`, as `KeyboardEvent` with matching `code` and `key`. Holding a button holds the key (needed by Asteroids and Arkanoid, and by Tetris auto-repeat).
- Per-game mapping in `lib/games/registry.ts` through a new optional field `touch` on `GameDefinition` (see Data model). A button with no action in a game is drawn dimmed and does nothing, so the pad looks identical in all games.
- Pointer events (`pointerdown`, `pointerup`, `pointercancel`) with pointer capture, so several fingers work at once (a direction plus a button) and sliding off a button does not leave a key stuck. All held virtual keys are released on pause, on game over, on window `blur` and on unmount.
- Mobile layout, only when the primary pointer is touch (`@media (pointer: coarse)`):
  - The canvas sits on top, the gamepad below it, both inside one screen without page scroll.
  - Nav and footer are hidden on `/juegos/[id]/jugar` (`SALIR` stays in the HUD).
  - The HUD is compact (one or two lines) and keeps `PAUSA`, `FIN`, `SALIR`.
  - The CRT bottom strip (`SEÑAL OK · CRT-83 · 60 HZ · CARGA · 1MB`) is hidden.
  - The canvas keeps its aspect ratio and its height is limited so the pad is always visible (`dvh` units).
- The pad is always in the DOM and hidden by CSS on fine pointers (mouse). Desktop looks exactly as before. This avoids hydration mismatches.
- Touch hygiene on the canvas and the pad: `touch-action: none`, no text selection, no long-press callout or context menu, no double-tap zoom.
- LAN testing on a real phone: `next.config.ts` reads `allowedDevOrigins` from the env var `DEV_ORIGINS` (comma-separated) instead of a hardcoded IP. `.env.example` documents it.
- The tag `TECLADO / TÁCTIL` in `app/juegos/[id]/page.tsx` stays: after this spec it is true for all four games.
- `CLAUDE.md` update: touch controls pattern and `DEV_ORIGINS`.

**Out of scope (for future specs):**

- Swipe gestures, dragging the paddle, tapping the canvas (Arkanoid keeps keyboard and mouse only; on touch it uses the d-pad).
- Haptic feedback (vibration) and sound.
- Gamepad API (physical controllers).
- Fullscreen API and forced landscape.
- A "rotate your phone" notice (no game needs it, see Decisions).
- Remapping or customizing the pad (size, side, left-handed layout).
- Showing the pad on laptops with a touch screen whose primary pointer is a mouse.
- Automated tests.
- New games or skin changes.

## Data model

No new tables and no new `localStorage` keys.

```ts
// lib/games/types.ts
export type TouchAction = {
  code: string; // KeyboardEvent.code, e.g. "Space"
  key: string; // KeyboardEvent.key, e.g. " "
  label: string; // Spanish aria-label, e.g. "Disparo"
};

export type TouchConfig = {
  a?: TouchAction;
  b?: TouchAction;
};

// GameDefinition gets one optional field
// touch?: TouchConfig;
```

The d-pad is fixed in the component: `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` (`code` and `key` equal). It is not configurable per game.

Mapping in `lib/games/registry.ts`:

| `games.id`  | D-pad use                                  | A                        | B                |
| ----------- | ------------------------------------------ | ------------------------ | ---------------- |
| `asteroids` | left/right rotate, up thrust, down unused  | `Space` — "Disparo"      | none (dimmed)    |
| `tetris`    | left/right move, down soft drop, up rotate | `Space` — "Caída rápida" | `KeyX` — "Rotar" |
| `arkanoid`  | left/right move the paddle, up/down unused | none (dimmed)            | none (dimmed)    |
| `snake`     | four directions                            | none (dimmed)            | none (dimmed)    |

Conventions:

- Virtual events are `new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true })` dispatched on `window`. They do not need `isTrusted`.
- Pause and game-over stay in the HUD and the existing `P` / `Esc` logic; the pad has no pause button.
- The component keeps a `Set` of held codes and releases them all in one place.

## Implementation plan

1. In `next.config.ts` replace the hardcoded `allowedDevOrigins` with a list read from `process.env.DEV_ORIGINS` (split on commas, trimmed, empty when unset). Add `DEV_ORIGINS=` with a comment to `.env.example`. Check: with `DEV_ORIGINS` set to the phone's LAN IP in `.env.local`, the phone loads `http://<ip>:3000` with no cross-origin dev warning.
2. Add `TouchAction` and `TouchConfig` and the optional `touch` field to `lib/games/types.ts`. Add the `touch` entries from the table to `lib/games/registry.ts`. Check: `npx tsc --noEmit` and `npm run lint` pass; nothing renders differently.
3. Create `components/touch-controls.tsx`: props `touch?: TouchConfig` and `disabled: boolean`; renders the d-pad and A/B buttons with pointer events, dispatches virtual keys, and releases held keys on `disabled`, `blur` and unmount. Not mounted yet. Check: lint and tsc pass.
4. Add the pad styles to `app/globals.css` (`av-pad`, `pad-dpad`, `pad-btn`, `pad-ab`, in the arcade look of the existing classes), hidden by default and shown inside `@media (pointer: coarse)`. Use `/frontend-design` for the visual design. Check: styles compile; desktop unchanged.
5. Mount `<TouchControls touch={definition.touch} disabled={paused || over} />` in `components/game-player.tsx` under the CRT block. Check: on desktop nothing changes; with Playwright touch emulation the pad shows and a press on each arrow moves the game.
6. Add the mobile layout to `app/globals.css` under `@media (pointer: coarse)`: hide nav, footer and `.crt-bottom` on the player page (for example with `body:has(.av-player)`), compact `.player-hud`, limit `.game-canvas` height with `dvh` so canvas plus pad fit one screen, and set `touch-action: none` and no selection on canvas and pad. Check: at 390×844 touch emulation, `/juegos/<id>/jugar` fits with no page scroll for all four games.
7. Update `CLAUDE.md` (touch controls, `touch` field, `DEV_ORIGINS`). Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] With a mouse (`pointer: fine`) the player page of the four games looks and plays exactly as before: no pad, nav, footer and CRT strip visible.
- [x] With touch emulation (`pointer: coarse`) at 390×844 the pad shows under the canvas on `/juegos/asteroids/jugar`, `/tetris`, `/arkanoid` and `/snake`, with the same layout in all four.
- [x] On touch, nav, footer and the CRT bottom strip are hidden on the player page; `PAUSA`, `FIN` and `SALIR` are visible and work.
- [x] On touch, canvas, HUD and pad fit the viewport with no vertical page scroll at 390×844 and at 360×640.
- [x] Asteroids: holding left/right rotates the ship, holding up thrusts, A (`Space`) fires.
- [x] Tetris: left/right move the piece, holding down soft-drops with auto-repeat, up and B rotate, A hard-drops.
- [x] Arkanoid: holding left/right moves the paddle; releasing stops it.
- [x] Snake: the four arrows change direction; a 180° reversal is still ignored.
- [x] Buttons without an action in a game are dimmed and pressing them does nothing.
- [x] Two fingers work at once (a direction and A in Asteroids).
- [x] Sliding a finger off a held button and lifting it does not leave the key held.
- [x] Opening the pause menu, game over, switching tab or unmounting releases every held key: after resume the ship or paddle does not keep moving.
- [x] Long-press on a pad button shows no context menu or text selection; double-tap does not zoom the page.
- [x] Dragging on the canvas does not scroll the page.
- [x] Keyboard play (arrows, `Space`, `P`, `Esc`) still works on all four games, and typing the name in the game-over `INPUT` is not blocked.
- [x] Setting `DEV_ORIGINS` to the phone's IP lets a real phone load the dev server; leaving it unset does not break `npm run dev`.
- [x] No console errors on the four player pages during a full touch session.

## Decisions

- **Yes:** one shared gamepad (d-pad plus A and B) for all games, as the user drew it. **No:** per-game control schemes (swipe, drag): not uniform.
- **Yes:** virtual keyboard events from the shell, engines untouched. **No:** touch listeners inside each engine: duplicated code in four places. **No:** a new `InputSource` abstraction: a big refactor for no gain now.
- **Yes:** max two buttons. Matches arcade games and the user's request.
- **Yes:** always render the same pad; dim unused buttons. **No:** hide unused buttons: the layout would change per game.
- **Yes:** A = main action, B = secondary. Only Tetris uses B (rotate). **No:** a pause button on the pad: pause is in the HUD and `P` / `Esc`.
- **Yes:** show the pad with `@media (pointer: coarse)`. **No:** a width breakpoint: a narrow desktop window would show a useless pad. **No:** JS detection: hydration mismatch.
- **Yes:** pointer events with pointer capture. **No:** `touchstart` / `touchend`: weaker multi-touch and cancel handling.
- **Yes:** hide nav, footer and CRT strip on touch while playing. **No:** keep them: they take half of the phone screen (seen on a real device).
- **Yes:** no "rotate your phone" notice. Every canvas scales to the screen width and fits in portrait; a notice can come later if a game needs landscape.
- **Yes:** `DEV_ORIGINS` env var. **No:** a hardcoded IP in `next.config.ts`: it changes per network and leaks a private address.
- **Yes:** verify with Playwright touch emulation, plus a manual check on a real phone. **No:** automated tests (none in the project).
- **Yes:** code and spec in English; UI strings (aria-labels) in Spanish.

## Risks

| Risk                                                                     | Mitigation                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Stuck key when a finger leaves the button or the page loses focus        | Pointer capture, release on `pointerup` / `pointercancel`, and release-all on pause, `blur`, unmount. |
| Snake reads `e.key`, other engines read `e.code`                         | Virtual events always set both `code` and `key`.                                                      |
| Mobile browser UI (address bar) changes viewport height                  | Use `dvh` units and check on a real phone.                                                            |
| iOS Safari ignores some `touch-action` and callout rules                 | Also prevent `contextmenu` and `selectstart` on the pad; check on a real device if one is available.  |
| Tall Tetris canvas (450×600) leaves little room with the pad             | Limit canvas height with `dvh`; acceptance checks 360×640.                                            |
| `:has()` selector for hiding nav and footer is unsupported on old phones | Support is wide on current Android and iOS; if a layout flag is needed, `/spec-impl` may add a class. |
| Next.js 16 differs from training data                                    | Read the relevant guide in `node_modules/next/dist/docs/` before changing `next.config.ts`.           |

## What is **not** in this spec

- Swipe gestures and paddle dragging.
- Vibration and sound.
- Physical gamepad support.
- Fullscreen and forced landscape.
- Pad customization.
- Automated tests.
- New games or skins.

Each one of those, if it lands, goes in its own spec.
