# SPEC 11 — Gamepad MK-II redesign

> **Status:** Implemented
> **Depends on:** SPEC 10
> **Date:** 2026-11-17
> **Objective:** Restyle the on-screen touch gamepad to the "Gamepad MK-II" neon design from `references/gamepad-assets/`, without changing which keys it sends or how the player page is laid out.

## Why this spec exists

SPEC 10 shipped a working but plain pad: flat dark keys, a Famicom-style staggered B/A in yellow and magenta. The user supplied a reference design (`references/gamepad-assets/gamepad.html`, screenshot `gamepad-neon.png`): a console shell with an inner neon border and dot texture, raised 3D d-pad keys with a hub and a pulsing cyan gem, and two glossy round buttons (B cyan, A magenta) on one line with a dashed press ring. This spec ports that look into the real component and CSS.

The reference is a standalone page that also reads the keyboard and uses `pointerleave` to clear the lit state. The real pad already has stronger input logic (pointer capture, held-key map, release-all). That logic stays. Only the visuals and the "lit" state change.

## Scope

**In:**

- Restyle `.av-pad` and its parts in `app/globals.css` to the MK-II design:
  - Shell: vertical dark gradient, rounded corners, 1px `--line` border, outer glow, inset highlights, an inner neon border (`::before`) and a dot-grid texture (`::after`), both `pointer-events: none`.
  - D-pad: four raised keys (gradient fill, bottom "step" shadow, inner highlight) around a center hub with a cyan diamond gem that pulses. Arrows are SVG triangles from the reference (or the CSS triangles already in use, if they look identical at pad size).
  - A/B: round glossy buttons (radial highlight plus colored radial body, 2px colored border, glow, bottom step shadow), Press Start 2P letter with neon text shadow, dashed ring that shows on press.
  - Colors: B cyan (`--cyan`), A magenta (`--magenta`). Yellow is no longer used by the pad.
  - Layout: d-pad on the left, B then A side by side on one line on the right, vertically centered (no stagger).
- Pressed look: a key is lit (`on` state) while its virtual key is held. Lit d-pad key: pushed down 3px, cyan border, cyan inner and outer glow, arrow drop-shadow. Lit A/B: pushed down 4px and scaled to 0.97, stronger glow, ring at full opacity.
- Lit state comes from JS, not `:active`: `components/touch-controls.tsx` keeps the set of lit codes and adds a data attribute (`data-on`) to the matching button. It survives pointer capture and sliding off a button.
- Keyboard highlight: the same lit state also follows physical `keydown` / `keyup` for the codes the pad sends (the four arrows, plus the `code` of A and B in the current game). Virtual events dispatched on `window` use the same path, so one listener covers both. Lit state is cleared on `blur`, on `disabled` and on unmount.
- Idle buttons (no action in this game) keep the SPEC 10 rule: same shape, dimmed, inert, never lit.
- Compact sizing for phones: reference mobile sizes as the base (d-pad 144px, d-pad keys 46px, A/B 64px, gap 16px), scaled down with `vw` / `dvh` clamps so that canvas, HUD and pad still fit with no page scroll at 390×844 and 360×640.
- Reduced motion: the gem pulse and the key transitions are off under `prefers-reduced-motion: reduce`.
- The pad stays hidden on `pointer: fine` and shown on `pointer: coarse` (no change to the CSS-only visibility rule).
- `CLAUDE.md`: update the touch-controls bullet (lit state, keyboard highlight) in one or two lines.

**Out of scope (for future specs):**

- Changing the key mapping, the registry `touch` field or `lib/games/types.ts`.
- Changing the player page touch layout, HUD, nav or footer rules from SPEC 10, except the pad's own height and margins.
- WASD / `Z` / `X` / `J` / `K` aliases from the reference: engines do not read them, so the pad does not show them.
- Per-skin pad themes (the pad does not follow `classic` / `neon` / `retro`).
- Vibration, sound, pad customization, left-handed layout.
- Showing the pad on desktop.
- Copying `gamepad.html` or the PNG into the app. The reference folder stays read-only.
- Automated tests.

## Data model

No new data, tables or `localStorage` keys. No change to `TouchAction`, `TouchConfig` or the registry.

Component-local state only, in `components/touch-controls.tsx`:

```ts
// codes of the keys currently lit (held by finger or by physical keyboard)
const [lit, setLit] = useState<ReadonlySet<string>>(() => new Set());
```

- A button is lit when its `action.code` (or d-pad code) is in `lit`. It renders `data-on="true"` and the CSS styles `[data-on]`.
- The listener is a single pair of `window` `keydown` / `keyup` handlers, registered in an effect. It ignores codes the pad does not own and ignores `e.repeat`.
- `held` (the ref of virtual keys, SPEC 10) is unchanged and remains the only record of what the pad itself pressed.

## Implementation plan

1. Read the reference (`gamepad.html`, `gamepad-neon.png`) and the current `.av-pad` block in `app/globals.css`. Use `/frontend-design` to settle the final sizes, then write the new design. Check: nothing yet.
2. Rewrite the shell, d-pad and hub styles in `app/globals.css` (`.av-pad`, `.pad-dpad`, `.pad-btn` and the direction classes), including `::before` / `::after` on the shell, the hub and the gem. Add `@keyframes` for the gem pulse. Keep `display: none` by default and `display: flex` under `@media (pointer: coarse)`. Check: with touch emulation the d-pad matches `gamepad-neon.png`; desktop unchanged.
3. Rewrite the A/B styles: remove the stagger and the yellow, add glossy fill, glow, letter shadow and the dashed ring. Keep the dimmed `[data-idle]` rule. Check: B cyan and A magenta, same line, dimmed state still readable.
4. Add the lit styles on `[data-on]` for d-pad keys and A/B, and remove the `:active`-only rules they replace (keep `:active` as a fallback only if it does not conflict). Check: styles compile; lint passes.
5. Update `components/touch-controls.tsx`: add the `lit` state and the window `keydown` / `keyup` listener, set `data-on` on buttons, add the ring `<span>` and the hub / gem elements as `aria-hidden`. Do not touch `press`, `release`, `releaseAll` or `bind`. Check: `npx tsc --noEmit` and `npm run lint` pass.
6. Tune sizes: apply `vw` / `dvh` clamps and the reduced-motion rule. Check with Playwright touch emulation at 390×844 and 360×640 on `/juegos/asteroids/jugar`, `/tetris`, `/arkanoid` and `/snake`: no page scroll, canvas still visible and playable.
7. Verify behaviour with Playwright: press each arrow, A and B and confirm `data-on` toggles and the game reacts; hold and slide off; pause and confirm the lit state clears. Take one screenshot per game and compare with `gamepad-neon.png`.
8. Update `CLAUDE.md` (touch controls bullet). Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [x] `npm run lint` and `npm run build` finish with no errors.
- [x] With a mouse (`pointer: fine`) the player page of the four games looks exactly as before: no pad visible.
- [x] With touch emulation at 390×844 the pad under the canvas matches `references/gamepad-assets/gamepad-neon.png` in structure: shell with inner border and dot texture, four raised d-pad keys, center hub with a cyan gem, B (cyan) and A (magenta) side by side on one line.
- [x] The gem pulses; under `prefers-reduced-motion: reduce` it does not animate.
- [x] Holding a d-pad key or A/B lights it (pushed down, glow); releasing, sliding off then lifting, pause, game over, tab switch and unmount all return it to unlit.
- [x] Pressing a physical key the pad owns (arrows; `Space` in Asteroids and Tetris; `KeyX` in Tetris) lights the matching pad key and unlights it on release.
- [x] Buttons with no action in a game stay dimmed, never light up, and do nothing when pressed.
- [x] Key mapping is unchanged: Asteroids (rotate, thrust, A fires), Tetris (move, soft drop, rotate, A hard drop, B rotates), Arkanoid (paddle), Snake (four directions) all behave as in SPEC 10.
- [x] Two fingers at once still work (a direction and A in Asteroids).
- [x] With touch emulation at 390×844 and at 360×640, canvas, HUD and pad fit with no vertical page scroll on all four games, Tetris included.
- [x] Long-press on a pad button shows no context menu or text selection; the pad does not scroll or zoom the page.
- [x] Keyboard play on desktop and typing the name in the game-over `INPUT` still work.
- [x] No console errors on the four player pages during a touch session.

## Decisions

- **Yes:** visual redesign only; input logic from SPEC 10 untouched. **No:** rewrite the component around the reference script: it uses `pointerleave` and has no held-key map, which would bring back stuck keys.
- **Yes:** follow the reference layout (B left, A right, one line, B cyan). **No:** keep the Famicom stagger and yellow B: the user chose the reference look.
- **Yes:** lit state from JS (`data-on`). **No:** rely on `:active`: with pointer capture and sliding it can disagree with the real held key.
- **Yes:** one `window` key listener drives both physical and virtual highlight. **No:** two paths (one for pointer, one for keyboard): would duplicate state.
- **Yes:** highlight only the codes the pad actually sends. **No:** reference aliases WASD / Z / X / J / K: engines ignore them, so the highlight would lie.
- **Yes:** compact sizes with `vw` / `dvh` clamps. **No:** exact reference sizes (about 230px tall): they break the 360×640 criterion of SPEC 10.
- **Yes:** `[data-on]` attribute plus CSS. **No:** extra CSS classes toggled from JS: a data attribute matches the existing `data-idle`.
- **Yes:** keep the pad independent of game skins. **No:** per-skin pad themes: separate spec.
- **Yes:** keep `references/gamepad-assets/` read-only and port the CSS by hand. **No:** import the standalone HTML.
- **Yes:** specs and code in English; UI strings in Spanish (aria-labels unchanged).

## Risks

| Risk                                                                       | Mitigation                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pad grows taller and squeezes the canvas, mostly Tetris at 360×640         | Clamp sizes with `vw` / `dvh`; step 6 and acceptance check both viewports.                        |
| `::before` / `::after` overlays eat touches                                | `pointer-events: none` on both; shell content has `position: relative; z-index: 1`.               |
| Lit state gets stuck if a `keyup` is missed (focus change)                 | Clear `lit` on `blur`, on `disabled` and on unmount, same places as `releaseAll`.                 |
| Re-render on every key event                                               | State is local to the pad and tiny; no engine or shell re-render.                                 |
| Glow, gradients and a looping animation cost GPU on low-end phones         | Only the gem animates; shadows are static; animation off under reduced motion.                    |
| Stale `globals.css` in dev (OneDrive watching)                             | See CLAUDE.md gotcha: edit again or restart `npm run dev` if CSS does not update.                 |
| Physical `Space` / arrows also scroll or act on the page while highlighted | The listener only reads events and never calls `preventDefault`; engines keep their own handling. |

## What is **not** in this spec

- New key mappings, new buttons or a pause button on the pad.
- Per-skin pad themes.
- Vibration and sound.
- Pad customization (size, side, left-handed).
- Desktop pad.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
