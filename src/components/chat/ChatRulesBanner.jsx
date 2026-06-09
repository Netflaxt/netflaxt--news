/* ─────────────────────────────────────────────────────────────
   src/components/chat/ChatRulesBanner.jsx
   Banner fissato sopra la chat con le regole di comportamento e
   le conseguenze (sospensioni progressive). Espandibile con click,
   richiudibile, salva la preferenza in localStorage.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "netflaxt:chat-rules-open";

export default function ChatRulesBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      // Default: aperto la prima volta che si entra in chat
      setOpen(v === null ? true : v === "1");
    } catch {
      setOpen(true);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <div className="sticky top-0 z-30 mx-3 sm:mx-4 mt-3 mb-2">
      <div className="rounded-xl bg-error/8 border border-error/40 shadow-lg backdrop-blur-md overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-error/5 transition"
        >
          <div className="shrink-0 w-9 h-9 rounded-lg bg-error/15 border border-error/40 flex items-center justify-center">
            <WarningTriangle className="w-5 h-5 text-error" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-error font-black">
              Le regole della chat
            </div>
            <div className="text-sm font-semibold text-text-primary leading-tight truncate">
              Leggi prima di scrivere · sospensioni in caso di violazione
            </div>
          </div>
          <svg
            className={`shrink-0 w-4 h-4 text-text-muted transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="px-4 pb-4 pt-1 border-t border-error/20 space-y-3 nf-chat-rules-in">
            {/* Cosa NON fare */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-error font-bold mb-2">
                Cosa NON è ammesso
              </div>
              <ul className="grid sm:grid-cols-2 gap-1.5 text-xs text-text-secondary">
                {[
                  "Bestemmie di qualsiasi tipo",
                  "Insulti razziali, omofobi o sessisti",
                  "Minacce o incitamento alla violenza",
                  "Spam, pubblicità e link sospetti",
                  "Contenuti offensivi verso altri tifosi",
                  "Falsa identità o impersonificazione",
                  "Diffusione di dati personali altrui",
                  "Off-topic eccessivo o trolling",
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="shrink-0 text-error mt-0.5">✕</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sanzioni */}
            <div className="pt-2 border-t border-error/15">
              <div className="text-[10px] uppercase tracking-[0.22em] text-error font-bold mb-2">
                Conseguenze (progressive)
              </div>
              <div className="grid sm:grid-cols-4 gap-1.5 text-[11px]">
                <Sanction n="1" label="Avviso" duration="solo richiamo" />
                <Sanction n="2" label="Sospensione" duration="24 ore" />
                <Sanction n="3" label="Sospensione" duration="7 giorni" />
                <Sanction n="4" label="Account chiuso" duration="permanente" />
              </div>
            </div>

            <div className="pt-2 border-t border-error/15 text-[11px] text-text-muted leading-relaxed">
              Le sospensioni sono <span className="text-text-secondary font-semibold">automatiche</span>{" "}
              al rilevamento di contenuti vietati. Se ritieni di essere stato sospeso
              ingiustamente puoi presentare ricorso dal tuo profilo: l'admin riceverà
              la motivazione e deciderà se annullare la sospensione.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes nf-chat-rules-in-kf {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nf-chat-rules-in { animation: nf-chat-rules-in-kf 0.25s ease-out; }
      `}</style>
    </div>
  );
}

function WarningTriangle({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 L22 20 H2 Z" opacity="0.18" />
      <path
        d="M12 4.2 L20.4 19 H3.6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="17" r="1.1" />
    </svg>
  );
}

function Sanction({ n, label, duration }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-bg-base/40 border border-border">
      <span className="shrink-0 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center text-[10px] font-black">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-text-primary font-bold text-[11px] leading-tight">
          {label}
        </div>
        <div className="text-text-muted text-[10px] leading-tight">{duration}</div>
      </div>
    </div>
  );
}
