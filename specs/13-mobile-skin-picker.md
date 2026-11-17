# SPEC 13 — Mobile skin picker in the pause screen

> **Status:** Approved
> **Depends on:** SPEC 10, SPEC 11
> **Date:** 2026-11-17
> **Objective:** Let touch players change the game skin (`classic`, `neon`, `retro`) from the pause overlay, since the HUD picker is hidden on phones.

## Why this spec exists

Every playable game (`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`) implements the three skins, and the picker lives in the player HUD (`components/game-player.tsx`). SPEC 10 hid it on touch devices (`.player-hud .hud-stat:has(.skin-picker) { display: none; }` in `app/globals.css`) because the phone HUD has no room for a third line. Result: on a phone a player can see a skin saved on desktop (`av_skin_<id>` is read on mount) but cannot change it.

The pause overlay ("EN PAUSA") already exists, covers the canvas, and the game is stopped while it shows. It costs no HUD space, and the engines repaint one frame on `setSkin` while paused, so the player sees the new skin behind the overlay at once.

## Scope

**In:**

- A second skin picker rendered inside the pause overlay of `components/game-player.tsx`, under "PULSA REANUDAR PARA CONTINUAR".
- Shown only under `@media (pointer: coarse)`; hidden by CSS everywhere else (same CSS-only rule as the touch pad, no JS detection).
- Same options, labels and dots as the HUD picker (`SKIN_LABELS`, `.skin-dot`), same state (`skin`) and same persistence (`pickSkin`, `localStorage` key `av_skin_<id>`). Picking a skin applies it live, without restart and without resuming.
- Touch-sized options: tap target at least 44px high; the three options fit one row at 360px wide.
- Shared markup: extract the picker into a small component so the HUD and the pause overlay do not duplicate the radio-group code. Each instance gets a unique label id (`useId`).
- Shown only when `definition.skins` exists (same condition as the HUD picker).
- `CLAUDE.md`: update the Skins bullet and the touch bullet (picker hidden in the HUD on touch, lives in the pause overlay).

**Out of scope (for future specs):**

- Changing the desktop player: the HUD picker stays as is and the pause overlay shows no picker with a mouse.
- A picker in the HUD on touch, a cycle button, or a skin button next to PAUSA / FIN / SALIR.
- Skinning the touch pad (`classic` / `neon` / `retro` do not touch the pad; see SPEC 11).
- Adding skins to a new game, or changing any palette or engine (`@skin-designer` territory).
- Picker on the game-over modal, the library or the game detail page.
- Saving the skin in the database or per user account.
- Automated tests.

## Data model

This feature introduces no new data structures. It reuses `SkinId`, `SKIN_LABELS`, `skinStorageKey` and the `skin` state from `components/game-player.tsx`, and the `av_skin_<id>` `localStorage` key.

New component (props only, no state of its own):

```ts
// components/skin-picker.tsx
type SkinPickerProps = {
  skins: readonly SkinId[];
  value: SkinId;
  onPick: (id: SkinId) => void;
  className?: string; // extra class, e.g. "pause-skins"
};
```

## Implementation plan

1. Read `node_modules/next/dist/docs/` only if a Next API is needed (none expected). Create `components/skin-picker.tsx` with the radio group moved out of `game-player.tsx` (label `Aspecto`, `role="radiogroup"`, `aria-labelledby` from `useId`, `blur()` after a click). Use it in the HUD in place of the inline markup. Check: desktop HUD picker looks and behaves exactly as before.
2. Render a second `<SkinPicker className="pause-skins" />` inside the pause overlay (`{paused && ...}`), under the "PULSA REANUDAR" line, only when `skins` is defined. Add `pointer-events: auto` and keep the overlay `zIndex: 5`. Check: with a mouse the picker is not visible (CSS rule not added yet: hide it with `display: none` by default in step 3).
3. Add CSS in `app/globals.css`: `.pause-skins` is `display: none` by default and `display: flex` under `@media (pointer: coarse)`, centered, with margin above; options get `min-height: 44px` and slightly larger padding and font. Use `/frontend-design` for the final look. Check: with touch emulation at 390×844 and 360×640 the picker shows in the overlay, three options on one row, no horizontal overflow.
4. Confirm the overlay on touch does not hide behind the pad or the `.crt` clipping: the overlay sits inside `.crt-screen`, so verify it fits when the canvas is short (Tetris, Frogger at 360×640). If it does not fit, shrink spacing only for `.pause-skins` under `pointer: coarse`.
5. Verify with Playwright touch emulation on all five games (`/juegos/<id>/jugar`): pause, pick each skin, check the canvas repaints behind the overlay, resume, check the game keeps the skin; reload and check the choice persists. Check console for errors.
6. Update `CLAUDE.md` (Skins and touch bullets). Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] With a mouse (`pointer: fine`) the player page looks and behaves exactly as before: HUD picker visible, no picker in the pause overlay.
- [ ] With touch emulation the HUD still has no picker, and the pause overlay shows `Aspecto` with CLASSIC, NEON and RETRO for `asteroids`, `tetris`, `arkanoid`, `snake` and `frogger`.
- [ ] The current skin is the checked option (`aria-checked="true"`) when the overlay opens, including a skin saved earlier on desktop.
- [ ] Tapping an option while paused changes the canvas skin right away, the game stays paused, and the score and HUD values do not change.
- [ ] After resuming, the game keeps playing with the chosen skin.
- [ ] Reloading the page keeps the chosen skin (`localStorage` `av_skin_<id>` holds the id).
- [ ] Each option's tap target is at least 44px high and the three options fit in one row at 360×640 and 390×844, with no horizontal scroll.
- [ ] Tapping an option does not resume the game and does not fire a virtual key (the pad is disabled while paused).
- [ ] The overlay with the picker fits inside the canvas area on Tetris and Frogger at 360×640.
- [ ] The pad is still hidden on `pointer: fine` and the touch layout (no page scroll at 390×844 and 360×640) is unchanged.
- [ ] No console errors during a touch session on the five games.

## Decisions

- **Yes:** pick the skin from the pause overlay. Zero HUD cost, the game is already stopped, and the live repaint shows the result behind the overlay. **No:** third HUD line: no room, the reason SPEC 10 hid it.
- **No:** HUD button that opens a panel. Adds a fourth button to the HUD actions row, already tight at 360px.
- **No:** a cycle button (`classic` → `neon` → `retro`). The player cannot see the options, and it would change the skin mid-game.
- **Yes:** touch only, desktop untouched. **No:** also showing it in the desktop pause overlay: duplicates the HUD picker on screen.
- **Yes:** hide and show with `@media (pointer: coarse)`. **No:** JS detection: same reason as the pad, it avoids hydration mismatches.
- **Yes:** extract a shared `SkinPicker` component. **No:** copy the radio markup: two copies would drift.
- **Yes:** same `skin` state and `pickSkin`. **No:** a second storage path.
- **Yes:** show it when `definition.skins` exists. All five registered games define it today, so none is skipped; a future game without skins shows no picker.
- **Yes:** specs and code in English; UI strings in Spanish (`Aspecto`, `SKIN_LABELS` unchanged).

## Risks

| Risk                                                            | Mitigation                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Overlay too tall on short canvases (Tetris, Frogger at 360×640) | Step 4 checks it; compact spacing for `.pause-skins` under `pointer: coarse`.               |
| Dim overlay (`rgba(0,0,0,.6)`) hides the skin change behind it  | Accepted: the change is still visible; the player resumes to judge. No overlay change here. |
| A tap on an option also reaches the canvas or the pad           | Overlay is above the canvas; pad is `disabled` while paused (SPEC 10).                      |
| Two radio groups with the same `id` break `aria-labelledby`     | `useId` per instance.                                                                       |
| Stale `globals.css` in dev (OneDrive watching)                  | See CLAUDE.md gotcha: edit again or restart `npm run dev`.                                  |
| Skin saved while paused is lost if storage is blocked           | Same fallback as today: the choice lasts for this visit only.                               |

## What is **not** in this spec

- Any change to the desktop player or its HUD picker.
- A skin picker in the touch HUD or on any other page.
- Pad skins, new skins or new palettes.
- Skinning games that lack skins (none today).
- Account-level or database persistence of the skin.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
