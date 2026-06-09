/* ─────────────────────────────────────────────────────────────
   src/components/FlyEagleButton.jsx
   CTA estetico in home che fa volare l'aquila biancoceleste.
   Dispatcha l'evento custom raccolto da EagleEasterEgg.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { EAGLE_TRIGGER_EVENT } from "./EagleEasterEgg";
import usePwaInstall from "../hooks/usePwaInstall";

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

export default function FlyEagleButton() {
  const [pressed, setPressed] = useState(false);
  const [count, setCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const cooldownRef = useRef(false);
  const { platform } = usePwaInstall();

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const showAppHint = isMobile && platform !== "installed";

  const handleClick = () => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setPressed(true);
    setCount((c) => c + 1);
    window.dispatchEvent(new CustomEvent(EAGLE_TRIGGER_EVENT));
    setTimeout(() => {
      cooldownRef.current = false;
      setPressed(false);
    }, 2000);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* glow di sfondo */}
      <div className="absolute -inset-4 bg-accent/15 rounded-3xl blur-3xl pointer-events-none nf-fly-glow" />

      <div className="relative rounded-3xl border border-accent/30 bg-gradient-to-br from-bg-surface via-bg-base to-bg-surface overflow-hidden shadow-[0_0_60px_-12px_rgba(56,189,248,0.45)]">
        {/* texture grid sottile */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse at center, #000 30%, transparent 80%)",
          }}
        />

        {/* contenuto */}
        <div className="relative px-6 sm:px-10 py-10 sm:py-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
              Easter egg biancoceleste
            </span>
          </div>

          <h3
            className="text-3xl sm:text-4xl lg:text-5xl text-text-primary leading-none text-balance mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            FAI VOLARE <span className="text-gradient-accent">L'AQUILA</span>
          </h3>
          <p className="text-sm sm:text-base text-text-secondary max-w-md mb-2 leading-relaxed">
            Un piccolo regalo per chi è arrivato fin qui. Clicca e guarda
            l'aquila tornare a volare.
          </p>

          {showAppHint && (
            <p className="text-[11px] text-text-muted max-w-md mb-5 leading-relaxed italic">
              💡 Per vedere l'animazione più fluida e nitida, ti consigliamo di{" "}
              <span className="text-accent font-semibold not-italic">
                scaricare l'app
              </span>{" "}
              di Netflaxt sul tuo dispositivo.
            </p>
          )}
          {!showAppHint && <div className="mb-5" />}

          {/* BOTTONE */}
          <button
            type="button"
            onClick={handleClick}
            disabled={pressed}
            aria-label="Fai volare l'aquila"
            className={`group relative inline-flex items-center gap-3 px-7 py-4 rounded-full bg-accent text-text-inverse font-black uppercase tracking-[0.18em] text-sm overflow-hidden transition-all duration-300 ${
              pressed
                ? "scale-95 opacity-80"
                : "hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-4px_rgba(56,189,248,0.8)]"
            }`}
          >
            {/* sheen che scorre al hover */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700" />

            {/* icona aquila stilizzata */}
            <EagleGlyph className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110" />

            <span className="relative z-10">
              {pressed ? "In volo…" : "Fai volare l'aquila"}
            </span>

            <span
              className={`relative z-10 inline-block transition-transform duration-300 ${
                pressed ? "translate-x-2" : "group-hover:translate-x-1"
              }`}
            >
              →
            </span>
          </button>

          {/* contatore */}
          {count > 0 && (
            <div className="mt-5 text-xs text-text-muted">
              Voli completati:{" "}
              <span className="text-accent font-black tabular-nums">{count}</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes nf-fly-glow-kf {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.03); }
        }
        .nf-fly-glow { animation: nf-fly-glow-kf 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* Mini icona aquila stilizzata per il bottone */
function EagleGlyph({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 L13.5 5 L12 6.5 L10.5 5 Z" />
      <path d="M3 11 C 6 8 9 8 12 10 C 15 8 18 8 21 11 C 18 12 15 12 12 12 C 9 12 6 12 3 11 Z" />
      <path d="M12 10 L11 17 L10 19 L12 18 L14 19 L13 17 Z" />
    </svg>
  );
}

