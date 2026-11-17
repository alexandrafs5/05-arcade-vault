import type { SkinId } from "../skins";

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

export type Palette = {
  boardA: string;
  boardB: string;
  grid: string | null; // thin cell lines (neon)
  snake: string;
  eyeWhite: string;
  eyePupil: string;
  apple: string; // fallback / vector apple fill
  appleHighlight: string; // vector apple stem and shine
  bodyStyle: "round" | "blocks";
  appleStyle: "sprite" | "orb" | "pixel";
  eyeShape: "round" | "square";
  glow: number; // shadowBlur in px, 0 = off
};

export const PALETTES: Record<SkinId, Palette> = {
  classic: {
    boardA: "#aad751",
    boardB: "#a2d149",
    grid: null,
    snake: "#4a75e8",
    eyeWhite: "#ffffff",
    eyePupil: "#0b1a3a",
    apple: "#e7471d",
    appleHighlight: "#e7471d",
    bodyStyle: "round",
    appleStyle: "sprite",
    eyeShape: "round",
    glow: 0,
  },
  neon: {
    boardA: "#05060d",
    boardB: "#080a14",
    grid: "rgba(0, 245, 255, 0.10)",
    snake: "#00ff88",
    eyeWhite: "#0a0a0f",
    eyePupil: "#00f5ff",
    apple: "#ff006e",
    appleHighlight: "#f5ff00",
    bodyStyle: "round",
    appleStyle: "orb",
    eyeShape: "round",
    glow: 16,
  },
  retro: {
    boardA: "#0b1f0b",
    boardB: "#0f290f",
    grid: null,
    snake: "#7dff6a",
    eyeWhite: "#0b1f0b",
    eyePupil: "#0b1f0b",
    apple: "#ffb000",
    appleHighlight: "#ffe08a",
    bodyStyle: "blocks",
    appleStyle: "pixel",
    eyeShape: "square",
    glow: 0,
  },
};
