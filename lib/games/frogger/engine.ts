import type { EngineSnapshot, EngineState } from "../types";
import {
  BAYS,
  BAY_WIDTH,
  COLS,
  DEATH_PAUSE,
  DIR_VEC,
  HOP_MS,
  POINTS_BAY,
  POINTS_ROUND,
  POINTS_ROW,
  POINTS_TIME,
  ROW_GOALS,
  ROW_START,
  START_COL,
  START_LIVES,
  TURTLE_BLINK,
  TURTLE_VISIBLE,
  VEHICLE_MARGIN,
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
export function createGame() {
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
