"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_SKIN, type SkinId } from "@/lib/games/skins";
import type { Engine, EngineSnapshot, GameDefinition } from "@/lib/games/types";

type Props = {
  definition: GameDefinition;
  skin?: SkinId;
  paused: boolean;
  restartKey: number;
  onChange: (s: EngineSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

export function GameCanvas({
  definition,
  skin = DEFAULT_SKIN,
  paused,
  restartKey,
  onChange,
  onGameOver,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const skinRef = useRef(skin);
  const pausedRef = useRef(paused);
  const onChangeRef = useRef(onChange);
  const onGameOverRef = useRef(onGameOver);
  const lastRestartKey = useRef(restartKey);

  // Keep the latest callbacks and pause state without recreating the engine.
  useEffect(() => {
    skinRef.current = skin;
    pausedRef.current = paused;
    onChangeRef.current = onChange;
    onGameOverRef.current = onGameOver;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = definition.createEngine(
      canvas,
      {
        onChange: (s) => onChangeRef.current(s),
        onGameOver: (finalScore) => onGameOverRef.current(finalScore),
      },
      { skin: skinRef.current },
    );
    engineRef.current = engine;
    engine.setPaused(pausedRef.current);
    engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [definition]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    engineRef.current?.setSkin?.(skin);
  }, [skin]);

  useEffect(() => {
    if (lastRestartKey.current === restartKey) return;
    lastRestartKey.current = restartKey;
    engineRef.current?.restart();
  }, [restartKey]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={definition.width}
      height={definition.height}
      style={{ aspectRatio: `${definition.width} / ${definition.height}` }}
    />
  );
}
