import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Acerca de · Arcade Vault" };

export default function AcercaPage() {
  return (
    <div
      className="fade-in"
      style={{
        minHeight: "calc(100vh - 160px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "80px 32px",
        textAlign: "center",
      }}
    >
      <div className="pixel neon-magenta" style={{ fontSize: 11, letterSpacing: "0.22em" }}>ACERCA DE</div>
      <h1 className="pixel neon-cyan flicker" style={{ margin: 0, fontSize: "clamp(24px, 5vw, 56px)", letterSpacing: "0.08em" }}>
        PRÓXIMAMENTE<span style={{ animation: "blink 1.2s steps(1, end) infinite" }}>_</span>
      </h1>
      <p style={{ margin: 0, maxWidth: 480, color: "var(--ink-dim)", lineHeight: 1.7 }}>
        Esta sección todavía está cargando. Vuelve pronto.
      </p>
      <Link href="/" className="btn lg">VOLVER AL INICIO</Link>
    </div>
  );
}
