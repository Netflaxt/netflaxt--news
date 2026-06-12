/* ─────────────────────────────────────────────────────────────
   src/components/MatchEventIcon.jsx
   Icone degli eventi del tabellino (gol, rigore, autogol, cartellini,
   infortunio) come SVG colorabili — niente emoji. I colori usano i
   token del tema (accent/warning/error) quindi si adattano a chiaro/scuro.
     gol/rigore   → pallone ACCENT (azzurro)
     autogol      → pallone ERROR  (rosso)   + sigla "AUT."
     rigore       → pallone ACCENT (azzurro) + sigla "RIG."
     ammonizione  → cartellino GIALLO (warning)
     espulsione   → cartellino ROSSO  (error)
     infortunio   → croce medica ACCENT (azzurra) + sigla "INF."
   ───────────────────────────────────────────────────────────── */
import React from "react";
import { BallIcon } from "./icons";

// Cartellino: rettangolo arrotondato PIENO, leggermente inclinato.
function CardSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="8" y="3.5" width="9" height="17" rx="2" transform="rotate(7 12 12)" />
    </svg>
  );
}

// Infortunio: croce medica dentro un cerchio (stile line).
function MedicalSvg({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.2v7.6M8.2 12h7.6" />
    </svg>
  );
}

const MAP = {
  goal: { Cmp: BallIcon, color: "text-accent" },
  penalty: { Cmp: BallIcon, color: "text-accent" },
  owngoal: { Cmp: BallIcon, color: "text-error" },
  yellow: { Cmp: CardSvg, color: "text-warning" },
  red: { Cmp: CardSvg, color: "text-error" },
  injury: { Cmp: MedicalSvg, color: "text-accent" },
};

/** Icona colorata per un tipo di evento del tabellino. */
export function MatchEventIcon({ type, className = "w-4 h-4" }) {
  const m = MAP[type] || MAP.goal;
  const Cmp = m.Cmp;
  return <Cmp className={`${className} ${m.color} shrink-0`} />;
}

/** Sigla testuale da mettere prima del giocatore (RIG./AUT./INF.). */
export function eventPrefix(type) {
  if (type === "penalty") return "RIG.";
  if (type === "owngoal") return "AUT.";
  if (type === "injury") return "INF.";
  return "";
}
