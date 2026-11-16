// Shared contract between game engines and the React player shell.
// An engine is framework-free: it owns a canvas, keeps state in its closure,
// and reports snapshots through callbacks. See lib/games/registry.ts.

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
};

export type CreateEngine = (
  canvas: HTMLCanvasElement,
  cb: EngineCallbacks,
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
};
