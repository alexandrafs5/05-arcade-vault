import type { EngineSnapshot, EngineState } from "../types";
import {
  BAYS,
  ROW_START,
  START_COL,
  START_LIVES,
  TURTLE_BLINK,
  TURTLE_VISIBLE,
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
    },
    // `dt` in seconds.
    update(dt: number) {
      if (over) return;
      clock += dt;
      advanceLanes(dt);
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
