// Shared contract between game engines and the React player shell.
// An engine is framework-free: it owns a canvas, keeps state in its closure,
// and reports snapshots through callbacks. See lib/games/registry.ts.

import type { SkinId } from "./skins";

export type EngineState = "playing" | "dead" | "gameover";

export type EngineSnapshot = {
  score: number;
  state: EngineState;
  // Extra HUD values (lives, level, lines...). Keys must match GameDefinition.hud.
  hud: Record<string, number>;
};

export type EngineCallbacks = {
  onChange: (s: EngineSnapshot) => void; // fired only when a snapshot field changes
  onGameOver: (finalScore: number) => void; // fired once per game
};

export type Engine = {
  start: () => void; // begin the rAF loop and attach window listeners
  stop: () => void; // cancel the loop and remove window listeners
  setPaused: (paused: boolean) => void;
  restart: () => void; // reset to a fresh game
  // Swap the skin live, without resetting the game. Must repaint one frame when paused.
  setSkin?: (skin: SkinId) => void;
};

export type EngineOptions = {
  skin?: SkinId; // initial skin; engines default to "classic"
};

export type CreateEngine = (
  canvas: HTMLCanvasElement,
  cb: EngineCallbacks,
  opts?: EngineOptions,
) => Engine;

export type HudField = {
  key: string; // key inside EngineSnapshot.hud
  label: string; // Spanish UI label
  format: "number" | "hearts" | "pad2";
  initial: number; // value shown before the first snapshot and after restart
};

export type GameDefinition = {
  id: string; // matches games.id (URL slug)
  createEngine: CreateEngine;
  width: number; // logic canvas size
  height: number;
  hud: HudField[]; // shown after Jugador and Puntuación
  skins?: SkinId[]; // skins the engine implements; the player shows a picker when set
};
