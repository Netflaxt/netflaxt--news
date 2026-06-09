/* ─────────────────────────────────────────────────────────────
   src/components/chat/MessageReactions.jsx
   Barra delle reazioni sotto un messaggio chat.
   ───────────────────────────────────────────────────────────── */
import React from "react";
import { parseReactions, toggleReaction } from "../../utils/chatActions";

export default function MessageReactions({
  messageId,
  reactions,
  currentUid,
  isMe,
}) {
  const parsed = parseReactions(reactions);
  if (parsed.length === 0) return null;

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1 ${isMe ? "justify-end" : "justify-start"}`}
    >
      {parsed.map((r) => {
        const isMine = r.uids.includes(currentUid);
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => toggleReaction(messageId, r.emoji, currentUid)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all duration-200 ${
              isMine
                ? "bg-accent/15 border-accent/40 text-accent"
                : "bg-bg-elevated border-border text-text-secondary hover:border-border-strong"
            }`}
            title={
              isMine
                ? `Hai reagito con ${r.emoji}`
                : `${r.count} ${r.count === 1 ? "tifoso" : "tifosi"} con ${r.emoji}`
            }
          >
            <span className="text-sm leading-none">{r.emoji}</span>
            <span className="tabular-nums font-bold">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}
