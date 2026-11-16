import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtNumber } from "@/lib/format";
import { getGame, getTopScores } from "@/lib/queries";

async function GameDetail({
  params,
}: {
  params: PageProps<"/juegos/[id]">["params"];
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getTopScores(game.id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{fmtNumber(game.plays)}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {game.best === null ? "—" : fmtNumber(game.best)}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">
              ▶&nbsp; JUGAR AHORA
            </Link>
            <Link href="/biblioteca" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                color: "var(--ink-faint)",
              }}
            >
              <div
                className="pixel"
                style={{
                  fontSize: 12,
                  color: "var(--magenta)",
                  marginBottom: 8,
                }}
              >
                AÚN NO HAY PUNTUACIONES
              </div>
              <div>Sé el primero en dejar tu marca.</div>
            </div>
          )}
          {scores.map((r, i) => (
            <div
              key={r.id}
              className={
                "lb-row" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {fmtDate(r.created_at)}
                </div>
              </div>
              <div className="sc">{fmtNumber(r.score)}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function GameDetailPage({ params }: PageProps<"/juegos/[id]">) {
  return (
    <Suspense
      fallback={
        <div
          className="pixel neon-cyan"
          style={{ padding: "80px 32px", textAlign: "center" }}
        >
          CARGANDO_
        </div>
      }
    >
      <GameDetail params={params} />
    </Suspense>
  );
}
