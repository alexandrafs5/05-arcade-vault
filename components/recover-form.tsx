"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// SPEC 15: ask for the account email and send the reset link. The answer is
// the same whether or not the email is registered.
export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Escribe tu correo electrónico.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/acceso/nueva-clave")}`,
        },
      );
      if (err?.code === "over_email_send_rate_limit") {
        setError("Demasiados correos enviados. Espera unos minutos.");
        return;
      }
      // Any other outcome looks the same, so the form never reveals which emails exist.
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">RECUPERAR CLAVE</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            TE ENVIAMOS UN ENLACE
          </div>
        </div>

        {sent ? (
          <div className="auth-msg ok" role="status">
            Si el correo está registrado, recibirás un enlace para crear una
            nueva contraseña. Revisa tu bandeja de entrada.
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="av-rec-email">Correo electrónico</label>
              <input
                id="av-rec-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
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
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "…" : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <Link
          href="/acceso"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10, textAlign: "center" }}
        >
          VOLVER AL ACCESO
        </Link>
      </div>
    </div>
  );
}
