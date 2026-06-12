/* ─────────────────────────────────────────────────────────────
   src/components/LiveBadge.jsx
   Stato LIVE di una partita (minuto, recupero, intervallo, fine).
   I campi live vengono scritti su Firestore dal poller (Cloudflare
   Worker) durante la partita:
     live: boolean
     liveStatus: "1H"|"HT"|"2H"|"ET"|"BT"|"P"|"FT"|"AET"|"PEN"
     liveMinute: number   (minuto corrente, es. 67)
     liveExtra: number|null (minuti di recupero, es. 5 → 45+5')
     liveHome, liveAway: number (risultato live)
     liveUpdatedAt: Timestamp (per interpolare + scartare dati vecchi)
   Il badge interpola il minuto col clock locale → ticchetta ogni minuto
   anche se il poller aggiorna ogni 2 min. Se i dati sono vecchi (poller
   fermo) smette di considerarla live.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";

const STALE_MS = 15 * 60 * 1000; // oltre 15 min senza aggiornamenti → non live
const IN_PLAY = ["1H", "2H", "ET"];

function updatedMs(match) {
  const u = match?.liveUpdatedAt;
  return u?.toMillis?.() ?? (u ? new Date(u).getTime() : 0);
}

/** Stato live "valido" del match, o null se non è (più) live. */
export function getLiveState(match) {
  if (!match?.live) return null;
  const updated = updatedMs(match);
  if (updated && Date.now() - updated > STALE_MS) return null;
  return {
    status: match.liveStatus || "",
    minute: match.liveMinute ?? null,
    extra: match.liveExtra ?? null,
    home: match.liveHome ?? null,
    away: match.liveAway ?? null,
    updated,
  };
}

export function isLive(match) {
  return !!getLiveState(match);
}

// Interpolazione: minuti passati dall'ultimo aggiornamento (max 3, così se
// il poller si ferma il timer non "scappa").
function interp(updated, now) {
  if (!updated) return 0;
  return Math.min(3, Math.max(0, Math.floor((now - updated) / 60000)));
}

/** Testo + tono dello stato live. */
export function liveLabel(s, now) {
  const code = s.status;
  if (code === "HT" || code === "BT") return { text: "Fine 1º tempo", tone: "warn", dot: false };
  if (code === "P") return { text: "Rigori", tone: "live", dot: true };
  if (["FT", "AET", "PEN"].includes(code)) return { text: "Fine partita", tone: "muted", dot: false };
  // In gioco
  const k = interp(s.updated, now);
  if (s.extra != null) {
    const base = s.minute != null ? s.minute : code === "1H" ? 45 : 90;
    return { text: `${base}+${s.extra + k}'`, tone: "live", dot: true };
  }
  const m = (s.minute ?? 0) + k;
  return { text: `${m}'`, tone: "live", dot: true };
}

const TONE = {
  live: "text-error",
  warn: "text-warning",
  muted: "text-text-muted",
};

export default function LiveBadge({ match, className = "" }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const s = getLiveState(match);
  if (!s) return null;
  const { text, tone, dot } = liveLabel(s, now);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider ${TONE[tone]} ${className}`}
    >
      {dot && (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
          </span>
          <span>Live</span>
        </>
      )}
      <span className="tabular-nums">{text}</span>
    </span>
  );
}
