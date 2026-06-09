/* ─────────────────────────────────────────────────────────────
   src/components/chat/PollCard.jsx
   Rende un sondaggio inline nello stream della chat (#21).
   ───────────────────────────────────────────────────────────── */
import React, { useMemo } from "react";

export default function PollCard({ m, currentUid, canManage, onVote, onClose }) {
  const votes = m.votes || {};
  const myVote = votes[currentUid] || null;
  const closed = !!m.closed;

  const counts = useMemo(() => {
    const c = {};
    (m.options || []).forEach((o) => (c[o.id] = 0));
    Object.values(votes).forEach((optId) => {
      if (c[optId] !== undefined) c[optId] += 1;
    });
    return c;
  }, [votes, m.options]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(0, ...Object.values(counts));
  const showResults = closed || !!myVote;

  return (
    <div className="rounded-2xl border border-accent/25 bg-bg-surface/80 backdrop-blur-sm p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-[9px] uppercase tracking-[0.18em] font-bold text-accent">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          Sondaggio
        </span>
        {closed && (
          <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted">
            · Chiuso
          </span>
        )}
      </div>

      <div className="text-sm font-bold text-text-primary mb-3 leading-snug">
        {m.question}
      </div>

      {/* Opzioni */}
      <div className="space-y-2">
        {(m.options || []).map((opt) => {
          const count = counts[opt.id] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = myVote === opt.id;
          const winning = showResults && count > 0 && count === maxCount;

          return (
            <button
              key={opt.id}
              onClick={() => !closed && onVote(opt.id)}
              disabled={closed}
              className={`relative w-full text-left rounded-lg border overflow-hidden transition-all ${
                mine
                  ? "border-accent/60"
                  : "border-border hover:border-accent/40"
              } ${closed ? "cursor-default" : "cursor-pointer"}`}
            >
              {/* Barra risultato */}
              {showResults && (
                <span
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    winning ? "bg-accent/20" : "bg-bg-elevated"
                  }`}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${
                      mine ? "border-accent bg-accent" : "border-border-strong"
                    }`}
                  >
                    {mine && (
                      <svg className="w-2.5 h-2.5 text-text-inverse" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-text-primary truncate">{opt.text}</span>
                </span>
                {showResults && (
                  <span className="shrink-0 text-xs font-bold tabular-nums text-text-secondary">
                    {pct}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-text-muted">
        <span className="tabular-nums">
          {total} {total === 1 ? "voto" : "voti"}
          {!closed && !myVote && " · tocca per votare"}
          {!closed && myVote && " · tocca di nuovo per cambiare"}
        </span>
        {canManage && !closed && (
          <button
            onClick={onClose}
            className="font-bold text-text-muted hover:text-error transition uppercase tracking-wider"
          >
            Chiudi sondaggio
          </button>
        )}
      </div>
    </div>
  );
}
