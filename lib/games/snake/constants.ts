// Snake constants. Classic Google Snake: 17x15 board, fixed step, no levels.

export const COLS = 17;
export const ROWS = 15;
export const CELL = 36;

// Logic canvas size in px. Origin top-left; cell (col, row) draws at (col * CELL, row * CELL).
export const W = COLS * CELL; // 612
export const H = ROWS * CELL; // 540

// Fixed time between snake moves, in ms. The engine converts it to seconds.
export const STEP_MS = 130;

export const START_LENGTH = 3;
export const START_HEAD = { col: 5, row: 7 } as const; // body trails left: cols 4 and 3
export const FIRST_APPLE = { col: 12, row: 7 } as const;

// Pending direction turns kept between steps.
export const MAX_QUEUED_TURNS = 2;

export type Cell = { col: number; row: number };
export type Dir = "up" | "down" | "left" | "right";

export const DIRS: Record<Dir, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

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

// Source rectangle of the apple inside fruits.png.
// sprites.js labels this rectangle "banana"; it is the red pixel-art apple.
export const APPLE_SPRITE = { x: 34, y: 136, w: 110, h: 160 } as const;
export const SPRITE_URL = "/games/snake/fruits.png";

export const COLOR_BOARD_A = "#aad751";
export const COLOR_BOARD_B = "#a2d149";
export const COLOR_SNAKE = "#4a75e8";
export const COLOR_EYE_WHITE = "#ffffff";
export const COLOR_EYE_PUPIL = "#0b1a3a";
export const COLOR_APPLE_FALLBACK = "#e7471d";
