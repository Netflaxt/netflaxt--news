/* ─────────────────────────────────────────────────────────────
   src/components/DidYouKnowBubble.jsx
   Bolla in basso a destra che mostra un "Sapevi che..." casuale
   ogni N minuti. Chiudibile, riprende l'intervallo.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { randomLazioFact, randomLazioFactExcept } from "../utils/lazioFacts";

const INTERVAL_MIN = 15;
const STORAGE_LAST = "netflaxt_dyk_last";
const STORAGE_DISMISSED = "netflaxt_dyk_dismissed";
const DISMISS_HOURS = 6;

export default function DidYouKnowBubble() {
  const [open, setOpen] = useState(false);
  const [fact, setFact] = useState("");
  const [version, setVersion] = useState(0); // forza re-render anche se la stringa è "uguale"
  const timerRef = useRef(null);

  const showNew = () => {
    const f = randomLazioFact();
    setFact(f);
    setOpen(true);
    try {
      localStorage.setItem(STORAGE_LAST, String(Date.now()));
    } catch {}
  };

  const scheduleNext = () => {
    clearTimeout(timerRef.current);
    let last = 0;
    try {
      last = Number(localStorage.getItem(STORAGE_LAST)) || 0;
    } catch {}
    const elapsed = Date.now() - last;
    const interval = INTERVAL_MIN * 60 * 1000;
    const wait = Math.max(0, interval - elapsed);
    timerRef.current = setTimeout(() => {
      // Verifica se l'utente non ha appena chiuso
      try {
        const dismissedAt = Number(localStorage.getItem(STORAGE_DISMISSED)) || 0;
        if (Date.now() - dismissedAt < DISMISS_HOURS * 3600 * 1000) {
          scheduleNext();
          return;
        }
      } catch {}
      showNew();
    }, wait);
  };

  useEffect(() => {
    // Prima apparizione: aspetta 60s dal mount così non disturba l'arrivo
    timerRef.current = setTimeout(() => {
      try {
        const dismissedAt = Number(localStorage.getItem(STORAGE_DISMISSED)) || 0;
        if (Date.now() - dismissedAt < DISMISS_HOURS * 3600 * 1000) {
          scheduleNext();
          return;
        }
      } catch {}
      showNew();
    }, 60_000);

    return () => clearTimeout(timerRef.current);
  }, []);

  // Dopo che si chiude, schedula il prossimo
  useEffect(() => {
    if (!open) scheduleNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_DISMISSED, String(Date.now()));
    } catch {}
  };

  const next = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFact((current) => randomLazioFactExcept(current));
    setVersion((v) => v + 1);
    try {
      localStorage.setItem(STORAGE_LAST, String(Date.now()));
    } catch {}
  };

  if (!open || !fact) return null;

  return (
    <div data-no-twemoji className="fixed bottom-4 right-4 z-40 max-w-sm nf-dyk-pop">
      <div className="relative rounded-2xl bg-bg-surface border border-accent/40 shadow-[0_10px_40px_-10px_rgba(56,189,248,0.5)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent-hover to-accent" />
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center">
              <span className="text-lg" aria-hidden="true">💡</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold mb-1">
                Sapevi che…
              </div>
              <p
                key={version}
                className="text-sm text-text-primary leading-relaxed nf-dyk-fact-fade"
              >
                {fact}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition flex items-center justify-center"
              aria-label="Chiudi"
              title="Nascondi per 6 ore"
            >
              ✕
            </button>
          </div>
          <div className="mt-3">
            <button
              onClick={next}
              className="text-[11px] uppercase tracking-wider text-text-secondary hover:text-accent font-bold transition"
            >
              Altra curiosità →
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes nf-dyk-pop-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nf-dyk-pop {
          animation: nf-dyk-pop-in 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes nf-dyk-fact-fade-kf {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nf-dyk-fact-fade {
          animation: nf-dyk-fact-fade-kf 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
