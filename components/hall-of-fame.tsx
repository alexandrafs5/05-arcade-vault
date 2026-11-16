import Link from "next/link";
import { fmtDate, fmtNumber } from "@/lib/format";
import type { Game, ScoreWithGame } from "@/lib/queries";

export function HallOfFame({
  games,
  selected,
  rows,
}: {
  games: Game[];
  selected: Game;
  rows: ScoreWithGame[];
}) {
  const [first, second, third] = rows;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <Link
            key={g.id}
            href={`/salon?game=${g.id}`}
            className={"chip" + (selected.id === g.id ? " active" : "")}
          >
            {g.title}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 16px",
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            AÚN NO HAY PUNTUACIONES
          </div>
          <div>Sé el primero en {selected.title}: juega y guarda tu marca.</div>
          <Link
            href={`/juegos/${selected.id}/jugar`}
            className="btn lg"
            style={{ marginTop: 20, display: "inline-block" }}
          >
            JUGAR {selected.title}
          </Link>
        </div>
      ) : (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{second?.name ?? "—"}</div>
              <div className="score">
                {second ? fmtNumber(second.score) : ""}
              </div>
              <div className="date">
                {second ? fmtDate(second.created_at) : ""}
              </div>
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{first.name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {fmtNumber(first.score)}
              </div>
              <div className="date">{fmtDate(first.created_at)}</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{third?.name ?? "—"}</div>
              <div className="score">{third ? fmtNumber(third.score) : ""}</div>
              <div className="date">
                {third ? fmtDate(third.created_at) : ""}
              </div>
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{fmtNumber(r.score)}</div>
                <div className="dt">{fmtDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
