"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[A-Za-z0-9_]{3,12}$/;

// SPEC 15: "choose a username" step for users without a profile (OAuth).
export function UsernameForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { status, refresh } = useSession();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "guest") router.replace("/acceso");
    else if (status === "user") router.replace(next);
  }, [status, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!USERNAME_RE.test(username)) {
      setError("El usuario debe tener 3–12 caracteres: letras, números o _.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      // `_` is a wildcard in ILIKE: escape it so the check is exact.
      const { data: taken, error: lookupErr } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", username.replace(/_/g, "\\_"))
        .maybeSingle();
      if (lookupErr) {
        setError("No se pudo comprobar el usuario. Inténtalo de nuevo.");
        return;
      }
      if (taken) {
        setError("Ese nombre de usuario ya está en uso.");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/acceso");
        return;
      }
      const { error: insertErr } = await supabase
        .from("profiles")
        .insert({ id: user.id, username });
      if (insertErr) {
        // 23505 = unique violation (lost a race for the same name).
        setError(
          insertErr.code === "23505"
            ? "Ese nombre de usuario ya está en uso."
            : "No se pudo guardar el usuario. Inténtalo de nuevo.",
        );
        return;
      }
      await refresh(); // status becomes "user" and the effect redirects
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ELIGE TU USUARIO</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ÚLTIMO PASO · 3–12 CARACTERES
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="av-new-username">Usuario</label>
            <input
              id="av-new-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="px_kai"
              maxLength={12}
              autoComplete="username"
              autoFocus
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
            disabled={busy || status !== "needs-username"}
            style={{ width: "100%", marginTop: 8 }}
          >
            {busy ? "…" : "GUARDAR USUARIO"}
          </button>
        </form>
      </div>
    </div>
  );
}
