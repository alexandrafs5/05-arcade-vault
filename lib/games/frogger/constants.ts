// Frogger constants. 16x14 board, discrete hops, road + river + 5 goal bays.

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40;

// Logic canvas size in px. Origin top-left; cell (col, row) draws at (col * CELL, row * CELL).
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560

// Row layout, 0 = top.
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_MEDIAN = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

// Duration of one hop, in ms. The engine converts it to seconds.
export const HOP_MS = 120;

export const START_LIVES = 3;
export const START_COL = 7;

// First column of each 2-cell bay on row 0. The cells between bays are walls.
export const BAYS = [1, 4, 7, 10, 13] as const;
export const BAY_WIDTH = 2;

// Round timer in seconds: 15 at level 1, minus 1 per level, never below the minimum.
export const TIMER_START = 15;
export const TIMER_MIN = 8;

// Seconds the world stays frozen after a death (internal flag, not an engine state).
export const DEATH_PAUSE = 0.4;

// Lane speeds grow x1.15 per level, capped.
export const SPEED_GROWTH = 1.15;
export const SPEED_CAP = 2.5;

// Turtle groups: seconds visible, submerged, and the blink warning at the end of the visible phase.
export const TURTLE_VISIBLE = 3;
export const TURTLE_SUBMERGED = 1.5;
export const TURTLE_BLINK = 0.5;

// Every lane loops around at least this many cells so entities wrap with no pop-in
// (board width 16 + widest entity 4).
export const MIN_LOOP = 20;

// Vehicle hit box is shrunk by this many cells on each side.
export const VEHICLE_MARGIN = 0.15;

// Points.
export const POINTS_ROW = 10;
export const POINTS_BAY = 50;
export const POINTS_TIME = 10; // per remaining second, on filling a bay
export const POINTS_ROUND = 200;

export type Dir = "up" | "down" | "left" | "right";

// KeyboardEvent.key (lowercased for letters) to direction.
export const KEY_TO_DIR: Record<string, Dir> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export const DIR_VEC: Record<Dir, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

export type Palette = {
  road: string;
  roadDash: string;
  river: string;
  riverWave: string;
  safe: string;
  safeEdge: string;
  bay: string;
  bayBorder: string;
  wall: string;
  frog: string;
  frogDark: string;
  eyeWhite: string;
  eyePupil: string;
  log: string;
  logGrain: string;
  turtle: string;
  turtleShell: string;
  turtleGhost: string;
  cars: readonly string[];
  truck: string;
  truckCab: string;
  wheel: string;
  marker: string;
  timerOk: string;
  timerWarn: string;
  timerLow: string;
};

export const COLORS: Palette = {
  road: "#1b1b22",
  roadDash: "rgba(255, 255, 255, 0.35)",
  river: "#0b2a5b",
  riverWave: "rgba(120, 190, 255, 0.18)",
  safe: "#14501f",
  safeEdge: "#1d7a2f",
  bay: "#2fd95a",
  bayBorder: "#f2c14e",
  wall: "#0d3a16",
  frog: "#4dff6a",
  frogDark: "#1f9e3a",
  eyeWhite: "#ffffff",
  eyePupil: "#101010",
  log: "#7a4a22",
  logGrain: "#5a3416",
  turtle: "#2e9e57",
  turtleShell: "#1c6b3a",
  turtleGhost: "rgba(120, 220, 160, 0.3)",
  cars: ["#e0332b", "#f2c230", "#3b6fe0"],
  truck: "#8a8f99",
  truckCab: "#c9ced8",
  wheel: "#0a0a0a",
  marker: "#ff3b3b",
  timerOk: "#2fd95a",
  timerWarn: "#f2c230",
  timerLow: "#e0332b",
};
