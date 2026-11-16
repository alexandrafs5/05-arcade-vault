// Constants and pure helpers for the Tetris engine.
// Names and values come from references/started-games/03-tetris/game.js.

export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;

// Logic canvas: playfield on the left, next-piece strip on the right.
export const PLAYFIELD_W = COLS * BLOCK; // 300
export const PREVIEW_X = PLAYFIELD_W;
export const W = 450;
export const H = ROWS * BLOCK; // 600

// Held-key repeat for left, right and soft drop (seconds).
// Not in the original, which relied on OS key repeat.
export const REPEAT_DELAY = 0.17;
export const REPEAT_INTERVAL = 0.05;

export const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - nut (metallic gray)
];

export type Shape = number[][];

// Index = piece type (1..8); index 0 is unused.
export const PIECES: Shape[] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (nut)
];

export const PIECE_TYPES = PIECES.length - 1; // 8

export const LINE_SCORES = [0, 100, 300, 500, 800];

export function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

// Clockwise rotation: transpose + reverse rows.
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}
