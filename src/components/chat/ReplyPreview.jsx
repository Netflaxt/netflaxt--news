/* ─────────────────────────────────────────────────────────────
   src/components/chat/ReplyPreview.jsx
   Citazione del messaggio originale mostrata DENTRO il bubble
   del messaggio di risposta (sopra il testo).
   ───────────────────────────────────────────────────────────── */
import React from "react";

export default function ReplyPreview({ replyTo, onClick, isMe }) {
  if (!replyTo) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left mb-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
        isMe
          ? "bg-black/15 border-white/15 hover:bg-black/25"
          : "bg-bg-base/40 border-border hover:bg-bg-base/70"
      }`}
      title="Vai al messaggio originale"
    >
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-bold ${
          isMe ? "text-white/80" : "text-accent"
        }`}
      >
        ↳ {replyTo.displayName}
      </div>
      <div
        className={`text-[11px] leading-snug truncate ${
          isMe ? "text-white/80" : "text-text-secondary"
        }`}
      >
        {replyTo.text}
      </div>
    </button>
  );
}
