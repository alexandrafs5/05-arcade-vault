# SPEC JAM-rana-02 — Road Crosser hazards and bonuses (sinking rafts, flies, fast bikes, extra lives)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, JAM-rana-01
> **Date:** 2026-11-16
> **Objective:** Extend ROAD CROSSER with sinking rafts, a bonus fly in the bays, a rare fast bike and score-based extra lives, so levels have variety and a high score has more routes to grow.

## Why this spec exists

JAM-rana-01 ships a complete but uniform game: the lanes only change speed. This spec adds the four things that make a run vary and give skilled players more points: a river lane whose platforms dive on a timer, a bonus fly that appears in the bays, a fast bike that crosses the road without warning but with a visible cue, and an extra life every 10,000 points.

It changes only `lib/games/rana/` and the existing catalog row's behaviour. It does not add a second catalog row, a migration, a cover, a HUD field or any asset, and it never touches the shell. The `lives`, `level` and `time` HUD fields from JAM-rana-01 stay as they are.

When promoted, this spec is numbered after the core spec and re-checked against the real engine files.

## Scope

**In:**

- Sinking rafts in lane row 3: the lane `kind` changes from `"log"` to `"raft"` in `lib/games/rana/lanes.ts` (same `dir`, `speed`, `width`, `count`, `offset` as in the core). A raft cycles through three phases: up (safe), warning (safe, drawn blinking) and under (not safe, drawn as a dark ripple).
  - `RAFT_PERIOD = 6` s; `RAFT_UP = 3.5` s; `RAFT_WARN = 1.0` s; the rest (1.5 s) is under.
  - Raft `i` of the lane has a phase offset of `i × 1.5` s, so raft phases are 0, 1.5, 3.0 and 4.5 s. At any time at least one raft is up.
  - A raft counts as a log for the river check only when it is up or in warning. A frog standing on a raft when it goes under drowns (1 life). A frog cannot land on an under raft: the river check fails.
  - The cycle is driven by `laneTime`, so it freezes on pause and never resets between frogs.
- Bonus fly:
  - A fly appears in one random empty bay when none is shown, every `FLY_EVERY = 8` s of `laneTime` while at least one bay is empty. It stays `FLY_LIFE = 4` s and then disappears; the next fly can appear `FLY_EVERY` s after the previous one disappeared or was eaten.
  - A frog that lands in the bay with the fly adds `SCORE_FLY = 200` points (on top of the normal +10 row, +50 bay and time bonus), and the fly disappears.
  - A fly in a bay never changes whether the bay is deadly: the bay rules are the same.
  - Level clear and `restart` remove any fly.
- Fast bike:
  - From level 2 on, a bike crosses one random road row (6–10) every `BIKE_EVERY = 12` s (±3 s random jitter, uniform).
  - Before it enters, a blinking magenta warning mark is drawn on the entry edge of that row for `BIKE_WARN = 1.0` s. The bike then crosses the canvas at `BIKE_SPEED = 8.0` cells per second; its speed does not use `speedMult`. Its direction is random per spawn.
  - Bike box: width 0.8 column, trimmed by `VEHICLE_INSET` like other vehicles; the collision rule is the same as for vehicles. At most one bike exists at a time; it is removed when it leaves the canvas.
  - The bike timer uses `laneTime`, runs only while `state` is `playing`, and starts again from `BIKE_EVERY` after `restart` and after a level clear.
- Extra lives: each time `score` reaches a new multiple of `EXTRA_LIFE_EVERY = 10000`, the player gets 1 life, up to `MAX_LIVES = 5`. A multiple reached while already at 5 lives is consumed without effect (no stored life). The HUD `lives` field shows the new value.
- Drawing for the new elements only: raft phases, fly sprite (vector), bike (vector, neon yellow `#ffd400`), warning mark. Existing core drawing is not changed.
- `CLAUDE.md` update: add a short line to the Games table row for `rana` (sinking rafts, fly, bike, extra life). No new row.

**Out of scope (for future specs):**

- More lane kinds (trains, crocodiles, otters, snakes).
- Sprites, spritesheets and image assets.
- Sound and music.
- A fourth HUD field (bonus, streak) or a new HUD format.
- Touch controls, mouse, gamepad, multiplayer.
- Difficulty selector and themes.
- Realtime scores, auth-linked scores.
- Automated tests.
- Any other game.

## Data model

No new tables, no new `localStorage` keys, no migration, no registry change. The catalog row `rana` from JAM-rana-01 is not touched. Snapshot and HUD fields are the same as in the core: `{ score, state, hud: { lives, level, time } }`.

```ts
// lib/games/rana/constants.ts (additions)
const RAFT_PERIOD = 6,
  RAFT_UP = 3.5,
  RAFT_WARN = 1.0,
  RAFT_STAGGER = 1.5; // seconds
const FLY_EVERY = 8,
  FLY_LIFE = 4; // seconds
const SCORE_FLY = 200;
const BIKE_EVERY = 12,
  BIKE_JITTER = 3; // seconds
const BIKE_WARN = 1.0,
  BIKE_SPEED = 8.0; // seconds, cells per second
const BIKE_WIDTH = 0.8,
  BIKE_MIN_LEVEL = 2;
const EXTRA_LIFE_EVERY = 10000,
  MAX_LIVES = 5;
```

```ts
// lib/games/rana/lanes.ts (change)
type LaneKind = "car" | "truck" | "log" | "raft";
// row 3 becomes:
// { row: 3, kind: "raft", dir: 1, speed: 2.0, width: 2, count: 4, offset: 1 }
```

Conventions:

- `raftPhase(i, laneTime) = (laneTime + i × RAFT_STAGGER) mod RAFT_PERIOD`. Up if phase < 3.5; warning if 3.5 ≤ phase < 4.5; under if phase ≥ 4.5.
- The fly and bike use `Math.random`; the lane layout stays deterministic.
- All time constants are in seconds on `laneTime`; nothing depends on frame rate.
- `lives` can now go above 3 but never above `MAX_LIVES = 5`; the initial value stays 3 (registry `initial` unchanged).
- Maximum frog score rises to 450 + 200 = 650 points per frog; the score clamp from the core (10,000,000) stays.

## Implementation plan

1. Add the new constants to `lib/games/rana/constants.ts` and the `"raft"` kind with the row 3 change in `lanes.ts`, plus `raftPhase`. Manual check: `npm run lint` and `npx tsc --noEmit` pass; the game plays as in the core, row 3 still carries the frog.
2. Engine: raft phases in the river check (up and warning are safe, under is not) and the raft drawing (blinking in warning, ripple when under). Manual check: stand on a raft in row 3 and watch it blink for 1.0 s, then drop the frog (1 life); another raft is always up.
3. Engine: extra lives (threshold on score changes, cap at 5). Manual check: with a temporary score of 9,950 in the debugger or by playing, the HUD gains 1 heart when the score reaches 10,000; at 5 hearts it stays at 5.
4. Engine: fly state (spawn timer, bay choice, lifetime, bonus on landing, removal on level clear and `restart`) and its drawing. Manual check: a fly shows in an empty bay every 8 s for 4 s; landing there adds 200 extra points.
5. Engine: bike state (timer, row, direction, warning mark, movement, collision, removal, level gate) and its drawing. Manual check: at level 1 no bike appears; at level 2 a warning blinks for 1.0 s and a bike crosses at 8 cells per second.
6. Update `CLAUDE.md`.
7. Run `npm run lint` and `npm run build`.

New canvas drawing only (raft, fly, bike, warning mark), no shell or CSS change, so no UI is designed in this spec. The vector drawings of the fly, bike and raft states are a visual detail: `/spec-impl` must use `/frontend-design` for them, per the project `CLAUDE.md`, and keep the neon palette of JAM-rana-01.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish with no errors.
- [ ] The `games` row `rana` is unchanged and no new migration file exists for this spec.
- [ ] Row 3 shows 4 rafts moving right at 2.0 cells/s (level 1), each 2 columns wide.
- [ ] A raft is safe for 3.5 s, blinks for 1.0 s (still safe) and is under for 1.5 s, in a 6 s cycle; the 4 rafts have phase offsets of 0, 1.5, 3.0 and 4.5 s.
- [ ] A frog standing on a raft that goes under loses exactly 1 life; a frog hopping onto an under raft loses exactly 1 life.
- [ ] At every moment at least 1 raft of row 3 is up or in warning.
- [ ] Pausing freezes the raft cycle; resuming does not skip a phase.
- [ ] A fly appears in a random empty bay 8 s after the last one disappeared, stays 4 s, and never appears when all 5 bays are filled.
- [ ] Landing in the bay with the fly adds exactly 200 points on top of 10 (row) + 50 (bay) + 10 × `floor(timeLeft)`, and the fly disappears.
- [ ] Landing in a filled bay or a hedge with a fly elsewhere still costs 1 life and gives no fly points.
- [ ] No fly exists after a level clear or after JUGAR DE NUEVO.
- [ ] At level 1 no bike appears during a 60 s session.
- [ ] From level 2, a bike crosses a random road row every 12 s ± 3 s; a blinking warning mark shows 1.0 s before it enters.
- [ ] The bike moves at 8.0 cells per second at level 2 and at level 11 (its speed ignores the level multiplier).
- [ ] Touching the bike costs exactly 1 life.
- [ ] At most 1 bike is on screen at any time.
- [ ] Reaching 10,000 points adds exactly 1 life (HUD hearts 4 when starting from 3); reaching 20,000 adds another.
- [ ] Lives never exceed 5: at 5 lives, reaching a new multiple of 10,000 does not change the HUD.
- [ ] Losing a life does not remove earned thresholds: dropping from 4 to 3 lives and regaining a threshold only happens at the next new multiple.
- [ ] The HUD fields remain `lives` (hearts), `level` (pad2) and `time` (number); the shell files are unchanged (`git diff` shows no change outside `lib/games/rana/` and `CLAUDE.md`).
- [ ] The game-over modal, FIN, pause, restart and score saving behave as in JAM-rana-01; the saved score is an integer between 0 and 10,000,000.
- [ ] JUGAR DE NUEVO resets lives to 3 and clears the fly, the bike, the raft clock and the extra-life counter.
- [ ] Leaving the page stops the loop: no console errors and window listeners are removed.
- [ ] `/juegos/asteroids/jugar`, `/juegos/tetris/jugar`, `/juegos/arkanoid/jugar` and `/juegos/snake/jugar` still play exactly as before.
- [ ] No console errors on `/juegos/rana/jugar` during a full session.

## Decisions

- **Yes:** only row 3 becomes sinking rafts; the other river rows stay logs. One diving lane adds timing without making the river unreadable. **No:** diving rafts in every lane.
- **Yes:** the raft cycle is staggered (1.5 s per raft) so at least one raft is always up. **No:** synchronized dives: they could close the lane entirely.
- **Yes:** a 1.0 s blinking warning before a raft goes under. **No:** instant sinking: it feels unfair.
- **Yes:** the fly adds a fixed +200 on top of the usual bay points. It is a risk-reward target, not a new rule. **No:** a multiplier or a bonus that depends on the time left.
- **Yes:** a fly never changes bay safety. **No:** treating a fly bay as deadly: it would punish the player for a bonus item.
- **Yes:** the bike only from level 2. Level 1 stays learnable. **No:** the bike at level 1.
- **Yes:** the bike has a fixed speed of 8.0 cells/s and a 1.0 s warning. The cue keeps the death avoidable. **No:** a bike with no warning, **No:** scaling the bike with `speedMult`.
- **Yes:** random fly and bike timing with `Math.random`. The lane layout stays deterministic; only these events vary. **No:** seeded randomness: it is not needed for a score chase.
- **Yes:** an extra life every 10,000 points with a cap of 5 lives. Rewards long runs and bounds the session length. **No:** unlimited lives.
- **Yes:** a threshold reached at the 5-life cap is consumed. **No:** banking extra lives: hidden state the HUD cannot show.
- **Yes:** the HUD fields do not change. **No:** a `bonus` field: it would need a shell change or an extra format.
- **Yes:** this spec is complete by itself on top of the core and never touches the shell. **No:** a second catalog row or a second migration.
- **Yes:** vector drawing, no assets. **No:** sprites: none fits the theme in `references/source-assets/`.
- **Yes:** engine behind `createEngine` and the registry; React only mounts it. **No:** a React state machine per frame.
- **Yes:** snapshot callbacks only on change. **No:** 60 re-renders per second.
- **Yes:** HUD and game-over overlay removed from the canvas. **No:** duplicates of what the shell shows.
- **Yes:** catalog row stays as inserted by the core spec. **No:** editing an applied migration.
- **Yes:** no fake data: no placeholder scores or "coming soon" rows.
- **Yes:** code and spec in English; UI strings in Spanish.

## Risks

| Risk                                                           | Mitigation                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Rafts, fly and bike clocks drift from pause or restart         | All use `laneTime`, which advances only with capped `dt` and is reset only in `restart`; resume uses `dt = 0`. |
| A frog carried on a raft is not saved when the raft goes under | Rule is explicit and drawn: 1.0 s blinking warning before the dive.                                            |
| A bike hit feels unfair at high levels                         | 1.0 s warning mark; bike speed is fixed; criterion checks it at level 11.                                      |
| Fly bonus makes the 200 points the dominant strategy           | 200 is under half of a frog's base maximum (450); the fly lasts 4 s of each 8 s cycle; tune only after play.   |
| Extra lives make sessions too long                             | Cap of 5 lives and 10,000-point steps; endless play is bounded by speed cap ×2.2 and the bike.                 |
| `hearts` format with more than 3 lives overflows the HUD       | Check `/juegos/rana/jugar` with 5 hearts at 375 px; if it overflows, fix with `/frontend-design`.              |
| Vector art for new elements does not match the core look       | Use the palette constants from JAM-rana-01 and `/frontend-design`.                                             |
| Game over fired twice (engine and FIN)                         | The shell ignores `onGameOver` when the modal is open.                                                         |
| Next.js 16 differs from training data                          | Read the relevant guide in `node_modules/next/dist/docs/` before touching routes or client components.         |

## What is **not** in this spec

- More lane kinds (trains, crocodiles, otters, snakes).
- Sprites and image assets.
- Sound and music.
- A fourth HUD field or a new HUD format.
- Touch controls, mouse, gamepad and multiplayer.
- Difficulty selector and themes.
- Realtime scores and auth-linked scores.
- Automated tests.
- Any other game.

Each one of those, if it lands, goes in its own spec.
