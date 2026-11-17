"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import type { TouchAction, TouchConfig } from "@/lib/games/types";

// On-screen gamepad. It turns finger presses into virtual keyboard events on
// `window`, so the engines (which only read the keyboard) stay untouched.
// Visibility is pure CSS (`@media (pointer: coarse)`); the markup is always
// rendered so server and client HTML match.

const DPAD: Record<"up" | "down" | "left" | "right", TouchAction> = {
  up: { code: "ArrowUp", key: "ArrowUp", label: "Arriba" },
  down: { code: "ArrowDown", key: "ArrowDown", label: "Abajo" },
  left: { code: "ArrowLeft", key: "ArrowLeft", label: "Izquierda" },
  right: { code: "ArrowRight", key: "ArrowRight", label: "Derecha" },
};

const key = (type: "keydown" | "keyup", a: TouchAction) =>
  new KeyboardEvent(type, {
    code: a.code,
    key: a.key,
    bubbles: true,
    cancelable: true,
  });

const stop = (e: { preventDefault: () => void }) => e.preventDefault();

export function TouchControls({
  touch,
  disabled,
}: {
  touch?: TouchConfig;
  disabled: boolean;
}) {
  // Held virtual keys, by code. The only place that knows what is pressed.
  const held = useRef(new Map<string, TouchAction>());

  const press = useCallback((a: TouchAction) => {
    if (held.current.has(a.code)) return;
    held.current.set(a.code, a);
    window.dispatchEvent(key("keydown", a));
  }, []);

  const release = useCallback((a: TouchAction) => {
    if (!held.current.delete(a.code)) return;
    window.dispatchEvent(key("keyup", a));
  }, []);

  const releaseAll = useCallback(() => {
    const actions = [...held.current.values()];
    held.current.clear();
    for (const a of actions) window.dispatchEvent(key("keyup", a));
  }, []);

  // Pause, game over, tab switch and unmount all drop every held key.
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => {
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  const bind = (action: TouchAction | undefined) => {
    if (!action) return {};
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        e.preventDefault();
        // Capture keeps the pointer on this button, so sliding off still ends
        // with pointerup here and the key is never left held.
        e.currentTarget.setPointerCapture(e.pointerId);
        press(action);
      },
      onPointerUp: () => release(action),
      onPointerCancel: () => release(action),
      onLostPointerCapture: () => release(action),
    };
  };

  const dpadBtn = (dir: keyof typeof DPAD) => (
    <button
      key={dir}
      type="button"
      className={`pad-btn pad-${dir}`}
      aria-label={DPAD[dir].label}
      {...bind(DPAD[dir])}
    >
      <span aria-hidden="true" className="pad-arrow" />
    </button>
  );

  const abBtn = (id: "a" | "b") => {
    const action = touch?.[id];
    return (
      <button
        type="button"
        className={`pad-btn pad-${id}`}
        aria-label={action?.label ?? `Botón ${id.toUpperCase()} sin acción`}
        aria-disabled={action ? undefined : true}
        data-idle={action ? undefined : "true"}
        {...bind(action)}
      >
        {id.toUpperCase()}
      </button>
    );
  };

  return (
    <div
      className="av-pad"
      onContextMenu={stop}
      onSelectCapture={stop}
      onDragStart={stop}
    >
      <div className="pad-dpad">
        {(["up", "left", "right", "down"] as const).map(dpadBtn)}
      </div>
      <div className="pad-ab">
        {abBtn("b")}
        {abBtn("a")}
      </div>
    </div>
  );
}
