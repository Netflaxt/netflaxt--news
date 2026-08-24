/* ─────────────────────────────────────────────────────────────
   src/components/PronosticiCTA.jsx
   Sezione Home: invito a registrarsi e pronosticare le partite.
   Mostra (se disponibile) un'anteprima della prossima partita.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeProssimePartite } from "../utils/matches";
import { logoForTeam } from "../utils/teamLogos";
import { TrophyIcon, BallIcon, EmptyIcon } from "./icons";

function Crest({ name, logo }) {
  const [broken, setBroken] = useState(false);
  const src = logo || logoForTeam(name);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        referrerPolicy="no-referrer"
        className="w-11 h-11 object-contain rounded-full bg-bg-elevated p-1"
      />
    );
  }
  return (
    <div className="w-11 h-11 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[11px] font-black text-text-secondary">
      {(name || "?").slice(0, 3).toUpperCase()}
    </div>
  );
}

export default function PronosticiCTA() {
  const { user } = useAuth();
  const [nextMatch, setNextMatch] = useState(null);

  useEffect(() => {
    let cancelled = false;
    /* Solo le prossime partite: prima rileggeva l-intero calendario, e
       insieme alla barra in cima faceva 78 letture per ogni visita alla
       home. Vedi la nota in utils/matches.js. */
    const unsub = subscribeProssimePartite(
      (list) => {
        if (cancelled) return;
        const now = Date.now();
        const up = list
          .filter((m) => {
            const k = m.kickoff?.toDate?.()?.getTime?.() || 0;
            return m.status !== "finished" && k > now;
          })
          .sort((a, b) => (a.kickoff?.toMillis?.() || 0) - (b.kickoff?.toMillis?.() || 0));
        setNextMatch(up[0] || null);
      },
      () => {}
    );
    return () => {
      cancelled = true;
      unsub && unsub();
    };
  }, []);

  const kickoff = nextMatch?.kickoff?.toDate?.();
  const kickoffStr = kickoff
    ? kickoff.toLocaleString("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="relative rounded-2xl border border-accent/25 bg-bg-surface overflow-hidden">
      <div className="absolute -top-24 -left-16 w-72 h-72 bg-accent/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative grid lg:grid-cols-12 gap-8 p-6 sm:p-8 lg:p-10 items-center">
        {/* Testo + invito */}
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
            <span className="h-px w-8 bg-accent" />
            Pronostici · Gioca con la Community
          </div>
          <h2
            className="mt-3 text-4xl sm:text-5xl text-text-primary leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dì la tua su ogni partita
          </h2>

          {/* Testo amichevole in prima persona */}
          <p className="mt-4 text-text-secondary text-sm sm:text-base leading-relaxed max-w-xl">
            Ehi! Prima di ogni partita della Lazio dico sempre la mia sul risultato…
            adesso tocca a te. <span className="text-text-primary font-semibold">Registrati</span> e
            metti il tuo pronostico per ogni match: chi ci prende guadagna punti e scala la
            classifica. Niente soldi, solo un gioco per divertirci insieme. 🦅
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-base/50 border border-border">
              <span className="text-success font-bold">+3</span> risultato esatto
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-base/50 border border-border">
              <span className="text-accent font-bold">+1</span> esito (1X2)
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Link
                to="/calendario"
                className="nf-shimmer group inline-flex items-center gap-2 px-6 py-3.5 bg-accent text-text-inverse font-bold rounded-md transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5"
              >
                Fai il tuo pronostico
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="nf-shimmer group inline-flex items-center gap-2 px-6 py-3.5 bg-accent text-text-inverse font-bold rounded-md transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5"
              >
                Registrati e gioca
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            )}
            <Link
              to="/pronostici"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-border hover:border-accent/60 hover:bg-accent/5 text-text-primary font-semibold rounded-md transition-all duration-300"
            >
              <TrophyIcon className="w-4 h-4 text-accent" />
              Classifica
            </Link>
          </div>
        </div>

        {/* Anteprima prossima partita */}
        <div className="lg:col-span-5">
          {nextMatch ? (
            <div className="rounded-xl border border-border bg-bg-base/40 p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold text-center mb-4">
                Prossima partita da pronosticare
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex flex-col items-center gap-2 text-center min-w-0">
                  <Crest name={nextMatch.homeTeam} logo={nextMatch.homeLogo} />
                  <span className="text-sm font-bold text-text-primary leading-tight break-words">
                    {nextMatch.homeTeam}
                  </span>
                </div>
                <span className="text-text-muted font-black">VS</span>
                <div className="flex flex-col items-center gap-2 text-center min-w-0">
                  <Crest name={nextMatch.awayTeam} logo={nextMatch.awayLogo} />
                  <span className="text-sm font-bold text-text-primary leading-tight break-words">
                    {nextMatch.awayTeam}
                  </span>
                </div>
              </div>
              {kickoffStr && (
                <div className="mt-4 text-center text-xs text-text-secondary tabular-nums">
                  {kickoffStr}
                </div>
              )}
              <Link
                to={user ? "/calendario" : "/login"}
                className="mt-4 block w-full text-center py-2.5 rounded-md bg-accent/10 border border-accent/30 text-accent text-sm font-bold hover:bg-accent/20 transition"
              >
                {user ? "Pronostica ora →" : "Accedi per pronosticare →"}
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-bg-base/30 p-8 text-center">
              <EmptyIcon icon={BallIcon} className="mb-3" />
              <p className="text-sm text-text-secondary">
                Il calendario delle prossime partite sta arrivando. Registrati per non
                perderti il primo pronostico!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
