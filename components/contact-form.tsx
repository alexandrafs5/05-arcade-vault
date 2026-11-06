"use client";

import { useActionState, useRef, useState } from "react";
import { sendContactMessage, type ContactState } from "@/app/acerca/actions";

const EMPTY = { name: "", email: "", msg: "" };
const IDLE: ContactState = { status: "idle" };

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);
  // True once the user leaves the result terminal (retry / send another)
  const [dismissed, setDismissed] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerShake = () => {
    setShake(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 400);
  };

  const [state, formAction, pending] = useActionState(
    async (prev: ContactState, formData: FormData) => {
      setDismissed(false);
      const next = await sendContactMessage(prev, formData);
      if (next.status === "invalid") triggerShake();
      return next;
    },
    IDLE,
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      e.preventDefault();
      triggerShake();
    }
  };

  const showSent = state.status === "sent" && !dismissed;
  const showError = state.status === "error" && !dismissed;

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={onSubmit}
    >
      {showSent ? (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.name.toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setForm(EMPTY);
                }}
              >
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      ) : showError ? (
        <div className="terminal-success" style={{ borderColor: "#ff5f56", boxShadow: "0 0 22px rgba(255,95,86,0.25)" }}>
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line" style={{ color: "#ff5f56" }}>
              [ERROR] No se pudo enviar el mensaje. Inténtalo de nuevo.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={() => setDismissed(true)}>
                REINTENTAR
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
              maxLength={80}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
              maxLength={254}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
              maxLength={2000}
            ></textarea>
          </div>
          {/* Honeypot: hidden from people, bots fill it */}
          <input
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          />
          <button
            className="btn xl press"
            type="submit"
            style={{ width: "100%" }}
            disabled={pending}
          >
            ▶&nbsp;&nbsp;ENVIAR MENSAJE
          </button>
        </>
      )}
    </form>
  );
}
