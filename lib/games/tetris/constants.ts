// Constants and pure helpers for the Tetris engine.
// Names and values come from references/started-games/03-tetris/game.js.

import type { SkinId } from "../skins";

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

export type BlockStyle = "classic" | "neon" | "retro";

export type Palette = {
  bg: string;
  grid: string;
  divider: string;
  label: string;
  font: string;
  colors: (string | null)[]; // index = piece type (1..8)
  blockStyle: BlockStyle;
  glow: number; // shadowBlur in px, 0 = none
  ghostAlpha: number;
};

export const PALETTES: Record<SkinId, Palette> = {
  classic: {
    bg: "#000",
    grid: "rgba(255, 255, 255, 0.06)",
    divider: "rgba(255,255,255,0.25)",
    label: "rgba(255,255,255,0.6)",
    font: "12px monospace",
    colors: [
      null,
      "#4dd0e1", // I - cyan
      "#ffd54f", // O - yellow
      "#ba68c8", // T - purple
      "#81c784", // S - green
      "#e57373", // Z - red
      "#90caf9", // J - pale blue
      "#ffb74d", // L - orange
      "#9e9e9e", // N - nut (metallic gray)
    ],
    blockStyle: "classic",
    glow: 0,
    ghostAlpha: 0.2,
  },
  neon: {
    bg: "#05050c",
    grid: "rgba(0, 245, 255, 0.07)",
    divider: "rgba(0, 245, 255, 0.6)",
    label: "#00f5ff",
    font: "12px monospace",
    colors: [
      null,
      "#00f5ff", // I - cyan
      "#f5ff00", // O - yellow
      "#ff006e", // T - magenta
      "#00ff88", // S - green
      "#ff5a36", // Z - hot orange
      "#4d7cff", // J - electric blue
      "#c77dff", // L - violet
      "#e6e6ff", // N - white
    ],
    blockStyle: "neon",
    glow: 12,
    ghostAlpha: 0.35,
  },
  retro: {
    bg: "#0b140b",
    grid: "#13261a",
    divider: "#33ff66",
    label: "#33ff66",
    font: "bold 12px monospace",
    colors: [
      null,
      "#ffb000", // I - amber
      "#c8ffc8", // O - pale phosphor
      "#33ff66", // T - phosphor green
      "#1fa84a", // S - mid green
      "#ffb000", // Z - amber
      "#c8ffc8", // J - pale phosphor
      "#33ff66", // L - phosphor green
      "#1fa84a", // N - mid green
    ],
    blockStyle: "retro",
    glow: 0,
    ghostAlpha: 0.3,
  },
};

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
