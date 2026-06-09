/* ─────────────────────────────────────────────────────────────
   src/components/ReadingTime.jsx
   Calcola e mostra il tempo di lettura stimato (220 wpm IT).
   ───────────────────────────────────────────────────────────── */
import React, { useMemo } from "react";

/**
 * Calcola parole e minuti da un contenuto (string o HTML).
 * 220 parole/minuto = velocità media italiana di lettura.
 */
export function computeReadingTime(content) {
  if (!content) return { words: 0, minutes: 0 };
  // Rimuove tag HTML se presenti
  const text = typeof content === "string" ? content.replace(/<[^>]+>/g, " ") : "";
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return { words, minutes };
}

export default function ReadingTime({ content, words: wordsOverride, minutes: minutesOverride, showWords = true, className = "" }) {
  const { words, minutes } = useMemo(() => {
    if (typeof wordsOverride === "number" && typeof minutesOverride === "number") {
      return { words: wordsOverride, minutes: minutesOverride };
    }
    return computeReadingTime(content);
  }, [content, wordsOverride, minutesOverride]);

  if (minutes === 0) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border text-text-secondary ${className}`}>
      <svg className="h-3.5 w-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
