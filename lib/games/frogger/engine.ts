import type { CreateEngine, EngineSnapshot, EngineState } from "../types";
import {
  BAYS,
  BAY_WIDTH,
  CELL,
  PALETTES,
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

export const createEngine: CreateEngine = (canvas, cb, opts) => {
  let pal = PALETTES[opts?.skin ?? "classic"];
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
  let bgCache: HTMLCanvasElement | null = null; // static background, current skin

  const px = (cells: number) => cells * CELL;

  // Fills the current path. Classic and retro: flat fill. Neon: faint tinted fill
  // plus a glowing outline; the shadow is scoped by save/restore so it never leaks.
  function paint(color: string) {
    if (pal.style === "neon") {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = pal.glow;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  // Strokes the current path with glow in neon, plain otherwise.
  function strokeGlow(
    color: string,
    width: number,
    c: CanvasRenderingContext2D = ctx,
  ) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    if (pal.glow > 0) {
      c.shadowColor = color;
      c.shadowBlur = pal.glow;
    }
    c.stroke();
    c.restore();
  }

  // Corner radius: retro is all square corners.
  const rad = (r: number) => (pal.style === "retro" ? 0 : r);

  // Draws the static background onto `c` (the screen, or the offscreen cache).
  function drawBackground(c: CanvasRenderingContext2D) {
    const retro = pal.style === "retro";
    // Goal row: walls, with the bays drawn on top.
    c.fillStyle = pal.wall;
    c.fillRect(0, 0, W, px(1));
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      c.fillStyle = pal.river;
      c.fillRect(0, px(r), W, CELL);
      // Faint waves (retro: pixel dashes).
      if (retro) {
        c.fillStyle = pal.riverWave;
        for (let x = (r % 2) * 20; x < W; x += 80) {
          c.fillRect(x, px(r) + 8, 16, 4);
          c.fillRect(x + 40, px(r) + 28, 16, 4);
        }
        continue;
      }
      c.strokeStyle = pal.riverWave;
      c.lineWidth = 2;
      c.beginPath();
      for (let x = (r % 2) * 20; x < W; x += 80) {
        c.moveTo(x, px(r) + 10);
        c.quadraticCurveTo(x + 10, px(r) + 4, x + 20, px(r) + 10);
        c.moveTo(x + 40, px(r) + 30);
        c.quadraticCurveTo(x + 50, px(r) + 24, x + 60, px(r) + 30);
      }
      c.stroke();
    }
    for (const r of [ROW_MEDIAN, ROW_START]) {
      c.fillStyle = pal.safe;
      c.fillRect(0, px(r), W, CELL);
      if (pal.style === "neon") {
        // Glowing green edge line instead of a flat strip.
        c.beginPath();
        c.moveTo(0, px(r) + 1.5);
        c.lineTo(W, px(r) + 1.5);
        strokeGlow(pal.safeEdge, 3, c);
      } else {
        c.fillStyle = pal.safeEdge;
        c.fillRect(0, px(r), W, retro ? 4 : 3);
      }
    }
    for (let r = ROW_ROAD_TOP; r <= ROW_ROAD_BOT; r++) {
      c.fillStyle = pal.road;
      c.fillRect(0, px(r), W, CELL);
    }
    // Dashed lane dividers between road lanes.
    c.strokeStyle = pal.roadDash;
    c.lineWidth = pal.dashWidth;
    c.setLineDash([16, 16]);
    c.beginPath();
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      c.moveTo(0, px(r));
      c.lineTo(W, px(r));
    }
    c.stroke();
    c.setLineDash([]);
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
    if (pal.style === "retro") {
      // Blocky pixel frog.
      ctx.fillStyle = pal.frogDark;
      for (const sx of [-1, 1]) {
        ctx.fillRect(sx * 14 * s - 4 * s, -14 * s, 8 * s, 10 * s);
        ctx.fillRect(sx * 14 * s - 4 * s, 4 * s, 8 * s, 10 * s);
      }
      ctx.fillStyle = pal.frog;
      ctx.fillRect(-10 * s, -12 * s, 20 * s, 26 * s);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = pal.eyeWhite;
        ctx.fillRect(sx * 6 * s - 3 * s, -12 * s, 6 * s, 6 * s);
        ctx.fillStyle = pal.eyePupil;
        ctx.fillRect(sx * 6 * s - 1 * s, -11 * s, 2 * s, 2 * s);
      }
      ctx.restore();
      return;
    }
    // Legs: both sides in one path (one glowing stroke in neon).
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      // New sub-path, so no line joins the two sides.
      ctx.moveTo(
        sx * 13 * s + 4 * s * Math.cos(sx * 0.5),
        -8 * s + 4 * s * Math.sin(sx * 0.5),
      );
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
    }
    paint(pal.frogDark);
    // Body.
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * s, 14 * s, 0, 0, Math.PI * 2);
    paint(pal.frog);
    // Eyes.
    for (const sx of [-1, 1]) {
      ctx.fillStyle = pal.eyeWhite;
      ctx.beginPath();
      ctx.arc(sx * 6 * s, -10 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.eyePupil;
      ctx.beginPath();
      ctx.arc(sx * 6 * s, -11 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBays() {
    const w = px(BAY_WIDTH);
    ctx.fillStyle = pal.style === "neon" ? pal.wall : pal.bay;
    for (let i = 0; i < BAYS.length; i++) {
      ctx.fillRect(px(BAYS[i]) + 2, 2, w - 4, CELL - 4);
    }
    // All five borders in one path: one glowing stroke.
    ctx.beginPath();
    for (let i = 0; i < BAYS.length; i++) {
      ctx.rect(px(BAYS[i]) + 2, 2, w - 4, CELL - 4);
    }
    strokeGlow(pal.bayBorder, pal.style === "retro" ? 4 : 3);
    for (let i = 0; i < BAYS.length; i++) {
      if (game.bays[i]) drawFrogShape(px(BAYS[i]) + w / 2, CELL / 2, "down", 1);
    }
  }

  // Car and truck are split into body paths (added to the current path) and
  // details (windshield, wheels), so neon can batch all bodies of one color.
  function carBody(x: number, y: number, w: number) {
    ctx.roundRect(x + 3, y + 8, w - 6, CELL - 16, rad(5));
  }

  function carDetails(x: number, y: number, w: number, dir: 1 | -1) {
    // Windshield at the leading end.
    ctx.fillStyle = pal.windshield;
    const wx = dir === 1 ? x + w - 16 : x + 7;
    ctx.fillRect(wx, y + 12, 9, CELL - 24);
    ctx.fillStyle = pal.wheel;
    for (const wxp of [x + 8, x + w - 8]) {
      if (pal.style === "retro") {
        ctx.fillRect(wxp - 4, y + 4, 8, 6);
        ctx.fillRect(wxp - 4, y + CELL - 10, 8, 6);
        continue;
      }
      ctx.beginPath();
      ctx.arc(wxp, y + 8, 4, 0, Math.PI * 2);
      ctx.arc(wxp, y + CELL - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const CAB_W = 20;

  function truckBox(x: number, y: number, w: number, dir: 1 | -1) {
    const boxX = dir === 1 ? x + 2 : x + CAB_W + 2;
    ctx.rect(boxX, y + 6, w - CAB_W - 4, CELL - 12);
  }

  function truckCabPath(x: number, y: number, w: number, dir: 1 | -1) {
    const cabX = dir === 1 ? x + w - CAB_W - 2 : x + 2;
    ctx.roundRect(cabX, y + 8, CAB_W, CELL - 16, rad(4));
  }

  function truckDetails(x: number, y: number, w: number, dir: 1 | -1) {
    const cabX = dir === 1 ? x + w - CAB_W - 2 : x + 2;
    ctx.fillStyle = pal.windshield;
    ctx.fillRect(dir === 1 ? cabX + CAB_W - 7 : cabX + 2, y + 12, 5, CELL - 24);
    ctx.fillStyle = pal.wheel;
    for (const wxp of [x + 12, x + w / 2, x + w - 12]) {
      if (pal.style === "retro") {
        ctx.fillRect(wxp - 4, y + 2, 8, 6);
        ctx.fillRect(wxp - 4, y + CELL - 8, 8, 6);
        continue;
      }
      ctx.beginPath();
      ctx.arc(wxp, y + 6, 4, 0, Math.PI * 2);
      ctx.arc(wxp, y + CELL - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(
    x: number,
    y: number,
    w: number,
    dir: 1 | -1,
    variant: number,
  ) {
    ctx.beginPath();
    carBody(x, y, w);
    paint(pal.cars[variant % pal.cars.length]);
    carDetails(x, y, w, dir);
  }

  function drawTruck(x: number, y: number, w: number, dir: 1 | -1) {
    ctx.beginPath();
    truckBox(x, y, w, dir);
    paint(pal.truck);
    ctx.beginPath();
    truckCabPath(x, y, w, dir);
    paint(pal.truckCab);
    truckDetails(x, y, w, dir);
  }

  // Neon road: one path and one glowing stroke per lane and color instead of
  // one per vehicle (a shadow over a whole-canvas path costs more than small
  // ones, so groups stay within one lane); details are drawn afterwards.
  function drawRoadNeon() {
    const nCars = pal.cars.length;
    for (const lane of game.lanes) {
      if (lane.kind !== "car" && lane.kind !== "truck") continue;
      const y = px(lane.row);
      const w = px(lane.width);
      if (lane.kind === "car") {
        for (let v = 0; v < nCars; v++) {
          ctx.beginPath();
          let any = false;
          for (const item of lane.items) {
            if (item.variant % nCars !== v) continue;
            const x = px(item.col);
            if (x + w < 0 || x > W) continue;
            carBody(x, y, w);
            any = true;
          }
          if (any) paint(pal.cars[v]);
        }
      } else {
        for (let part = 0; part < 2; part++) {
          ctx.beginPath();
          let any = false;
          for (const item of lane.items) {
            const x = px(item.col);
            if (x + w < 0 || x > W) continue;
            if (part === 0) truckBox(x, y, w, lane.dir);
            else truckCabPath(x, y, w, lane.dir);
            any = true;
          }
          if (any) paint(part === 0 ? pal.truck : pal.truckCab);
        }
      }
      for (const item of lane.items) {
        const x = px(item.col);
        if (x + w < 0 || x > W) continue;
        if (lane.kind === "car") carDetails(x, y, w, lane.dir);
        else truckDetails(x, y, w, lane.dir);
      }
    }
  }

  function drawLog(x: number, y: number, w: number) {
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 6, w - 4, CELL - 12, rad(8));
    paint(pal.log);
    ctx.strokeStyle = pal.logGrain;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let gx = x + 14; gx < x + w - 10; gx += 22) {
      ctx.moveTo(gx, y + 12);
      ctx.lineTo(gx + 8, y + CELL - 12);
    }
    ctx.stroke();
  }

  function drawTurtles(x: number, y: number, count: number, phase: string) {
    const retro = pal.style === "retro";
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (phase === "submerged") {
        ctx.strokeStyle = pal.turtleGhost;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (retro) ctx.rect(cx - 12, cy - 12, 24, 24);
        else ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      if (phase === "blink" && !blinkOn) continue;
      if (retro) {
        ctx.fillStyle = pal.turtle;
        ctx.fillRect(cx - 14, cy - 14, 28, 28);
        ctx.fillStyle = pal.turtleShell;
        ctx.fillRect(cx - 8, cy - 8, 16, 16);
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      paint(pal.turtle);
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      paint(pal.turtleShell);
      ctx.strokeStyle = pal.turtle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    }
  }

  // Neon river: per lane, one path and one glowing stroke for all logs, or
  // for each turtle pass (outer ring, inner ring), then the plain strokes.
  function drawRiverNeon() {
    for (const lane of game.lanes) {
      const y = px(lane.row);
      const w = px(lane.width);
      if (lane.kind === "log") {
        ctx.beginPath();
        for (const item of lane.items) {
          const x = px(item.col);
          if (x + w < 0 || x > W) continue;
          ctx.roundRect(x + 2, y + 6, w - 4, CELL - 12, rad(8));
        }
        paint(pal.log);
        ctx.strokeStyle = pal.logGrain;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const item of lane.items) {
          const x = px(item.col);
          if (x + w < 0 || x > W) continue;
          for (let gx = x + 14; gx < x + w - 10; gx += 22) {
            ctx.moveTo(gx, y + 12);
            ctx.lineTo(gx + 8, y + CELL - 12);
          }
        }
        ctx.stroke();
      } else if (lane.kind === "turtle") {
        // Passes: 0 outer ring, 1 inner ring, 2 cross, 3 submerged ghost.
        for (let pass = 0; pass < 4; pass++) {
          ctx.beginPath();
          let any = false;
          for (const item of lane.items) {
            const x = px(item.col);
            if (x + w < 0 || x > W) continue;
            const phase = game.turtlePhase(item);
            const submerged = phase === "submerged";
            if (pass === 3 ? !submerged : submerged) continue;
            if (phase === "blink" && !blinkOn) continue;
            for (let i = 0; i < lane.width; i++) {
              const cx = x + i * CELL + CELL / 2;
              const cy = y + CELL / 2;
              if (pass === 0) {
                ctx.moveTo(cx + 15, cy);
                ctx.arc(cx, cy, 15, 0, Math.PI * 2);
              } else if (pass === 1) {
                ctx.moveTo(cx + 10, cy);
                ctx.arc(cx, cy, 10, 0, Math.PI * 2);
              } else if (pass === 2) {
                ctx.moveTo(cx - 10, cy);
                ctx.lineTo(cx + 10, cy);
                ctx.moveTo(cx, cy - 10);
                ctx.lineTo(cx, cy + 10);
              } else {
                ctx.moveTo(cx + 13, cy);
                ctx.arc(cx, cy, 13, 0, Math.PI * 2);
              }
              any = true;
            }
          }
          if (!any) continue;
          if (pass === 0) paint(pal.turtle);
          else if (pass === 1) paint(pal.turtleShell);
          else {
            ctx.strokeStyle = pass === 2 ? pal.turtle : pal.turtleGhost;
            ctx.lineWidth = pass === 2 ? 1.5 : 2;
            ctx.stroke();
          }
        }
      }
    }
  }

  function drawLanes() {
    const neon = pal.style === "neon";
    if (neon) {
      drawRoadNeon();
      drawRiverNeon();
      return;
    }
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
      ctx.lineCap = pal.style === "retro" ? "butt" : "round";
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 12);
      ctx.lineTo(cx + 12, cy + 12);
      ctx.moveTo(cx + 12, cy - 12);
      ctx.lineTo(cx - 12, cy + 12);
      strokeGlow(pal.marker, 5);
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
      ratio > 0.5 ? pal.timerOk : ratio > 0.25 ? pal.timerWarn : pal.timerLow;
    ctx.fillRect(0, H - 8, W * ratio, 8);
  }

  // Neon only for now: the static background is drawn once into an offscreen
  // canvas (never attached to the DOM) and blitted each frame.
  function blitBackground() {
    if (pal.style !== "neon") {
      drawBackground(ctx);
      return;
    }
    if (!bgCache) {
      bgCache = document.createElement("canvas");
      bgCache.width = W;
      bgCache.height = H;
      drawBackground(bgCache.getContext("2d")!);
    }
    ctx.drawImage(bgCache, 0, 0);
  }

  function draw() {
    blitBackground();
    drawBays();
    drawLanes();
    drawFrog();
    drawTimer();
  }

  function frame(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = paused ? null : ts;
    if (!paused) {
      blinkOn = Math.floor(ts / 120) % 2 === 0; // frozen while paused
      game.update(dt);
    }
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
    setSkin(skin) {
      pal = PALETTES[skin];
      bgCache = null; // rebuilt lazily on the next draw
      if (paused) draw(); // the loop keeps drawing, this just repaints at once
    },
    setPaused(p) {
      paused = p;
      lastTime = null;
      clearInput();
    },
    restart() {
      game.reset();
      bgCache = null;
      overReported = false;
      lastSnap = null;
      lastTime = null;
      emitIfChanged();
    },
  };
};
