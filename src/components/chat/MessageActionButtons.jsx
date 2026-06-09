/* ─────────────────────────────────────────────────────────────
   src/components/chat/MessageActionButtons.jsx
   Due tasti sempre visibili accanto a ogni messaggio chat:
   - "Rispondi" (freccia ↩ + testo)
   - Emoji menu (smiley) → al click apre il picker delle reazioni
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { ALLOWED_REACTIONS } from "../../utils/chatActions";

export default function MessageActionButtons({ isMe, onReply, onReact }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);

  // Chiudi popover se click fuori
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [emojiOpen]);

  // Chiudi popover con Esc
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [emojiOpen]);

  return (
    <div
      className={`flex items-center gap-1 self-center shrink-0 ${
        isMe ? "order-first mr-1" : "ml-1"
      }`}
    >
      {/* TASTO RISPONDI */}
      <button
        type="button"
        onClick={onReply}
        title="Rispondi al messaggio"
        className="group/btn inline-flex items-center gap-1 h-7 px-2 rounded-md text-text-muted hover:text-accent hover:bg-bg-elevated transition-all"
      >
        {/* Icona freccia "↩" stile invio tastiera */}
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 14l-4-4 4-4m-3 4h11a4 4 0 014 4v4"
          />
        </svg>
        <span className="text-[10px] uppercase tracking-wider font-bold hidden sm:inline">
          Rispondi
        </span>
      </button>

      {/* TASTO EMOJI ":" → apre picker */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          title="Aggiungi reazione"
          aria-label="Aggiungi reazione"
          aria-expanded={emojiOpen}
          className={`group/btn inline-flex items-center justify-center h-7 w-7 rounded-md transition-all ${
            emojiOpen
              ? "bg-accent/15 text-accent"
              : "text-text-muted hover:text-accent hover:bg-bg-elevated"
          }`}
        >
          {/* Icona smiley */}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" />
            <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" />
            {/* Piccolo "+" in basso a destra che indica "aggiungi" */}
            <path
              strokeLinecap="round"
              strokeWidth={2.2}
              d="M18 17v3M16.5 18.5h3"
            />
          </svg>
        </button>

        {/* Emoji picker popover */}
        {emojiOpen && (
          <div
            ref={pickerRef}
            className={`absolute z-40 ${
              isMe ? "right-0" : "left-0"
            } bottom-full mb-2 emoji-picker-pop`}
          >
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-bg-elevated border border-border shadow-2xl backdrop-blur-md">
              {ALLOWED_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onReact(emoji);
                    setEmojiOpen(false);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-bg-base/80 flex items-center justify-center text-base transition-transform hover:scale-125 active:scale-95"
                  title={`Reagisci con ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes emoji-picker-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .emoji-picker-pop {
          animation: emoji-picker-pop 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
