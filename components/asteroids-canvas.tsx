"use client";

import { useEffect, useRef } from "react";
import {
  createEngine,
  type Engine,
  type EngineSnapshot,
} from "@/lib/games/asteroids/engine";

type Props = {
  paused: boolean;
  restartKey: number;
  onChange: (s: EngineSnapshot) => void;
  onGameOver: (finalScore: number) => void;
};

export function AsteroidsCanvas({
  paused,
  restartKey,
  onChange,
  onGameOver,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const pausedRef = useRef(paused);
  const onChangeRef = useRef(onChange);
  const onGameOverRef = useRef(onGameOver);
  const lastRestartKey = useRef(restartKey);

  // Keep the latest callbacks and pause state without recreating the engine.
  useEffect(() => {
    pausedRef.current = paused;
    onChangeRef.current = onChange;
    onGameOverRef.current = onGameOver;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(canvas, {
      onChange: (s) => onChangeRef.current(s),
      onGameOver: (finalScore) => onGameOverRef.current(finalScore),
    });
    engineRef.current = engine;
    engine.setPaused(pausedRef.current);
    engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (lastRestartKey.current === restartKey) return;
    lastRestartKey.current = restartKey;
    engineRef.current?.restart();
  }, [restartKey]);

  return (
    <canvas
      ref={canvasRef}
      className="asteroids-canvas"
      width={800}
      height={600}
    />
  );
}
