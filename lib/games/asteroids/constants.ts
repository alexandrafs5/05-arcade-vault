import type { SkinId } from "../skins";

export const W = 800;
export const H = 600;

export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const TRIPLE_SPREAD = 0.18;

// Indexed by asteroid size (1, 2, 3); index 0 is unused.
export const RADII = [0, 16, 30, 50];
export const SPEEDS = [0, 85, 55, 32];
export const POINTS = [0, 100, 50, 20];

// Note: ship DRAG (0.987) is applied per frame, not per second, as in the
// original game. Play speed depends on the display refresh rate.
export const SHIP_DRAG = 0.987;

type Point = { x: number; y: number };

export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number) =>
  min + Math.random() * (max - min);
export const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1));

export type Palette = {
  bg: string;
  rock: string;
  rockFill: string | null; // flat fill behind the outline (retro)
  ship: string;
  shipFill: string | null;
  flame: string;
  bullet: string;
  power: string;
  particle: string;
  text: string;
  lineWidth: number;
  glow: number; // shadowBlur in px; 0 = no glow
  square: boolean; // chunky square bullets/particles, mitered joins
};

export const PALETTES: Record<SkinId, Palette> = {
  classic: {
    bg: "#000",
    rock: "#fff",
    rockFill: null,
    ship: "#fff",
    shipFill: null,
    flame: "rgba(255, 130, 0, 0.85)",
    bullet: "#fff",
    power: "#0ff",
    particle: "#fff",
    text: "#0ff",
    lineWidth: 1.5,
    glow: 0,
    square: false,
  },
  neon: {
    bg: "#05050d",
    rock: "#ff006e",
    rockFill: null,
    ship: "#00f5ff",
    shipFill: null,
    flame: "#f5ff00",
    bullet: "#f5ff00",
    power: "#00ff88",
    particle: "#ff6fb0",
    text: "#00ff88",
    lineWidth: 2,
    glow: 14,
    square: false,
  },
  retro: {
    bg: "#0a140a",
    rock: "#33ff33",
    rockFill: "#124012",
    ship: "#ffb000",
    shipFill: "#ffb000",
    flame: "#ff5a1f",
    bullet: "#ffb000",
    power: "#ffe066",
    particle: "#33ff33",
    text: "#ffb000",
    lineWidth: 3,
    glow: 0,
    square: true,
  },
};
