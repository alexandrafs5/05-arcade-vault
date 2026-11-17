import type { SkinId } from "../skins";

// Arkanoid constants. Names and values come from references/started-games/04-arkanoid/.
// Movement is time-based (px/s). The engine caps dt at 0.05 s (new vs. the original).

export const W = 800;
export const H = 600;

export const PADDLE_SPEED = 400; // px/s, keyboard
export const PADDLE_W = 81; // game.js value (the sprite is 162 px, drawn squashed)
export const PADDLE_H = 14;
export const PADDLE_Y = 560;

export const BALL_SIZE = 16;
export const BASE_BALL_VX = 200; // px/s, multiplied by the level speed
export const BASE_BALL_VY = -300;

export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
export const BLOCKS_ORIGIN_Y = 80; // empty band above the grid (held the HUD in the original)

export const START_LIVES = 3;
export const BLOCK_SCORE = 10;
export const PADDLE_BOUNCE_TOLERANCE = 8; // px below the paddle top still counted as a hit

export const EXPLOSION_DURATION = 150; // ms
export const EXPLOSION_FRAME_COUNT = 4;

export type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export const BLOCK_COLORS: BlockColor[] = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
];

// Flat-rect fallback colors, used only when the spritesheet fails to load.
export const FALLBACK_COLORS: Record<BlockColor, string> = {
  gray: "#9a9aa8",
  red: "#ff3b3b",
  yellow: "#ffd23f",
  cyan: "#00e5ff",
  magenta: "#ff2bd6",
  hotpink: "#ff69b4",
  green: "#39ff88",
};

export const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

export type Rect = { sx: number; sy: number; sw: number; sh: number };

export const SPRITES: {
  paddle: Rect;
  ball: Rect;
  blocks: Record<BlockColor, Rect>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

function explosionRow(sy: number): Rect[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}

// gray blocks reuse the red frames, as in the original.
export const EXPLOSION_FRAMES: Record<BlockColor, Rect[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

export type Palette = {
  style: "sprite" | "neon" | "flat"; // sprite = spritesheet, others = vector redraw
  bg: string;
  blocks: Record<BlockColor, string>; // block colors (also the sprite fallback)
  explosion: string; // sprite fallback / vector flash color
  paddle: string;
  ball: string;
  glow: number; // shadowBlur in px; 0 = no glow
};

export const PALETTES: Record<SkinId, Palette> = {
  classic: {
    style: "sprite",
    bg: "#000",
    blocks: FALLBACK_COLORS,
    explosion: "rgba(255,255,255,0.6)",
    paddle: "#e8e8f0",
    ball: "#ffffff",
    glow: 0,
  },
  neon: {
    style: "neon",
    bg: "#05050d",
    blocks: {
      gray: "#9a9ab8",
      red: "#ff006e",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#c77dff",
      hotpink: "#ff6fb0",
      green: "#00ff88",
    },
    explosion: "#ffffff",
    paddle: "#ffffff",
    ball: "#ffffff",
    glow: 14,
  },
  retro: {
    style: "flat",
    bg: "#0a140a",
    blocks: {
      gray: "#7a9a7a",
      red: "#ff5a1f",
      yellow: "#ffb000",
      cyan: "#33ff33",
      magenta: "#ff5a1f",
      hotpink: "#ffb000",
      green: "#33ff33",
    },
    explosion: "#e8ffe0",
    paddle: "#e8ffe0",
    ball: "#e8ffe0",
    glow: 0,
  },
};
