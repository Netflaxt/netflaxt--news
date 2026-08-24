/* ─────────────────────────────────────────────────────────────
   src/components/NextMatchBar.jsx
   Barra "Prossima partita Lazio" per la Home: prende il prossimo
   match dal calendario (Firestore `matches`, real-time) e mostra
   un countdown live. Se la data è ancora provvisoria (>5 settimane)
   mostra "tra N giorni · Data da confermare".
   Cliccabile → /calendario. Se non ci sono partite, non renderizza nulla.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProssimePartite } from "../utils/matches";
import { logoForTeam } from "../utils/teamLogos";
import LiveBadge, { getLiveState } from "./LiveBadge";

const PROVISIONAL_DAYS = 35;

function Crest({ name, logo, crest }) {
  const [broken, setBroken] = useState(false);
  const src = logo || logoForTeam(name) || crest;
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        referrerPolicy="no-referrer"
        className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-full bg-bg-elevated p-1"
      />
    );
  }
  return (
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[10px] font-black text-text-secondary">
      {(name || "?").slice(0, 3).toUpperCase()}
    </div>
  );
}

function Unit({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2rem] px-1.5 py-1 rounded-md bg-bg-base/60 border border-border text-text-primary text-base font-black tabular-nums leading-none text-center">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[8px] uppercase tracking-wider text-text-muted font-bold">
        {label}
      </span>
    </div>
  );
}

export default function NextMatchBar() {
  const [match, setMatch] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Solo le prossime, non tutto il calendario: vedi nota in utils/matches.js
    const unsub = subscribeProssimePartite(
      (list) => {
        const t = Date.now();
        // Priorità: una partita ATTUALMENTE in corso (live dal poller)
        const liveOne = list.find((m) => getLiveState(m));
        const up = list
          .filter((m) => {
            const k = m.kickoff?.toDate?.()?.getTime?.() || 0;
            return m.status !== "finished" && k > t;
          })
          .sort(
            (a, b) =>
              (a.kickoff?.toMillis?.() || 0) - (b.kickoff?.toMillis?.() || 0)
          );
        setMatch(liveOne || up[0] || null);
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!match) return null;
  const kickoff = match.kickoff?.toDate?.();
  if (!kickoff) return null;

  const liveSt = getLiveState(match);
  const isLiveNow = !!liveSt;

  const diff = kickoff.getTime() - now;
  // API-Football dà il flag reale; per fonti vecchie stima per distanza.
  const sourceKnowsTime = match.source === "api-football";
  const far =
    match.timeConfirmed === false ||
    (!sourceKnowsTime && diff > PROVISIONAL_DAYS * 86400000);

  const days = Math.max(0, Math.floor(diff / 86400000));
  const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
  const mins = Math.max(0, Math.floor((diff % 3600000) / 60000));
  const secs = Math.max(0, Math.floor((diff % 60000) / 1000));

  return (
    <section className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 mb-2">
      <Link
        to="/calendario"
        className="group block relative overflow-hidden rounded-2xl border border-accent/30 bg-bg-surface/90 backdrop-blur-sm transition-all duration-300 hover:border-accent/60 hover:shadow-[0_0_40px_-12px_rgba(56,189,248,0.5)]"
      >
        <div className="absolute -top-16 left-1/4 w-64 h-40 bg-accent/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 sm:px-6 py-4">
          {/* Etichetta */}
          <div className="flex items-center gap-3 min-w-0">
            {isLiveNow ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-error">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
                </span>
                Partita in corso
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Prossima partita
              </span>
            )}
            <span className="hidden md:inline text-[10px] text-text-muted uppercase tracking-wider">
              {match.competition}
              {match.matchday != null ? ` · ${match.matchday}ª` : ""}
            </span>
          </div>

          {/* Squadre */}
          <div className="flex items-center gap-3 order-3 md:order-none w-full md:w-auto justify-center">
            <div className="flex items-center gap-2 min-w-0">
              <Crest name={match.homeTeam} logo={match.homeLogo} crest={match.homeCrest} />
              <span className="text-sm font-bold text-text-primary truncate max-w-[90px]">
                {match.homeTeam}
              </span>
            </div>
            {isLiveNow ? (
              <span className="text-text-primary font-black text-base tabular-nums px-1">
                {liveSt.home ?? 0} - {liveSt.away ?? 0}
              </span>
            ) : (
              <span className="text-text-muted font-black text-xs">VS</span>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-text-primary truncate max-w-[90px] text-right md:text-left">
                {match.awayTeam}
              </span>
              <Crest name={match.awayTeam} logo={match.awayLogo} crest={match.awayCrest} />
            </div>
          </div>

          {/* Countdown / Live */}
          <div className="flex items-center gap-3">
            {isLiveNow ? (
              <LiveBadge match={match} className="text-sm" />
            ) : far ? (
              <div className="text-right leading-none">
                <div
                  className="text-xl font-black text-text-primary tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  tra {days} {days === 1 ? "giorno" : "giorni"}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted font-bold mt-1">
                  Data da confermare
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                {days > 0 && <Unit value={days} label="gg" />}
                <Unit value={hours} label="ore" />
                <Unit value={mins} label="min" />
                <Unit value={secs} label="sec" />
              </div>
            )}
            <span className="text-accent transition-transform duration-300 group-hover:translate-x-1 hidden sm:inline">
              →
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
