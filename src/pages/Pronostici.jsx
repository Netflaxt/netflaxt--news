/* ─────────────────────────────────────────────────────────────
   src/pages/Pronostici.jsx
   Hub personale pronostici:
   - "I miei pronostici": statistiche personali + cronologia
     (giocate, vinte, esatti, in attesa, non giocate, posizione)
   - Link alla classifica generale (vive in /classifica)
   I pronostici si fanno dal Calendario.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { POINTS } from "../utils/predictions";
import { subscribeMatches } from "../utils/matches";
import { setSEO, resetSEO } from "../utils/seo";
import { db } from "../firebase/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

function Stat({ label, value, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
      ? "text-success"
      : tone === "muted"
      ? "text-text-muted"
      : "text-text-primary";
  return (
    <div className="rounded-xl bg-bg-base/40 border border-border px-3 py-2.5 text-center">
      <div className={`text-2xl font-black tabular-nums leading-none ${toneClass}`} style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">{label}</div>
    </div>
  );
}

function outcomeLabel(o) {
  return o === "1" ? "1" : o === "2" ? "2" : o === "X" ? "X" : "—";
}

function HistoryRow({ pred, match }) {
  const finished = match?.status === "finished";
  const pts = pred.points;
  let badge;
  if (!match) {
    badge = { label: "Partita rimossa", cls: "bg-bg-elevated border-border text-text-muted" };
  } else if (!finished) {
    badge = { label: "In attesa", cls: "bg-warning/10 border-warning/30 text-warning" };
  } else if (pts === POINTS.exact) {
    badge = { label: "Esatto +3", cls: "bg-success/15 border-success/40 text-success" };
  } else if (pts === POINTS.outcome) {
    badge = { label: "Esito +1", cls: "bg-accent/15 border-accent/40 text-accent" };
  } else if (pts === 0) {
    badge = { label: "Sbagliato", cls: "bg-error/10 border-error/30 text-error" };
  } else {
    badge = { label: "Da valutare", cls: "bg-bg-elevated border-border text-text-muted" };
  }

  const kickoff = match?.kickoff?.toDate?.();

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-bg-surface px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-text-primary truncate">
            {match ? `${match.homeTeam} – ${match.awayTeam}` : "Partita"}
          </span>
          {kickoff && (
            <span className="text-[10px] text-text-muted">
              {kickoff.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          Tuo pronostico:{" "}
          <span className="font-bold text-text-primary tabular-nums">
            {pred.homeScore}–{pred.awayScore}
          </span>{" "}
          <span className="text-text-muted">({outcomeLabel(pred.outcome)})</span>
          {finished && (
            <>
              {" · "}Risultato:{" "}
              <span className="font-bold text-text-primary tabular-nums">
                {match.homeScore}–{match.awayScore}
              </span>
            </>
          )}
        </div>
      </div>
      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${badge.cls}`}>
        {badge.label}
      </span>
    </li>
  );
}

export default function Pronostici() {
  const { user } = useAuth();
  const [myPreds, setMyPreds] = useState([]);
  const [matchMap, setMatchMap] = useState({});
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setSEO({
      title: "I miei pronostici",
      description:
        "Indovina i risultati della Lazio e guadagna punti per la classifica generale di Netflaxt News.",
      type: "website",
    });
    // ✨ REAL-TIME: matches + i miei pronostici. Quando admin
    // finalizza un risultato o azzera la classifica, le mie stats
    // si aggiornano subito senza dover navigare via.
    let gotMatches = false;
    let gotPreds = !user;

    const unsubMatches = subscribeMatches(
      (matches) => {
        setAllMatches(matches);
        const map = {};
        matches.forEach((m) => (map[m.id] = m));
        setMatchMap(map);
        gotMatches = true;
        if (gotMatches && gotPreds) setLoading(false);
      },
      (e) => {
        console.error("Errore listener matches:", e);
        setLoading(false);
      }
    );

    let unsubPreds = () => {};
    if (user?.uid) {
      const q = query(
        collection(db, "predictions"),
        where("uid", "==", user.uid)
      );
      unsubPreds = onSnapshot(
        q,
        (snap) => {
          setMyPreds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          gotPreds = true;
          if (gotMatches && gotPreds) setLoading(false);
        },
        (e) => {
          console.error("Errore listener miei pronostici:", e);
          setLoading(false);
        }
      );
    } else {
      setMyPreds([]);
    }

    return () => {
      unsubMatches();
      unsubPreds();
      resetSEO();
    };
  }, [user?.uid]);

  const myStats = useMemo(() => {
    const now = Date.now();
    const played = myPreds.length;
    const evaluated = myPreds.filter((p) => p.points != null);
    const points = evaluated.reduce((s, p) => s + (p.points || 0), 0);
    const won = evaluated.filter((p) => (p.points || 0) > 0).length;
    const exact = evaluated.filter((p) => p.points === POINTS.exact).length;
    const pending = myPreds.filter((p) => {
      const m = matchMap[p.matchId];
      return m && m.status !== "finished";
    }).length;
    const predicted = new Set(myPreds.map((p) => p.matchId));
    const notPlayed = allMatches.filter((m) => {
      const k = m.kickoff?.toDate?.()?.getTime?.() || 0;
      const isPastOrDone = m.status === "finished" || (k && k < now);
      return isPastOrDone && !predicted.has(m.id);
    }).length;
    return { played, points, won, exact, pending, notPlayed };
  }, [myPreds, matchMap, allMatches]);

  const myHistory = useMemo(() => {
    return [...myPreds].sort((a, b) => {
      const ka = matchMap[a.matchId]?.kickoff?.toMillis?.() || 0;
      const kb = matchMap[b.matchId]?.kickoff?.toMillis?.() || 0;
      return kb - ka;
    });
  }, [myPreds, matchMap]);

  return (
    <main className="min-h-screen bg-bg-base text-text-primary relative overflow-hidden">
      <div className="absolute -top-40 left-0 w-[600px] h-[500px] rounded-full bg-accent/8 blur-[140px] pointer-events-none" />

      <div
        className={`relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent font-semibold">
          <span className="h-px w-8 bg-accent" />
          Gioca con la curva
        </div>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <h1 className="text-5xl sm:text-6xl text-text-primary leading-none" style={{ fontFamily: "var(--font-display)" }}>
            Pronostici
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Link
              to="/classifica"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-bg-surface text-text-secondary hover:text-text-primary hover:border-accent/40 text-xs font-bold uppercase tracking-wider transition"
            >
              Classifica generale
            </Link>
            <Link
              to="/calendario"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition"
            >
              Vai a pronosticare →
            </Link>
          </div>
        </div>
        <p className="mt-2 text-text-secondary text-sm mb-8">
          Indovina i risultati: <span className="text-success font-semibold">+{POINTS.exact} punti</span> per il
          risultato esatto, <span className="text-accent font-semibold">+{POINTS.outcome} punto</span> per l'esito (1X2).
          I punti si assegnano a fine partita.
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* ─── I MIEI PRONOSTICI ─── */}
            {user ? (
              <section>
                <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 mb-4">
                  <div className="text-sm font-bold text-text-primary mb-1">
                    I tuoi numeri sui pronostici
                  </div>
                  <div className="text-xs text-text-secondary mb-4">
                    {myStats.points} punti pronostici ·{" "}
                    <Link
                      to="/classifica"
                      className="text-accent font-semibold hover:underline"
                    >
                      Vedi la classifica generale →
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <Stat label="Punti" value={myStats.points} tone="accent" />
                    <Stat label="Giocate" value={myStats.played} />
                    <Stat label="Vinte" value={myStats.won} tone="success" />
                    <Stat label="Esatti" value={myStats.exact} tone="success" />
                    <Stat label="In attesa" value={myStats.pending} tone="muted" />
                    <Stat label="Non giocate" value={myStats.notPlayed} tone="muted" />
                  </div>
                </div>

                <h2 className="text-[10px] uppercase tracking-[0.3em] text-text-muted font-bold mb-3">
                  La tua cronologia
                </h2>
                {myHistory.length === 0 ? (
                  <div className="text-center py-10 rounded-xl border border-border bg-bg-surface">
                    <p className="text-text-secondary text-sm">
                      Non hai ancora pronosticato nessuna partita.{" "}
                      <Link to="/calendario" className="font-bold text-accent hover:underline">
                        Inizia dal calendario →
                      </Link>
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {myHistory.map((p) => (
                      <HistoryRow key={p.id} pred={p} match={matchMap[p.matchId]} />
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <div className="text-center py-10 rounded-xl border border-border bg-bg-surface">
                <p className="text-text-secondary text-sm">
                  <Link to="/login" className="font-bold text-accent hover:underline">
                    Accedi
                  </Link>{" "}
                  per pronosticare le partite e scalare la{" "}
                  <Link to="/classifica" className="font-bold text-accent hover:underline">
                    classifica generale
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
