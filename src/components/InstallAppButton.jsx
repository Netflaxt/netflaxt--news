/* ─────────────────────────────────────────────────────────────
   src/components/InstallAppButton.jsx
   Bottone "Scarica app" che fa partire l'installazione PWA.
   Adatta automaticamente il comportamento alla piattaforma:
   • Chrome/Edge → prompt nativo
   • iOS Safari  → overlay con istruzioni Condividi → Aggiungi a Home
   • Browser non supportati → tooltip con suggerimento browser
   ───────────────────────────────────────────────────────────── */
import React, { useState } from "react";
import usePwaInstall from "../hooks/usePwaInstall";

export default function InstallAppButton({
  size = "md",
  fullWidth = false,
  className = "",
}) {
  const { platform, install } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const handleClick = async () => {
    if (busy) return;
    if (platform === "installed") {
      setToast("L'app è già installata");
      setTimeout(() => setToast(""), 2200);
      return;
    }
    if (platform === "ios") {
      setIosOpen(true);
      return;
    }
    if (platform === "native") {
      setBusy(true);
      const result = await install();
      setBusy(false);
      if (result === "accepted") {
        setToast("App installata ✓");
        setTimeout(() => setToast(""), 2500);
      } else if (result === "dismissed") {
        setToast("Installazione annullata");
        setTimeout(() => setToast(""), 2000);
      }
      return;
    }
    // Browser non supportato (Firefox desktop, ecc.)
    setToast(
      "Browser non compatibile. Prova con Chrome, Edge o Safari su iPhone."
    );
    setTimeout(() => setToast(""), 3800);
  };

  const padding =
    size === "lg" ? "px-6 py-3.5 text-sm" :
    size === "sm" ? "px-3 py-1.5 text-xs" :
    "px-5 py-2.5 text-sm";

  const label =
    platform === "installed" ? "App installata ✓" : "Scarica app";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label="Scarica l'app"
        className={`${
          fullWidth ? "w-full" : "inline-flex"
        } items-center justify-center gap-2 rounded-md bg-accent text-text-inverse font-bold uppercase tracking-wider ${padding} transition-all duration-300 hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait ${className}`}
      >
        {busy ? (
          <span className="w-4 h-4 border-2 border-text-inverse border-t-transparent rounded-full animate-spin" />
        ) : (
          <DownloadIcon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        )}
        {label}
      </button>

      {/* Toast feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-bg-surface border border-accent/40 text-sm text-text-primary font-semibold shadow-2xl backdrop-blur-xl nf-toast-pop">
          {toast}
          <style>{`
            @keyframes nf-toast-pop-kf {
              from { opacity: 0; transform: translate(-50%, 10px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
            .nf-toast-pop { animation: nf-toast-pop-kf 0.3s cubic-bezier(0.16,1,0.3,1); }
          `}</style>
        </div>
      )}

      {/* iOS modal: istruzioni Condividi → Aggiungi a Home */}
      {iosOpen && <IosInstallSheet onClose={() => setIosOpen(false)} />}
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */
function DownloadIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Sheet iOS — guida visiva all'installazione manuale (unica via
   possibile su iOS Safari, che NON espone API di install).
   ───────────────────────────────────────────────────────────── */
function IosInstallSheet({ onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-bg-base/85 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl bg-bg-surface border border-border shadow-2xl overflow-hidden nf-ios-sheet">
        <div className="h-1 bg-gradient-to-r from-accent via-accent-hover to-accent" />
        <div className="p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)]">
              <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
                Installa su iPhone / iPad
              </div>
              <h3
                className="mt-1 text-2xl text-text-primary leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                2 SEMPLICI PASSI
              </h3>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition flex items-center justify-center"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>

          <ol className="space-y-3">
            <li className="flex items-start gap-3 p-3 rounded-xl bg-bg-elevated border border-border">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent text-text-inverse flex items-center justify-center text-xs font-black">
                1
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-text-primary">
                  Tocca <ShareIcon /> Condividi
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Trovi il pulsante in basso al centro su iPhone, in alto a
                  destra su iPad.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 p-3 rounded-xl bg-bg-elevated border border-border">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent text-text-inverse flex items-center justify-center text-xs font-black">
                2
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-text-primary">
                  Scorri e tocca "Aggiungi alla schermata Home"
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Confermi con "Aggiungi" in alto a destra. Fatto: l'aquila
                  vola sul tuo schermo.
                </p>
              </div>
            </li>
          </ol>

          <button
            onClick={onClose}
            className="mt-5 w-full px-4 py-3 rounded-md bg-accent text-text-inverse text-sm font-bold uppercase tracking-wider hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition"
          >
            Ho capito 🦅
          </button>
        </div>
      </div>

      <style>{`
        @keyframes nf-ios-sheet-up {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nf-ios-sheet { animation: nf-ios-sheet-up 0.35s cubic-bezier(0.16,1,0.3,1); }
      `}</style>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      className="inline w-3.5 h-3.5 align-text-bottom"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
