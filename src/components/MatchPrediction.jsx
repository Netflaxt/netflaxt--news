/* ─────────────────────────────────────────────────────────────
   src/components/MatchPrediction.jsx
   Widget di pronostico per una partita (#25).
   L'utente inserisce il risultato esatto; l'esito 1X2 è derivato
   automaticamente. Pronostico modificabile fino al kickoff.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getUserPrediction,
  setPrediction,
  subscribeMatchPredictions,
  outcomeOf,
  POINTS,
  PREDICTIONS_OPEN_DAYS_BEFORE,
  predictionsOpenAtMs,
} from "../utils/predictions";

const OUTCOME_LABEL = { "1": "1 (Casa)", X: "X (Pari)", "2": "2 (Trasferta)" };

/* Barra percentuale animata (riempimento + count-up del numero) */
function AnimatedPercentBar({ label, pct, color }) {
  const [w, setW] = useState(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => setW(pct));
    let raf2;
    const start = performance.now();
    const dur = 900;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(pct * eased));
      if (p < 1) raf2 = requestAnimationFrame(tick);
    };
    raf2 = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [pct]);

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-black tabular-nums" style={{ color }}>
          {display}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
          style={{
            width: `${w}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 12px -2px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

/* Statistiche: % di altri utenti con lo stesso pronostico */
function VoteStats({ matchId, myOutcome, myHome, myAway, currentUid }) {
  const [preds, setPreds] = useState([]);
  useEffect(() => {
    const unsub = subscribeMatchPredictions(matchId, setPreds);
    return () => unsub();
  }, [matchId]);

  const others = preds.filter((p) => p.uid !== currentUid);
  const total = others.length;

  if (total === 0) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-bg-base/40 px-4 py-3 text-center text-xs text-text-muted">
        Sei il primo a pronosticare questa partita 🦅
      </div>
    );
  }

  const sameOutcome = others.filter((p) => p.outcome === myOutcome).length;
  const sameExact = others.filter(
    (p) => Number(p.homeScore) === Number(myHome) && Number(p.awayScore) === Number(myAway)
  ).length;
  const pctOutcome = Math.round((sameOutcome / total) * 100);
  const pctExact = Math.round((sameExact / total) * 100);

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg-base/40 px-4 py-3 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-text-muted">
        Cosa pensano gli altri · {total} {total === 1 ? "tifoso" : "tifosi"}
      </div>
      <AnimatedPercentBar
        label={`Stesso esito (${OUTCOME_LABEL[myOutcome] || myOutcome})`}
        pct={pctOutcome}
        color="#38BDF8"
      />
      <AnimatedPercentBar
        label={`Stesso risultato esatto (${myHome}–${myAway})`}
        pct={pctExact}
        color="#10B981"
      />
    </div>
  );
}

function Stepper({ label, value, onChange, disabled }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold truncate max-w-[90px]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          className="w-7 h-7 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition disabled:opacity-30"
          aria-label="Diminuisci"
        >
          −
        </button>
        <span className="w-8 text-center text-2xl font-black tabular-nums text-text-primary">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(20, value + 1))}
          disabled={disabled}
          className="w-7 h-7 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition disabled:opacity-30"
          aria-label="Aumenta"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function MatchPrediction({ match }) {
  const { user } = useAuth();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const kickoff = match.kickoff?.toDate?.() || (match.kickoff ? new Date(match.kickoff) : null);
  const kickoffMs = kickoff ? kickoff.getTime() : null;
  const locked = (kickoffMs != null && kickoffMs <= Date.now()) || match.status !== "scheduled";
  // Pronostici non ancora aperti: partita futura ma manca più della finestra
  const opensAt = predictionsOpenAtMs(match);
  const notYetOpen = !locked && opensAt != null && Date.now() < opensAt;
  const finished = match.status === "finished";

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getUserPrediction(match.id, user.uid)
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setExisting(p);
          setHome(p.homeScore ?? 0);
          setAway(p.awayScore ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [match.id, user?.uid]);

  const derived = outcomeOf(home, away);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await setPrediction({
        match,
        user,
        outcome: derived,
        homeScore: home,
        awayScore: away,
      });
      setExisting({ outcome: derived, homeScore: home, awayScore: away, points: null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-bg-base/40 px-4 py-3 text-center text-xs text-text-secondary">
        <Link to="/login" className="font-bold text-accent hover:underline">
          Accedi
        </Link>{" "}
        per pronosticare questa partita.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-bg-base/40 px-4 py-4 flex justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Pronostico non ancora aperto (apre N giorni prima del match) ──
  if (notYetOpen) {
    const opensDate = new Date(opensAt);
    const timeConfirmed = match.timeConfirmed !== false;
    return (
      <div className="rounded-lg border border-border bg-bg-base/40 px-4 py-3 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary">
          <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pronostici non ancora aperti
        </div>
        <div className="mt-1 text-[11px] text-text-muted">
          Si aprono{" "}
          <span className="font-semibold text-text-secondary">
            {PREDICTIONS_OPEN_DAYS_BEFORE} giorni prima
          </span>{" "}
          della partita · da{" "}
          <span className="text-text-secondary font-semibold">
            {opensDate.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" })}
            {timeConfirmed &&
              ` · ${opensDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
        </div>
      </div>
    );
  }

  // ── Vista bloccata (kickoff passato / partita finita) ──
  if (locked) {
    if (!existing) {
      return (
        <div className="rounded-lg border border-border bg-bg-base/40 px-4 py-3 text-center text-xs text-text-muted">
          {finished
            ? "Partita terminata · non avevi pronosticato"
            : "Pronostici chiusi (partita iniziata) · non hai pronosticato in tempo"}
        </div>
      );
    }
    const pts = existing.points;
    return (
      <div>
        <div className="rounded-lg border border-border bg-bg-base/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-text-secondary">
              Il tuo pronostico:{" "}
              <span className="font-bold text-text-primary tabular-nums">
                {existing.homeScore}–{existing.awayScore}
              </span>{" "}
              <span className="text-text-muted">({existing.outcome})</span>
            </div>
            {finished && pts != null && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                  pts === POINTS.exact
                    ? "bg-success/15 border-success/40 text-success"
                    : pts === POINTS.outcome
                    ? "bg-accent/15 border-accent/40 text-accent"
                    : "bg-bg-elevated border-border text-text-muted"
                }`}
              >
                {pts === POINTS.exact
                  ? "+3 esatto!"
                  : pts === POINTS.outcome
                  ? "+1 esito"
                  : "0 punti"}
              </span>
            )}
            {finished && pts == null && (
              <span className="text-[10px] text-text-muted">in valutazione…</span>
            )}
          </div>
        </div>
        <VoteStats
          matchId={match.id}
          myOutcome={existing.outcome}
          myHome={existing.homeScore}
          myAway={existing.awayScore}
          currentUid={user.uid}
        />
      </div>
    );
  }

  // ── Vista pronostico aperto ──
  return (
    <div className="rounded-lg border border-accent/25 bg-bg-base/40 px-4 py-4">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <Stepper label={match.homeTeam} value={home} onChange={setHome} disabled={saving} />
        <span className="text-text-muted font-black text-lg pt-4">:</span>
        <Stepper label={match.awayTeam} value={away} onChange={setAway} disabled={saving} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-text-muted">
        Esito:
        <span className="font-bold text-accent">{OUTCOME_LABEL[derived]}</span>
      </div>

      {error && (
        <div className="mt-3 p-2 rounded-md bg-error/10 border border-error/30 text-error text-xs text-center">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-accent text-text-inverse text-sm font-bold transition hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] disabled:opacity-50"
        >
          {saving ? "Salvo…" : existing ? "Aggiorna pronostico" : "Salva pronostico"}
        </button>
        {saved && (
          <span className="text-xs font-semibold text-success">✓ Salvato</span>
        )}
      </div>

      {existing && (
        <VoteStats
          matchId={match.id}
          myOutcome={existing.outcome}
          myHome={existing.homeScore}
          myAway={existing.awayScore}
          currentUid={user.uid}
        />
      )}
    </div>
  );
}
