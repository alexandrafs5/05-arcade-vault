import { createEngine as createAsteroids } from "./asteroids/engine";
import { H, W } from "./asteroids/constants";
import { createEngine as createTetris } from "./tetris/engine";
import { H as TETRIS_H, W as TETRIS_W } from "./tetris/constants";
import { createEngine as createArkanoid } from "./arkanoid/engine";
import { H as ARKANOID_H, W as ARKANOID_W } from "./arkanoid/constants";
import type { GameDefinition } from "./types";

// One entry per playable game. The key is the `games.id` slug.
const GAMES: Record<string, GameDefinition> = {
  asteroids: {
    id: "asteroids",
    createEngine: createAsteroids,
    width: W,
    height: H,
    hud: [
      { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
      { key: "level", label: "Nivel", format: "pad2", initial: 1 },
    ],
  },
  tetris: {
    id: "tetris",
    createEngine: createTetris,
    width: TETRIS_W,
    height: TETRIS_H,
    hud: [
      { key: "lines", label: "Líneas", format: "number", initial: 0 },
      { key: "level", label: "Nivel", format: "pad2", initial: 1 },
    ],
  },
  arkanoid: {
    id: "arkanoid",
    createEngine: createArkanoid,
    width: ARKANOID_W,
    height: ARKANOID_H,
    hud: [
      { key: "lives", label: "Vidas", format: "hearts", initial: 3 },
      { key: "level", label: "Nivel", format: "pad2", initial: 1 },
    ],
  },
};

export function getGameDefinition(id: string): GameDefinition | undefined {
  return GAMES[id];
}
