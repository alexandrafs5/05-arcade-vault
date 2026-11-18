"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

// SPEC 15: set a new password. The reset link (through /auth/callback) already
// opened a session; without one there is nothing to update.
export function NewPasswordForm() {
  const router = useRouter();
  const { status } = useSession();
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pass.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (pass !== again) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password: pass });
      if (err) {
        setError(
          err.code === "same_password"
            ? "La nueva contraseña debe ser distinta de la anterior."
            : err.code === "weak_password"
              ? `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
              : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
        );
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const noSession = status === "guest";

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">NUEVA CLAVE</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            MÍNIMO {MIN_PASSWORD} CARACTERES
          </div>
        </div>

        {noSession ? (
          <>
            <div className="auth-msg error" role="alert">
              El enlace no es válido o ha expirado. Pide uno nuevo.
            </div>
            <Link
              href="/acceso/recuperar"
              className="btn lg"
              style={{ width: "100%", textAlign: "center" }}
            >
              PEDIR OTRO ENLACE
            </Link>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="av-new-pass">Nueva contraseña</label>
              <input
                id="av-new-pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="av-new-pass2">Repite la contraseña</label>
              <input
                id="av-new-pass2"
                type="password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div className="auth-msg error" role="alert">
                {error}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={busy || status === "loading"}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "…" : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
