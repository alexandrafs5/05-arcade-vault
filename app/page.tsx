import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FeatureIcon } from "@/components/feature-icon";
import { MiniCard } from "@/components/mini-card";
import { Reveal } from "@/components/reveal";
import { Silhouettes } from "@/components/silhouettes";
import { FAQ, FEATURES, PRICE_FEATURES } from "@/lib/data";
import { fmtNumber, fmtTimeAgo } from "@/lib/format";
import {
  getGames,
  getHomeStats,
  getRecentScores,
  getTopScores,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Arcade Vault · El arcade clásico está de vuelta",
};

function EmptyList({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "32px 12px",
        textAlign: "center",
        color: "var(--ink-faint)",
      }}
    >
      <div
        className="pixel"
        style={{ fontSize: 12, color: "var(--magenta)", marginBottom: 8 }}
      >
        AÚN NO HAY PUNTUACIONES
      </div>
      <div>{children}</div>
    </div>
  );
}

async function StatsStrip() {
  const stats = await getHomeStats();
  const blocks = [
    { value: fmtNumber(stats.games), unit: "JUEGOS", sub: "DISPONIBLES AHORA" },
    {
      value: fmtNumber(stats.scores),
      unit: "PUNTUACIONES",
      sub: "GUARDADAS EN EL SALÓN",
    },
    {
      value: stats.topScore === null ? "—" : fmtNumber(stats.topScore),
      unit: "RÉCORD",
      sub: "LA MARCA MÁS ALTA",
    },
  ];
  return (
    <div className="stats-inner">
      {blocks.map((st, i) => (
        <div
          key={st.unit}
          className="stat-block"
          style={{ transitionDelay: i * 90 + "ms" }}
        >
          <div className="stat-n neon-yellow">{st.value}</div>
          <div className="stat-u pixel">{st.unit}</div>
          <div className="stat-s">{st.sub}</div>
        </div>
      ))}
    </div>
  );
}

async function RecentScores() {
  const rows = await getRecentScores(7);
  if (rows.length === 0) {
    return <EmptyList>Juega y guarda la primera marca.</EmptyList>;
  }
  return (
    <div className="ticker">
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="tick-row"
          style={{ animationDelay: i * 60 + "ms" }}
        >
          <span className={"tk-p neon-" + r.game.color}>{r.name}</span>
          <span className="tk-mid">▸ {r.game.title}</span>
          <span className="tk-s">+{fmtNumber(r.score)}</span>
          <span className="tk-t">{fmtTimeAgo(r.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

async function TopScores() {
  const rows = await getTopScores(null, 5);
  if (rows.length === 0) {
    return <EmptyList>Sé el primero en el salón.</EmptyList>;
  }
  const max = rows[0].score;
  return (
    <div className="top-list">
      {rows.map((r, i) => (
        <div key={r.id} className={"top-row" + (i < 3 ? ` top${i + 1}` : "")}>
          <span className="tp-rk">#{String(i + 1).padStart(2, "0")}</span>
          <span className="tp-bar">
            <span
              className="tp-fill"
              style={{
                width: (max > 0 ? Math.max(8, (r.score / max) * 100) : 8) + "%",
              }}
            ></span>
          </span>
          <span className="tp-p">
            {r.name} · {r.game.title}
          </span>
          <span className="tp-s">{fmtNumber(r.score)}</span>
        </div>
      ))}
    </div>
  );
}

const listFallback = <div style={{ minHeight: 120 }} />;

async function GamesRail() {
  const games = await getGames();
  return (
    <div className="mini-rail">
      {games.slice(0, 6).map((g) => (
        <MiniCard key={g.id} game={g} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="home fade-in">
      {/* HERO */}
      <section className="home-hero">
        <Silhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link href="/biblioteca" className="btn xl pulse">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link href="/acceso" className="btn xl magenta">
              ✦ CREAR CUENTA
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <Reveal as="section" className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={"feature-card " + f.color}
              style={{ transitionDelay: i * 80 + "ms" }}
            >
              <FeatureIcon kind={f.icon} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* GAMES PREVIEW */}
      <Reveal as="section" className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule"></div>
        </div>
        <Suspense
          fallback={<div className="mini-rail" style={{ minHeight: 200 }} />}
        >
          <GamesRail />
        </Suspense>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/biblioteca" className="btn lg">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </Reveal>

      {/* STATS */}
      <Reveal as="section" className="home-stats">
        <Suspense
          fallback={<div className="stats-inner" style={{ minHeight: 120 }} />}
        >
          <StatsStrip />
        </Suspense>
      </Reveal>

      {/* ACTIVITY */}
      <Reveal as="section" className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule"></div>
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <Suspense fallback={listFallback}>
              <RecentScores />
            </Suspense>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">
                ▸ MEJORES PUNTUACIONES
              </div>
              <Link href="/salon" className="lb-link">
                VER SALÓN →
              </Link>
            </div>
            <Suspense fallback={listFallback}>
              <TopScores />
            </Suspense>
          </div>
        </div>
      </Reveal>

      {/* PRICING */}
      <Reveal as="section" className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              {PRICE_FEATURES.map((p) => (
                <li key={p}>✔ {p}</li>
              ))}
            </ul>
            <Link
              href="/acceso"
              className="btn xl pulse"
              style={{ width: "100%" }}
            >
              EMPEZAR GRATIS →
            </Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQ.map((f) => (
              <div key={f.q} className="faq-item">
                <div className="faq-q pixel">{f.q}</div>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* FINAL CTA */}
      <Reveal as="section" className="home-final">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link href="/biblioteca" className="btn xl pulse final-cta">
          INSERTAR MONEDA →
        </Link>
        <div className="final-tag">
          Gratis. Sin registro obligatorio. Empieza en segundos.
        </div>
      </Reveal>
    </div>
  );
}
