/* ─────────────────────────────────────────────────────────────
   src/components/ReadingTime.jsx
   Tempo di lettura stimato di un articolo.

   ⚠️ NON contare le parole spezzando il testo grezzo sugli spazi.
   Il contenuto degli articoli è HTML e spesso incollato da altri siti:
   i tag vanno tolti e le entità (&nbsp;, &amp;, &egrave;…) vanno
   convertite nei caratteri veri PRIMA di contare. Senza, un articolo
   incollato da un sito diventa una manciata di parole — il primo
   articolo pubblicato ne dichiarava 43 invece di circa 450, perché
   ogni spazio era scritto come `&nbsp;` e quindi non separava niente
   (visto in produzione il 24/08/2026).
   ───────────────────────────────────────────────────────────── */
import React, { useMemo } from "react";

/* Velocità di lettura silenziosa di un adulto in italiano.
   Le misurazioni si collocano fra 200 e 250 parole al minuto per un
   testo giornalistico; 220 sta in mezzo ed è la stima che sbaglia di
   meno in entrambe le direzioni. */
const PAROLE_AL_MINUTO = 220;

/** Ricava il testo leggibile da un contenuto che può essere HTML. */
function testoLeggibile(contenuto) {
  if (typeof contenuto !== "string" || !contenuto) return "";

  /* I tag diventano spazi, non nulla: altrimenti `<p>ciao</p><p>mondo</p>`
     si trasformerebbe in "ciaomondo", una parola sola invece di due. */
  const senzaTag = contenuto
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  /* Le entità diventano caratteri veri. Il textarea è il modo sicuro
     per farlo: il suo contenuto viene letto come testo, quindi niente
     di ciò che c'è dentro può essere eseguito. */
  if (typeof document !== "undefined") {
    try {
      const area = document.createElement("textarea");
      area.innerHTML = senzaTag;
      return area.value;
    } catch {
      /* si prosegue con la conversione manuale qui sotto */
    }
  }
  return senzaTag
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Quante parole contiene un articolo e quanto ci vuole a leggerlo.
 * Restituisce { words, minutes }.
 */
export function computeReadingTime(content) {
  const testo = testoLeggibile(content)
    // spazi "speciali" che il copia-incolla si porta dietro
    .replace(/[   ​﻿]/g, " ");

  const words = testo
    .trim()
    .split(/\s+/)
    /* Conta come parola solo ciò che contiene almeno una lettera o una
       cifra: trattini, virgolette e frecce lasciati soli dalla pulizia
       dei tag non devono gonfiare il totale. */
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

  if (!words) return { words: 0, minutes: 0 };

  const minutes = Math.max(1, Math.round(words / PAROLE_AL_MINUTO));
  return { words, minutes };
}

export default function ReadingTime({
  content,
  words: wordsOverride,
  minutes: minutesOverride,
  showWords = true,
  className = "",
}) {
  const { words, minutes } = useMemo(() => {
    if (typeof wordsOverride === "number" && typeof minutesOverride === "number") {
      return { words: wordsOverride, minutes: minutesOverride };
    }
    return computeReadingTime(content);
  }, [content, wordsOverride, minutesOverride]);

  if (minutes === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border text-text-secondary ${className}`}
    >
      <svg
        className="h-3.5 w-3.5 text-accent shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" />
      </svg>
      <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
        {minutes} min di lettura
      </span>
      {showWords && words > 0 && (
        <span className="text-[10px] text-text-muted tabular-nums whitespace-nowrap">
          · {words} parole
        </span>
      )}
    </div>
  );
}
