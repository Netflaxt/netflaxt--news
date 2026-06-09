/* ─────────────────────────────────────────────────────────────
   src/components/chat/ReplyComposer.jsx
   Chip mostrato SOPRA l'input quando stai rispondendo a un msg.
   ───────────────────────────────────────────────────────────── */
import React from "react";

export default function ReplyComposer({ replyTo, onCancel }) {
  if (!replyTo) return null;

  return (
    <div className="mb-2 px-3 py-2 rounded-lg bg-accent/8 border border-accent/30 flex items-start gap-3 reply-composer-in">
      <div className="w-1 self-stretch rounded-full bg-accent shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-accent">
          Rispondi a {replyTo.displayName}
        </div>
        <div className="text-xs text-text-secondary truncate mt-0.5">
          {replyTo.text}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition flex items-center justify-center text-sm"
        aria-label="Annulla risposta"
        title="Annulla risposta"
      >
        ✕
      </button>

      <style>{`
        @keyframes reply-composer-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reply-composer-in {
          animation: reply-composer-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
