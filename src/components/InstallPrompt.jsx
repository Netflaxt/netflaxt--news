/* ─────────────────────────────────────────────────────────────
   src/components/InstallPrompt.jsx
   Mostra un piccolo banner "Installa app" quando il browser
   supporta l'installazione PWA (Chrome/Edge desktop + Android Chrome).
   Su iOS Safari mostra istruzioni manuali.

   USO: mount in App.jsx — è position:fixed quindi non interferisce.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";

const LS_KEY = "netflaxt:install-prompt-dismissed";
// Per quanto tempo nascondere dopo dismiss (giorni)
const SNOOZE_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    if (Date.now() - ts < SNOOZE_DAYS * 24 * 60 * 60 * 1000) return ts;
    return null;
  } catch {
    return null;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(LS_KEY, String(Date.now()));
  } catch {}
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Se già installata o già dismissata di recente, non mostrare
    if (isStandalone() || readDismissed()) return;

    // iOS Safari non supporta beforeinstallprompt
    if (isIOS()) {
      // Mostra solo dopo 30s di permanenza
      const t = setTimeout(() => {
        setShowIosTip(true);
        setVisible(true);
      }, 30 * 1000);
      return () => clearTimeout(t);
    }

    // Android / Chrome Desktop
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Mostra dopo 8s (per non infastidire subito)
      setTimeout(() => setVisible(true), 8000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Quando l'app viene installata
    const installedHandler = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setVisible(false);
    } else {
      handleDismiss();
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    writeDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 z-[70] install-prompt-in">
      <div className="relative p-4 rounded-2xl bg-bg-surface border border-accent/30 shadow-2xl backdrop-blur-xl">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition flex items-center justify-center"
          aria-label="Chiudi"
        >
          ✕
        </button>

        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center font-black text-text-inverse shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)]">
            <img
              src="/logo.png"
              alt=""
              className="w-9 h-9 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-accent font-bold mb-0.5">
              Installa l'app
            </div>
            <div className="text-sm font-bold text-text-primary">
              Netflaxt sulla home schermata
            </div>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              {showIosTip
                ? "Tocca Condividi → Aggiungi alla schermata Home"
                : "Apri come app, senza barra del browser. Notifiche e avvio rapido."}
            </p>

            {!showIosTip && deferredPrompt && (
              <button
                onClick={handleInstall}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-text-inverse text-xs font-bold rounded-md uppercase tracking-wider hover:shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)] transition"
              >
                Installa
                <span>→</span>
              </button>
            )}

            {showIosTip && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-bg-elevated border border-border">
                <svg
                  className="w-5 h-5 text-accent shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 8l3-3m0 0l3 3m-3-3v12M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                  />
                </svg>
                <span className="text-xs text-text-secondary">
                  Tap su <span className="text-text-primary font-semibold">Condividi</span> in basso al browser
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes install-prompt-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .install-prompt-in {
          animation: install-prompt-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
