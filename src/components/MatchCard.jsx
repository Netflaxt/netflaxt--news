/* ─────────────────────────────────────────────────────────────
   src/components/MatchCard.jsx
   Card di una partita (#16). Mostra squadre, risultato/orario,
   competizione e stato. Accetta children (es. widget pronostico).
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { logoForTeam } from "../utils/teamLogos";
import { MatchEventIcon, eventPrefix } from "./MatchEventIcon";
import LiveBadge, { getLiveState } from "./LiveBadge";

function TimeUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.1rem] px-1.5 py-1 rounded-md bg-bg-elevated border border-border text-text-primary text-lg font-black tabular-nums leading-none text-center">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-wider text-text-muted font-bold">{label}</span>
    </div>
  );
}

function MatchCountdown({ kickoff, timeConfirmed = true, label = "Orario da definire" }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!kickoff) return null;

  // Data/orario non ancora ufficiali (partita lontana o ora non fissata) →
  // mostriamo la data provvisoria, niente countdown al secondo (ingannevole).
  if (!timeConfirmed) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-bg-base/40 px-3 py-2.5 text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-text-muted mb-1">
          {kickoff.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" })}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {label}
        </span>
      </div>
    );
  }

  const diff = kickoff.getTime() - now;

  if (diff <= 0) {
    return (
      <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent uppercase tracking-wider">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Sta per iniziare
        </span>
      </div>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="mt-4 rounded-lg border border-border bg-bg-base/40 px-3 py-2.5">
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <svg className="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-text-muted">
          Quanto manca al match
        </span>
      </div>
      <div className="flex items-start justify-center gap-2">
        {d > 0 && <TimeUnit value={d} label="giorni" />}
        <TimeUnit value={h} label="ore" />
        <TimeUnit value={m} label="min" />
        <TimeUnit value={s} label="sec" />
      </div>
    </div>
  );
}

function crestInitials(name = "") {
  return name.replace(/[^a-zA-ZÀ-ÿ ]/g, "").slice(0, 3).toUpperCase() || "?";
}

function TeamCrest({ name, logo, crest }) {
  const [broken, setBroken] = useState(false);
  // Priorità: logo personalizzato admin → logo locale → crest dall'API
  const src = logo || logoForTeam(name) || crest;
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className="w-12 h-12 object-contain rounded-full bg-bg-elevated p-1"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-xs font-black text-text-secondary">
      {crestInitials(name)}
    </div>
  );
}

function MatchEvents({ events }) {
  const homeGoals = [];
  const awayGoals = [];
  const others = [];
  events.forEach((e) => {
    if (["goal", "penalty", "owngoal"].includes(e.type)) {
      const benefits = e.type === "owngoal" ? (e.team === "home" ? "away" : "home") : e.team;
      const entry = { type: e.type, player: e.player, minute: e.minute };
      (benefits === "home" ? homeGoals : awayGoals).push(entry);
    } else {
      others.push(e);
    }
  });

  if (homeGoals.length === 0 && awayGoals.length === 0 && others.length === 0) return null;

  const fmtMin = (m) => (m != null ? `${m}'` : "");

  const goalRow = (g, i, right) => {
    const prefix = eventPrefix(g.type);
    return (
      <div
        key={i}
        className={`flex items-center gap-1.5 min-w-0 ${right ? "flex-row-reverse" : ""}`}
      >
        <MatchEventIcon type={g.type} className="w-3.5 h-3.5" />
        <span className="truncate text-text-secondary">
          {prefix && <span className="font-bold text-text-muted">{prefix} </span>}
          {g.player || "?"}
          {g.minute != null && <span className="text-text-muted tabular-nums"> {g.minute}'</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-bg-base/40 p-3">
      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted font-bold mb-2 text-center">
        Tabellino
      </div>
      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1.5 min-w-0">
            {homeGoals.map((g, i) => goalRow(g, i, false))}
          </div>
          <div className="space-y-1.5 min-w-0">
            {awayGoals.map((g, i) => goalRow(g, i, true))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border-subtle flex flex-wrap gap-1.5 justify-center">
          {others.map((e, i) => {
            const prefix = eventPrefix(e.type);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated border border-border text-text-secondary"
              >
                <MatchEventIcon type={e.type} className="w-3 h-3" />
                {prefix && <span className="font-bold">{prefix}</span>}
                {e.player || ""} {fmtMin(e.minute)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatKickoff(date, timeConfirmed = true, label = "orario da definire") {
  if (!date) return "—";
  if (!timeConfirmed) {
    return (
      date.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" }) +
      " · " +
      label.toLowerCase()
    );
  }
  return date.toLocaleString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Oltre ~5 settimane il calendario Serie A non è ancora ufficiale: la Lega
// fissa giorno/ora di ogni turno solo a ridosso. Queste partite le segnaliamo
// come "Data da confermare" (la data mostrata è provvisoria).
const PROVISIONAL_DAYS = 35;

export default function MatchCard({ match, children }) {
  const kickoff = match.kickoff?.toDate?.() || (match.kickoff ? new Date(match.kickoff) : null);
  const finished = match.status === "finished";
  const liveSt = getLiveState(match); // stato live dal poller (o null)
  const isLiveNow = !!liveSt;
  const hasScore = match.homeScore != null && match.awayScore != null;
  // La fonte API-Football dice da sola se l'orario è ufficiale (timeConfirmed).
  // Per le fonti più vecchie (TheSportsDB/manuali) usiamo la stima per distanza
  // (>5 settimane = probabilmente provvisoria).
  const sourceKnowsTime = match.source === "api-football";
  const far =
    !sourceKnowsTime &&
    !finished &&
    !isLiveNow &&
    kickoff &&
    kickoff.getTime() - Date.now() > PROVISIONAL_DAYS * 86400000;
  const timeConfirmed = match.timeConfirmed !== false && !far;
  const provLabel = "Data da confermare";

  // Spotlight: l'alone biancoceleste segue il cursore (il CSS lo mostra
  // solo su desktop con mouse → su touch non compare, niente costo mobile).
  const handleSpotlight = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      onMouseMove={handleSpotlight}
      className="relative nf-spotlight rounded-2xl bg-bg-surface border border-border overflow-hidden transition-all hover:border-border-strong"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-accent truncate">
            {match.competition || "Partita"}
          </span>
          {match.matchday != null && (
            <span className="text-[10px] text-text-muted">· {match.matchday}ª giornata</span>
          )}
        </div>
        {isLiveNow ? (
          <LiveBadge match={match} className="text-[10px]" />
        ) : finished ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Finita</span>
        ) : (
          <span className="text-[10px] font-semibold text-text-secondary tabular-nums">
            {formatKickoff(kickoff, timeConfirmed, provLabel)}
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="px-4 py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 text-center min-w-0">
            <TeamCrest name={match.homeTeam} logo={match.homeLogo} crest={match.homeCrest} />
            <span className="text-sm font-bold text-text-primary leading-tight break-words">
              {match.homeTeam}
            </span>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center">
            {hasScore || isLiveNow ? (
              <div className="text-3xl font-black tabular-nums text-text-primary flex items-center gap-2">
                <span>{isLiveNow ? liveSt.home ?? 0 : match.homeScore ?? 0}</span>
                <span className="text-text-muted">:</span>
                <span>{isLiveNow ? liveSt.away ?? 0 : match.awayScore ?? 0}</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-xs font-bold text-text-secondary tabular-nums">
                {!kickoff
                  ? "VS"
                  : timeConfirmed
                  ? kickoff.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
                  : "VS"}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 text-center min-w-0">
            <TeamCrest name={match.awayTeam} logo={match.awayLogo} crest={match.awayCrest} />
            <span className="text-sm font-bold text-text-primary leading-tight break-words">
              {match.awayTeam}
            </span>
          </div>
        </div>

        {/* Countdown (solo partite in programma, non live/finite) */}
        {!finished && !isLiveNow && (
          <MatchCountdown kickoff={kickoff} timeConfirmed={timeConfirmed} label={provLabel} />
        )}
      </div>

      {/* Tabellino: a fine partita e anche DURANTE il live, così gol e
          cartellini compaiono man mano che succedono. */}
      {(finished || isLiveNow) && Array.isArray(match.events) && match.events.length > 0 && (
        <div className="px-4 pb-4">
          <MatchEvents events={match.events} />
        </div>
      )}

      {/* Slot pronostico / extra */}
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
