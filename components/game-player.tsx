"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/game-canvas";
import { SkinPicker } from "@/components/skin-picker";
import { TouchControls } from "@/components/touch-controls";
import { fmtNumber } from "@/lib/format";
import { getGameDefinition } from "@/lib/games/registry";
import {
  DEFAULT_SKIN,
  isSkinId,
  skinStorageKey,
  type SkinId,
} from "@/lib/games/skins";
import type {
  EngineSnapshot,
  GameDefinition,
  HudField,
} from "@/lib/games/types";
import { useSession } from "@/lib/session";

function formatHud(f: HudField, n: number) {
  if (f.format === "hearts") return n > 0 ? "♥ ".repeat(n).trim() : "—";
  if (f.format === "pad2") return String(n).padStart(2, "0");
  return fmtNumber(n);
}

const initialHud = (d: GameDefinition) =>
  Object.fromEntries(d.hud.map((f) => [f.key, f.initial]));

export function GamePlayer({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const definition = getGameDefinition(gameId);
  if (!definition) {
    return (
      <div className="av-player fade-in">
        <div className="pixel neon-magenta" style={{ fontSize: 18 }}>
          JUEGO NO DISPONIBLE
        </div>
      </div>
    );
  }
  return <Player definition={definition} gameId={gameId} title={title} />;
}

function Player({
  definition,
  gameId,
  title,
}: {
  definition: GameDefinition;
  gameId: string;
  title: string;
}) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hud, setHud] = useState<Record<string, number>>(() =>
    initialHud(definition),
  );
  const [restartKey, setRestartKey] = useState(0);
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);
  const skins = definition.skins;

  // Flags the page as "playing" so the touch layout can hide nav and footer.
  // A hidden, cached player page runs no effects, so the flag never outlives
  // the visible player (unlike a CSS :has(.av-player) check).
  useEffect(() => {
    const cls = document.body.classList;
    cls.add("is-playing");
    return () => cls.remove("is-playing");
  }, []);

  // The saved skin is read after mount so server and client markup match.
  useEffect(() => {
    if (!skins) return;
    try {
      const saved = localStorage.getItem(skinStorageKey(gameId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isSkinId(saved) && skins.includes(saved)) setSkin(saved);
    } catch {
      // storage blocked: keep the default skin
    }
  }, [gameId, skins]);

  const pickSkin = (next: SkinId) => {
    setSkin(next);
    try {
      localStorage.setItem(skinStorageKey(gameId), next);
    } catch {
      // storage blocked: the choice lasts for this visit only
    }
  };

  // The session loads after mount, so the name follows it until the player edits it.
  const name = typedName ?? user?.name ?? "INVITADO";
  const cleanName = name.trim();

  const handleEngineChange = (s: EngineSnapshot) => {
    setScore(s.score);
    setHud(s.hud);
  };

  const handleEngineGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await saveScore({ game: gameId, score, name: cleanName });
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // P / Esc toggle pause (ignored while the modal or a text field has focus).
  useEffect(() => {
    if (over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyP" && e.code !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over]);

  const restart = () => {
    setScore(0);
    setHud(initialHud(definition));
    setRestartKey((k) => k + 1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(false);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{fmtNumber(score)}</div>
          </div>
          {definition.hud.map((f) => (
            <div
              key={f.key}
              className={
                "hud-stat" +
                (f.format === "hearts" ? " lives" : "") +
                (f.key === "level" ? " level" : "")
              }
            >
              <div className="l">{f.label}</div>
              <div className="v">{formatHud(f, hud[f.key] ?? f.initial)}</div>
            </div>
          ))}
          {skins && (
            <div className="hud-stat">
              <SkinPicker skins={skins} value={skin} onPick={pickSkin} />
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juegos/${gameId}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <GameCanvas
            definition={definition}
            skin={skin}
            paused={paused || over}
            restartKey={restartKey}
            onChange={handleEngineChange}
            onGameOver={handleEngineGameOver}
          />
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <TouchControls touch={definition.touch} disabled={paused || over} />

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{fmtNumber(score)}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  disabled={saving || cleanName.length === 0}
                  onClick={save}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && !saved && (
              <div
                role="alert"
                className="mono"
                style={{
                  color: "var(--magenta)",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  marginTop: 10,
                }}
              >
                ✖ NO SE PUDO GUARDAR. REVISA TU CONEXIÓN Y REINTENTA.
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/biblioteca")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
