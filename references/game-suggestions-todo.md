# Game suggestions To Do

Maintained by `@game-planner`. Do not delete entries; change their status.
Last update: 2026-11-16

## Pending

Ordered by priority (best fit first).

- [ ] **Space Invaders-style** (`invaders`) · SHOOTER · from scratch · effort M · suggested 2026-11-16
      Why: classic score-chase, unused `.cover-invaders` exists, keyboard only, waves give clear game over and replay value.
      Risk: SHOOTER already has Asteroids; needs original alien art (no licensed assets).

- [ ] **Road Crosser** (`rana`) · ARCADE · from scratch · effort M · suggested 2026-11-16
      Why: Frogger-style lane crossing, unused `.cover-rana`, arrow keys, hearts + level HUD, short sessions.
      Risk: ARCADE already has 2 games; scoring by rows/time bonus must be designed to stay integer.

- [ ] **Neon Pong** (`duelo`) · VERSUS · from scratch · effort S · suggested 2026-11-16
      Why: fills empty VERSUS category, unused `.cover-duelo`, mouse/keyboard, tiny scope; vs CPU with score = rally points.
      Risk: no real multiplayer exists; "VERSUS" is only CPU opponent, and the score may feel weak for ranking.

- [ ] **Neon Merge** (`merge`) · PUZZLE · cyan · from scratch · effort S · suggested 2026-11-16
      Why: 2048-style tile merging, score = merged sum, keyboard only, clear game over. HUD: best (`number`), moves (`number`). Needs a new `.cover-*` rule.
      Risk: 2048 clone look; use original art.

- [ ] **Air Hockey vs CPU** (`airhockey`) · VERSUS · cyan · from scratch · effort M · suggested 2026-11-16
      Why: mouse-driven puck duel vs CPU. HUD: goals (`number`), time (`number`). Needs a new `.cover-*` rule.
      Risk: overlaps `duelo`; pick one of the two first.

- [ ] **Neon Racer** (`neonrace`) · ARCADE · magenta · from scratch · effort M · suggested 2026-11-16
      Why: top-down lane dodging racer, keyboard, speed-based score. HUD: speed (`number`), lives (`hearts`). Needs a new `.cover-*` rule.
      Risk: keep it top-down, not pseudo-3D.

- [ ] **Neon Runner** (`runner`) · ARCADE · yellow · from scratch · effort S · suggested 2026-11-16
      Why: endless runner, one-key jump, score = distance. HUD: distance (`number`). Needs a new `.cover-*` rule.
      Risk: original look needed to avoid clone feel.

- [ ] **Missile Defense** (`missile-defense`) · SHOOTER · magenta · from scratch · effort M · suggested 2026-11-16
      Why: mouse-aimed intercepts, waves, SHOOTER variety beyond Asteroids. HUD: cities (`hearts`), wave (`pad2`). Needs a new `.cover-*` rule.
      Risk: mouse input; original art needed.

- [ ] **Shooting Gallery** (`gallery`) · SHOOTER · magenta · from scratch · effort S · suggested 2026-11-16
      Why: mouse target shooting, tiny scope, fast sessions. HUD: time (`number`), ammo (`number`). Needs a new `.cover-*` rule.
      Risk: low depth and replay value.

- [ ] **Mine Sweep** (`minesweeper`) · PUZZLE · green · from scratch · effort M · suggested 2026-11-16
      Why: minesweeper with time-based score, mouse. HUD: mines (`number`), time (`number`). Needs a new `.cover-*` rule.
      Risk: right-click needs `contextmenu` prevented, scoped to the canvas only.

- [ ] **Basket Shootout** (`hoops`) · ARCADE · yellow · from scratch · effort S · suggested 2026-11-16
      Why: timed basket shots, mouse/keyboard, score = baskets. HUD: balls (`number`), time (`number`). Needs a new `.cover-*` rule.
      Risk: shot physics tuning.

- [ ] **Bubble Burst** (`bubbles`) · PUZZLE · magenta · from scratch · effort M · suggested 2026-11-16
      Why: aim and match bubbles, mouse/keyboard. HUD: lives (`hearts`), level (`pad2`). Needs a new `.cover-*` rule.
      Risk: cluster flood fill and floating-bubble drop logic.

- [ ] **Gem Swap** (`gems`) · PUZZLE · yellow · from scratch · effort M · suggested 2026-11-16
      Why: match-3 with cascades, mouse, rich scoring. HUD: moves (`number`), level (`pad2`). Needs a new `.cover-*` rule.
      Risk: cascades and a reshuffle rule when no moves remain.

- [ ] **Twin-stick Arena** (`arena`) · SHOOTER · cyan · from scratch · effort M · suggested 2026-11-16
      Why: move with keys, aim and shoot with mouse, wave survival. HUD: lives (`hearts`), wave (`pad2`). Needs a new `.cover-*` rule.
      Risk: mouse and keyboard together; enemy balance.

- [ ] **Centipede-style** (`crawler`) · SHOOTER · green · from scratch · effort M · suggested 2026-11-16
      Why: segmented crawler descending a mushroom field. HUD: lives (`hearts`), level (`pad2`). Needs a new `.cover-*` rule.
      Risk: overlaps `invaders`; original art needed.

- [ ] **Neon Jump** (`jumper`) · ARCADE · cyan · from scratch · effort M · suggested 2026-11-16
      Why: Doodle-style vertical jumper, score = height, keyboard. HUD: height (`number`). Needs a new `.cover-*` rule.
      Risk: platform generation must keep every jump reachable.

- [ ] **Penalty Kick Duel** (`penalty`) · VERSUS · green · from scratch · effort S · suggested 2026-11-16
      Why: shoot and keep vs CPU, mouse. HUD: round (`pad2`), goals (`number`). Needs a new `.cover-*` rule.
      Risk: thin depth.

- [ ] **Meteor Dodge** (`dodge`) · ARCADE · magenta · from scratch · effort S · suggested 2026-11-16
      Why: dodge falling meteors, survival-time score, keyboard. HUD: lives (`hearts`), time (`number`). Needs a new `.cover-*` rule.
      Risk: overlaps `asteroids`.

- [ ] **Pipe Flyer** (`flappy`) · ARCADE · yellow · from scratch · effort S · suggested 2026-11-16
      Why: one-key flap through gaps, score = pipes passed. HUD: pipes (`number`). Needs a new `.cover-*` rule. Lower priority.
      Risk: abstract art needed to avoid clone look.

- [ ] **Cave Climber** (`climber`) · ARCADE · green · from scratch · effort M · suggested 2026-11-16
      Why: platform climbing with lives and levels. HUD: lives (`hearts`), level (`pad2`). Needs a new `.cover-*` rule. Lower priority.
      Risk: largest scope of the ARCADE candidates; level data needed.

- [ ] **Space Scroller** (`scramble`) · SHOOTER · yellow · from scratch · effort L · suggested 2026-11-16
      Why: side-scrolling shooter with fuel management. HUD: fuel (`number`), lives (`hearts`). Needs a new `.cover-*` rule. Lower priority.
      Risk: may exceed one spec.

- [ ] **Crate Push** (`sokoban`) · PUZZLE · green · from scratch · effort M · suggested 2026-11-16
      Why: box-pushing puzzle, keyboard, move-count score. HUD: moves (`number`), level (`pad2`). Needs a new `.cover-*` rule. Lower priority.
      Risk: weakest leaderboard fit (score is not a natural 0-10M integer).

- [ ] **Moto Drag Rush** (`dragrush`) · ARCADE · green · from scratch · effort S · suggested 2026-11-16
      Why: timed gear-shift drag races, keyboard. HUD: gear (`number`), lap (`pad2`). Needs a new `.cover-*` rule. Lower priority.
      Risk: repetitive gameplay.

## Rejected by user

_None._

## Discarded by agent

- **Pac-Man-style maze** (`glot`) · discarded 2026-11-16 · effort L (maze, ghost AI), too big for one spec; character identity close to licensed.
- **Any touch, sound or multiplayer game** · discarded 2026-11-16 · none exist on the platform yet; needs its own spec first.
- **Ports from `references/started-games/`** · discarded 2026-11-16 · folder is empty, no cheap port available.

## Implemented

- [x] **Asteroids** (`asteroids`) · SPEC 05
- [x] **Tetris** (`tetris`) · SPEC 07
- [x] **Arkanoid** (`arkanoid`) · SPEC 08
- [x] **Snake** (`snake`) · SPEC 09
