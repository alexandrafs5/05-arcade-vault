import type { EngineSnapshot, EngineState } from "../types";
import {
  BAYS,
  COLS,
  DIR_VEC,
  HOP_MS,
  POINTS_ROW,
  ROW_START,
  START_COL,
  START_LIVES,
  TURTLE_BLINK,
  TURTLE_VISIBLE,
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
      facing = "up";
      hop = null;
      pending = null;
      maxRow = ROW_START;
    },
    // One key press = one hop. While hopping, one extra press is buffered.
    turn(dir: Dir) {
      if (over) return;
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
      clock += dt;
      advanceLanes(dt);
      if (hop) {
        hop.t += dt;
        if (hop.t >= HOP_MS / 1000) {
          land();
          if (pending) {
            const next = pending;
            pending = null;
            startHop(next);
          }
        }
      }
    },
    // Turtle group state from the global clock and the group's phase offset.
    turtlePhase(item: LaneItem): TurtlePhase {
      const t = (clock + item.phase) % TURTLE_CYCLE;
      if (t >= TURTLE_VISIBLE) return "submerged";
      return t >= TURTLE_VISIBLE - TURTLE_BLINK ? "blink" : "visible";
    },
    get lanes() {
      return lanes;
    },
    get frog() {
      return frog;
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
