import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

// Modulo ufficiale gratuito: non usa il credito API-Football della diretta Lazio.
// La stagione è esplicita per non mostrare un campionato diverso senza accorgercene.
// Al cambio di stagione aggiornare questi valori dal generatore widgets.sofascore.com.
const SEASON = "2026/27";
const SEASON_ID = "95836";
const SOURCE_URL = `https://www.sofascore.com/football/tournament/italy/serie-a/23#id:${SEASON_ID}`;

export default function SerieAStandings({ compact = false }) {
  const { theme } = useTheme();
  const src = `https://widgets.sofascore.com/it/embed/tournament/33/season/${SEASON_ID}/standings?widgetTitle=Serie+A&showCompetitionLogo=true&widgetTheme=${theme}`;

  return (
    <section aria-label="Classifica Serie A" className="mx-auto max-w-3xl rounded-2xl border border-border bg-bg-surface overflow-hidden">
      <div className="p-4 sm:p-6">
        <p className="text-sm text-accent font-semibold">Serie A · {SEASON}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl sm:text-4xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
            Classifica Serie A
          </h2>
          {compact && (
            <Link to="/calendario?vista=classifica" className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
              Classifica completa →
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Aggiornamenti automatici da Sofascore, anche durante le partite.
          I dati possono arrivare con ritardo rispetto al campo.
        </p>
        {compact && <p className="mt-2 text-sm text-text-muted">Scorri la tabella per vedere tutte le 20 squadre.</p>}
      </div>
      {/* Il riquadro resta scorribile: nessuna squadra o attribuzione viene rimossa.
          Non mostriamo un finto stato live: il caricamento del riquadro non prova
          che la fonte stia ricevendo gli aggiornamenti dal campo. */}
      <iframe
        title={`Classifica Serie A ${SEASON} — Sofascore`}
        src={src}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full border-0"
        style={{ height: compact ? 520 : 1123 }}
      />
      <div className="p-4 text-sm text-text-secondary border-t border-border">
        Dati forniti da{" "}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Sofascore ↗
        </a>
        <span className="block mt-1">Se la tabella non compare, puoi consultarla dal collegamento qui sopra.</span>
      </div>
    </section>
  );
}
