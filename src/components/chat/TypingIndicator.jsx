/* ─────────────────────────────────────────────────────────────
   src/components/chat/TypingIndicator.jsx
   Mostra "X sta scrivendo..." quando altri utenti stanno digitando.
   ───────────────────────────────────────────────────────────── */
import React from "react";

export default function TypingIndicator({ typers }) {
  if (!typers || typers.length === 0) return null;

  // Costruisce il testo "Mario sta scrivendo..." / "Mario e Luigi stanno scrivendo..."
  let label;
  if (typers.length === 1) {
    label = `${typers[0].displayName} sta scrivendo`;
  } else if (typers.length === 2) {
    label = `${typers[0].displayName} e ${typers[1].displayName} stanno scrivendo`;
  } else {
    label = `${typers[0].displayName} e altri ${typers.length - 1} stanno scrivendo`;
  }

  return (
    <div className="px-4 pt-2 pb-1 typing-fade-in">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-elevated/60 border border-border text-text-secondary">
        {/* 3 puntini animati */}
        <span className="inline-flex gap-0.5">
          <span className="typing-dot" style={{ animationDelay: "0ms" }} />
          <span className="typing-dot" style={{ animationDelay: "150ms" }} />
          <span className="typing-dot" style={{ animationDelay: "300ms" }} />
        </span>
        <span className="text-xs font-medium italic">{label}</span>
      </div>

      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-accent, #38BDF8);
          animation: typing-bounce 1.2s ease-in-out infinite;
        }

        @keyframes typing-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .typing-fade-in {
          animation: typing-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
