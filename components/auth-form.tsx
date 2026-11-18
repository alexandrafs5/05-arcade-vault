"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

const USERNAME_RE = /^[A-Za-z0-9_]{3,12}$/;
const MIN_PASSWORD = 8;

const URL_ERRORS: Record<string, string> = {
  callback: "El enlace no es válido o ha expirado. Inténtalo de nuevo.",
};

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const urlError = URL_ERRORS[params.get("error") ?? ""] ?? null;

  const { status } = useSession();

  // Already logged in (or just logged in): leave the auth screen.
  useEffect(() => {
    if (status === "user") router.replace(next);
    // Logged in without a profile: the username step comes first.
    else if (status === "needs-username")
      router.replace(`/acceso/usuario?next=${encodeURIComponent(next)}`);
  }, [status, next, router]);

  const [tab, setTab] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const switchTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
    setSentTo(null);
  };

  const signIn = async () => {
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (err) {
      setError(
        err.code === "email_not_confirmed"
          ? "Confirmación pendiente: abre el enlace que enviamos a tu correo."
          : err.code === "invalid_credentials"
            ? "Correo o contraseña incorrectos."
            : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
      return;
    }
    router.push(next);
    router.refresh();
  };

  const signUp = async () => {
    if (!USERNAME_RE.test(username)) {
      setError("El usuario debe tener 3–12 caracteres: letras, números o _.");
      return;
    }
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

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      setError(
        err.code === "weak_password"
          ? `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
          : err.code === "over_email_send_rate_limit"
            ? "Demasiados correos enviados. Espera unos minutos."
            : /database error/i.test(err.message)
              ? "Ese nombre de usuario ya está en uso."
              : "No se pudo crear la cuenta. Inténtalo de nuevo.",
      );
      return;
    }
    // Confirmation ON + existing email: Supabase answers without an error
    // and returns a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      setError("Ese correo ya está registrado. Inicia sesión.");
      return;
    }
    setSentTo(email);
  };

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser navigates to the provider.
    if (err) {
      setError(
        "No se pudo iniciar sesión con el proveedor. Inténtalo de nuevo.",
      );
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pass.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    setBusy(true);
    try {
      if (tab === "in") await signIn();
      else await signUp();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {urlError && !sentTo && (
          <div className="auth-msg error" role="alert">
            {urlError}
          </div>
        )}

        {sentTo ? (
          <div className="auth-msg ok" role="status">
            REVISA TU CORREO. Enviamos un enlace de confirmación a {sentTo}.
            Ábrelo para activar tu cuenta y entrar.
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {tab === "up" && (
              <div className="field slide-in">
                <label htmlFor="av-username">Usuario</label>
                <input
                  id="av-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="px_kai"
                  maxLength={12}
                  autoComplete="username"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="av-email">Correo electrónico</label>
              <input
                id="av-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="av-pass">Contraseña</label>
              <input
                id="av-pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  tab === "in" ? "current-password" : "new-password"
                }
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
              {busy ? "…" : tab === "in" ? "ENTRAR AL VAULT" : "CREAR CUENTA"}
            </button>
          </form>
        )}

        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => oauth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => oauth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
