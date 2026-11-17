import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  BAYS,
  BAY_WIDTH,
  CELL,
  COLORS,
  COLS,
  DEATH_PAUSE,
  DIR_VEC,
  H,
  HOP_MS,
  KEY_TO_DIR,
  POINTS_BAY,
  POINTS_ROUND,
  POINTS_ROW,
  POINTS_TIME,
  ROW_GOALS,
  ROW_MEDIAN,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_START,
  START_COL,
  START_LIVES,
  TURTLE_BLINK,
  TURTLE_VISIBLE,
  VEHICLE_MARGIN,
  W,
  type Dir,
} from "./constants";
import {
  TURTLE_CYCLE,
  buildLanes,
  roundTime,
  type Lane,
  type LaneItem,
} from "./levels";

export type Frog = {
  col: number; // float: a log or turtle group carries it sideways
  row: number; // always an integer
};

// A hop in progress: the frog stays logically at its source cell until it lands.
export type Hop = {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  t: number; // seconds elapsed
};

export type TurtlePhase = "visible" | "blink" | "submerged";

// Game rules, no canvas and no timers. Everything lives in this closure.
function createGame() {
  let lanes: Lane[] = [];
  let frog: Frog = { col: START_COL, row: ROW_START };
  let bays: boolean[] = BAYS.map(() => false); // true = filled
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let timer = roundTime(1); // seconds left in the round
  let clock = 0; // seconds since the game began; drives the turtle cycle
  let over = false;
  let facing: Dir = "up";
  let hop: Hop | null = null;
  let pending: Dir | null = null; // one hop buffered while hopping
  let maxRow = ROW_START; // highest row reached since the last spawn after a bay
  let deathT = 0; // seconds left of the post-death pause (world frozen)
  let marker: { col: number; row: number } | null = null; // where the frog died

  const turtlePhase = (item: LaneItem): TurtlePhase => {
    const t = (clock + item.phase) % TURTLE_CYCLE;
    if (t >= TURTLE_VISIBLE) return "submerged";
    return t >= TURTLE_VISIBLE - TURTLE_BLINK ? "blink" : "visible";
  };

  // The lane of a river or road row, or undefined for the safe rows.
  const laneAt = (row: number) => lanes.find((l) => l.row === row);

  // The log or visible turtle group under the frog centre, if any.
  function supportAt(f: Frog): Lane | null {
    const lane = laneAt(f.row);
    if (!lane || lane.zone !== "river") return null;
    const cx = f.col + 0.5;
    const item = lane.items.find(
      (it) => cx >= it.col && cx < it.col + lane.width,
    );
    if (!item) return null;
    if (lane.kind === "turtle" && turtlePhase(item) === "submerged")
      return null;
    return lane;
  }

  // True when a vehicle of the frog's row overlaps its (shrunk) box.
  function hitByVehicle(f: Frog): boolean {
    const lane = laneAt(f.row);
    if (!lane || lane.zone !== "road") return false;
    const l = f.col + VEHICLE_MARGIN;
    const r = f.col + 1 - VEHICLE_MARGIN;
    return lane.items.some((it) => r > it.col && l < it.col + lane.width);
  }

  function spawnFrog() {
    frog = { col: START_COL, row: ROW_START };
    facing = "up";
    hop = null;
    pending = null;
    timer = roundTime(level);
  }

  // Costs a life; at 0 the game is over, otherwise the world pauses briefly.
  function kill() {
    marker = { col: frog.col, row: frog.row };
    hop = null;
    pending = null;
    lives = Math.max(0, lives - 1);
    if (lives === 0) {
      over = true;
      return;
    }
    deathT = DEATH_PAUSE;
  }

  // Frog lands on row 0: fill a free bay or die.
  function landOnGoal() {
    const cx = frog.col + 0.5;
    const i = BAYS.findIndex((b) => cx >= b && cx < b + BAY_WIDTH);
    if (i < 0 || bays[i]) {
      kill();
      return;
    }
    bays[i] = true;
    score += POINTS_BAY + Math.floor(timer) * POINTS_TIME;
    maxRow = ROW_START;
    if (bays.every(Boolean)) {
      score += POINTS_ROUND;
      level += 1;
      lanes = buildLanes(level);
      bays = BAYS.map(() => false);
    }
    spawnFrog();
  }

  // Starts a hop. Hops that would leave the board are ignored.
  function startHop(dir: Dir) {
    const v = DIR_VEC[dir];
    const toCol = frog.col + v.col;
    const toRow = frog.row + v.row;
    if (toCol < 0 || toCol > COLS - 1 || toRow < 0 || toRow > ROW_START) return;
    facing = dir;
    hop = { fromCol: frog.col, fromRow: frog.row, toCol, toRow, t: 0 };
  }

  // Lands the frog on its target cell and scores new rows.
  function land() {
    if (!hop) return;
    frog = { col: hop.toCol, row: hop.toRow };
    hop = null;
    if (frog.row < maxRow) {
      score += (maxRow - frog.row) * POINTS_ROW;
      maxRow = frog.row;
    }
    if (frog.row === ROW_GOALS) landOnGoal();
    else if (laneAt(frog.row)?.zone === "river" && !supportAt(frog)) kill();
  }

  // Moves every lane item along its lane; items re-enter from the opposite side.
  function advanceLanes(dt: number) {
    for (const lane of lanes) {
      const delta = lane.dir * lane.speed * dt;
      for (const item of lane.items) {
        item.col += delta;
        // Visible range is [-width, COLS); the loop is long enough for no pop-in.
        if (item.col >= lane.loop - lane.width) item.col -= lane.loop;
        else if (item.col < -lane.width) item.col += lane.loop;
      }
    }
  }

  return {
    reset() {
      level = 1;
      lanes = buildLanes(level);
      frog = { col: START_COL, row: ROW_START };
      bays = BAYS.map(() => false);
      score = 0;
      lives = START_LIVES;
      timer = roundTime(level);
      clock = 0;
      over = false;
      deathT = 0;
      marker = null;
      facing = "up";
      hop = null;
      pending = null;
      maxRow = ROW_START;
    },
    // One key press = one hop. While hopping, one extra press is buffered.
    turn(dir: Dir) {
      if (over || deathT > 0) return; // input is ignored while the world is frozen
      if (hop) {
        if (pending === null) pending = dir;
        return;
      }
      startHop(dir);
    },
    clearInput() {
      pending = null;
    },
    // `dt` in seconds.
    update(dt: number) {
      if (over) return;

      // Post-death pause: the world is frozen, then the frog respawns.
      if (deathT > 0) {
        deathT -= dt;
        if (deathT <= 0) {
          deathT = 0;
          marker = null;
          spawnFrog();
        }
        return;
      }

      clock += dt;
      advanceLanes(dt);

      // A log or turtle group carries the frog (and its hop target) sideways.
      const carrier = supportAt(frog);
      if (carrier) {
        const d = carrier.dir * carrier.speed * dt;
        frog.col += d;
        if (hop) {
          hop.fromCol += d;
          hop.toCol += d;
        }
      } else if (!hop && laneAt(frog.row)?.zone === "river") {
        kill(); // standing in the water, or the turtle sank under the frog
        return;
      }
      const cx = frog.col + 0.5;
      if (cx < 0 || cx > COLS) {
        kill(); // carried off the edge of the board
        return;
      }
      if (hitByVehicle(frog)) {
        kill();
        return;
      }

      timer -= dt;
      if (timer <= 0) {
        timer = 0;
        kill();
        return;
      }

      if (hop) {
        hop.t += dt;
        if (hop.t >= HOP_MS / 1000) {
          land();
          if (!over && deathT === 0 && pending) {
            const next = pending;
            pending = null;
            startHop(next);
          }
        }
      }
    },
    turtlePhase,
    get lanes() {
      return lanes;
    },
    get frog() {
      return frog;
    },
    get marker() {
      return marker;
    },
    get hop() {
      return hop;
    },
    get facing() {
      return facing;
    },
    get bays() {
      return bays;
    },
    get score() {
      return score;
    },
    get lives() {
      return lives;
    },
    get level() {
      return level;
    },
    get timer() {
      return timer;
    },
    get over() {
      return over;
    },
    // Snapshot fields the shell shows.
    snapshot(): EngineSnapshot {
      const state: EngineState = over ? "gameover" : "playing";
      return { score, state, hud: { lives, level } };
    },
  };
}

export const createEngine: CreateEngine = (canvas, cb) => {
  canvas.width = W;
  canvas.height = H;

  const game = createGame();
  let overReported = false;
  let lastSnap: EngineSnapshot | null = null;

  // onChange only when score, state or a hud value changes; onGameOver once per game.
  function emitIfChanged() {
    const snap = game.snapshot();
    if (
      lastSnap &&
      lastSnap.score === snap.score &&
      lastSnap.state === snap.state &&
      lastSnap.hud.lives === snap.hud.lives &&
      lastSnap.hud.level === snap.hud.level
    )
      return;
    lastSnap = snap;
    cb.onChange(snap);
    if (snap.state === "gameover" && !overReported) {
      overReported = true;
      cb.onGameOver(snap.score);
    }
  }

  const ctx = canvas.getContext("2d")!;
  let paused = false;
  let running = false;
  let rafId = 0;
  let lastTime: number | null = null; // null = next frame uses dt = 0
  let blinkOn = true; // turtle blink warning, toggled from the frame clock

  const px = (cells: number) => cells * CELL;

  function drawBackground() {
    // Goal row: walls, with the bays drawn on top.
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, W, px(1));
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      ctx.fillStyle = COLORS.river;
      ctx.fillRect(0, px(r), W, CELL);
      // Faint waves.
      ctx.strokeStyle = COLORS.riverWave;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = (r % 2) * 20; x < W; x += 80) {
        ctx.moveTo(x, px(r) + 10);
        ctx.quadraticCurveTo(x + 10, px(r) + 4, x + 20, px(r) + 10);
        ctx.moveTo(x + 40, px(r) + 30);
        ctx.quadraticCurveTo(x + 50, px(r) + 24, x + 60, px(r) + 30);
      }
      ctx.stroke();
    }
    for (const r of [ROW_MEDIAN, ROW_START]) {
      ctx.fillStyle = COLORS.safe;
      ctx.fillRect(0, px(r), W, CELL);
      ctx.fillStyle = COLORS.safeEdge;
      ctx.fillRect(0, px(r), W, 3);
    }
    for (let r = ROW_ROAD_TOP; r <= ROW_ROAD_BOT; r++) {
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, px(r), W, CELL);
    }
    // Dashed lane dividers between road lanes.
    ctx.strokeStyle = COLORS.roadDash;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 16]);
    ctx.beginPath();
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      ctx.moveTo(0, px(r));
      ctx.lineTo(W, px(r));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFrogShape(cx: number, cy: number, dir: Dir, scale: number) {
    const s = scale;
    ctx.save();
    ctx.translate(cx, cy);
    const angle = {
      up: 0,
      right: Math.PI / 2,
      down: Math.PI,
      left: -Math.PI / 2,
    }[dir];
    ctx.rotate(angle);
    // Legs.
    ctx.fillStyle = COLORS.frogDark;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * 13 * s, -8 * s, 4 * s, 7 * s, sx * 0.5, 0, Math.PI * 2);
      ctx.ellipse(
        sx * 13 * s,
        9 * s,
        4.5 * s,
        7 * s,
        -sx * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    // Body.
    ctx.fillStyle = COLORS.frog;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes.
    for (const sx of [-1, 1]) {
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath();
      ctx.arc(sx * 6 * s, -10 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.eyePupil;
      ctx.beginPath();
      ctx.arc(sx * 6 * s, -11 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBays() {
    for (let i = 0; i < BAYS.length; i++) {
      const x = px(BAYS[i]);
      const w = px(BAY_WIDTH);
      ctx.fillStyle = COLORS.bay;
      ctx.fillRect(x + 2, 2, w - 4, CELL - 4);
      ctx.strokeStyle = COLORS.bayBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, 2, w - 4, CELL - 4);
      if (game.bays[i]) drawFrogShape(x + w / 2, CELL / 2, "down", 1);
    }
  }

  function drawCar(
    x: number,
    y: number,
    w: number,
    dir: 1 | -1,
    variant: number,
  ) {
    ctx.fillStyle = COLORS.cars[variant % COLORS.cars.length];
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 8, w - 6, CELL - 16, 5);
    ctx.fill();
    // Windshield at the leading end.
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    const wx = dir === 1 ? x + w - 16 : x + 7;
    ctx.fillRect(wx, y + 12, 9, CELL - 24);
    ctx.fillStyle = COLORS.wheel;
    for (const wxp of [x + 8, x + w - 8]) {
      ctx.beginPath();
      ctx.arc(wxp, y + 8, 4, 0, Math.PI * 2);
      ctx.arc(wxp, y + CELL - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTruck(x: number, y: number, w: number, dir: 1 | -1) {
    const cabW = 20;
    const cabX = dir === 1 ? x + w - cabW - 2 : x + 2;
    const boxX = dir === 1 ? x + 2 : x + cabW + 2;
    ctx.fillStyle = COLORS.truck;
    ctx.fillRect(boxX, y + 6, w - cabW - 4, CELL - 12);
    ctx.fillStyle = COLORS.truckCab;
    ctx.beginPath();
    ctx.roundRect(cabX, y + 8, cabW, CELL - 16, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(dir === 1 ? cabX + cabW - 7 : cabX + 2, y + 12, 5, CELL - 24);
    ctx.fillStyle = COLORS.wheel;
    for (const wxp of [x + 12, x + w / 2, x + w - 12]) {
      ctx.beginPath();
      ctx.arc(wxp, y + 6, 4, 0, Math.PI * 2);
      ctx.arc(wxp, y + CELL - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLog(x: number, y: number, w: number) {
    ctx.fillStyle = COLORS.log;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 6, w - 4, CELL - 12, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.logGrain;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let gx = x + 14; gx < x + w - 10; gx += 22) {
      ctx.moveTo(gx, y + 12);
      ctx.lineTo(gx + 8, y + CELL - 12);
    }
    ctx.stroke();
  }

  function drawTurtles(x: number, y: number, count: number, phase: string) {
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (phase === "submerged") {
        ctx.strokeStyle = COLORS.turtleGhost;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      if (phase === "blink" && !blinkOn) continue;
      ctx.fillStyle = COLORS.turtle;
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.turtleShell;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.turtle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    }
  }

  function drawLanes() {
    for (const lane of game.lanes) {
      const y = px(lane.row);
      for (const item of lane.items) {
        const x = px(item.col);
        const w = px(lane.width);
        if (x + w < 0 || x > W) continue;
        if (lane.kind === "car") drawCar(x, y, w, lane.dir, item.variant);
        else if (lane.kind === "truck") drawTruck(x, y, w, lane.dir);
        else if (lane.kind === "log") drawLog(x, y, w);
        else drawTurtles(x, y, lane.width, game.turtlePhase(item));
      }
    }
  }

  function drawFrog() {
    const m = game.marker;
    if (m) {
      // Death marker where the frog died.
      const cx = px(m.col) + CELL / 2;
      const cy = px(m.row) + CELL / 2;
      ctx.strokeStyle = COLORS.marker;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 12);
      ctx.lineTo(cx + 12, cy + 12);
      ctx.moveTo(cx + 12, cy - 12);
      ctx.lineTo(cx - 12, cy + 12);
      ctx.stroke();
      ctx.lineCap = "butt";
      return;
    }
    const hop = game.hop;
    let col = game.frog.col;
    let row = game.frog.row;
    let scale = 1;
    if (hop) {
      const p = Math.min(1, hop.t / (HOP_MS / 1000));
      col = hop.fromCol + (hop.toCol - hop.fromCol) * p;
      row = hop.fromRow + (hop.toRow - hop.fromRow) * p;
      scale = 1 + 0.25 * Math.sin(p * Math.PI); // hop arc: frog looks lifted
    }
    drawFrogShape(px(col) + CELL / 2, px(row) + CELL / 2, game.facing, scale);
  }

  // Round timer: an 8 px strip along the bottom of the canvas.
  function drawTimer() {
    const ratio = Math.max(0, game.timer / roundTime(game.level));
    ctx.fillStyle =
      ratio > 0.5
        ? COLORS.timerOk
        : ratio > 0.25
          ? COLORS.timerWarn
          : COLORS.timerLow;
    ctx.fillRect(0, H - 8, W * ratio, 8);
  }

  function draw() {
    drawBackground();
    drawBays();
    drawLanes();
    drawFrog();
    drawTimer();
  }

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = paused ? null : ts;
    blinkOn = Math.floor(ts / 120) % 2 === 0;
    if (!paused) game.update(dt);
    emitIfChanged();
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function isTyping(e: KeyboardEvent) {
    const t = e.target;
    return (
      t instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(t.tagName)
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const d = KEY_TO_DIR[e.key.toLowerCase()];
    if (!d) return;
    if (e.key.startsWith("Arrow")) e.preventDefault(); // no page scroll
    if (paused || e.repeat) return; // one key press = one hop
    game.turn(d);
  }

  function clearInput() {
    game.clearInput();
  }

  game.reset();

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = null;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("blur", clearInput);
      emitIfChanged();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", clearInput);
      clearInput();
    },
    setPaused(p) {
      paused = p;
      lastTime = null;
      clearInput();
    },
    restart() {
      game.reset();
      overReported = false;
      lastSnap = null;
      lastTime = null;
      emitIfChanged();
    },
  };
};
