import { createEngine as createAsteroids } from "./asteroids/engine";
import { H, W } from "./asteroids/constants";
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
};

export function getGameDefinition(id: string): GameDefinition | undefined {
  return GAMES[id];
}
