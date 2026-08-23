/* ─────────────────────────────────────────────────────────────
   src/components/PwaUpdateNotifier.jsx
   Rilevamento aggiornamenti AFFIDABILE via /version.json.

   Come funziona (metodo a prova di bomba, non dipende da eventi SW):
   1. Ogni build genera un BUILD_ID univoco, scritto in /version.json
      e compilato dentro questo codice come __BUILD_ID__.
   2. Il client fa polling di /version.json (sempre dalla rete, no cache)
      ogni 12 secondi + al focus/visibilità/cambio pagina.
   3. Se la versione sul server ≠ versione del codice in esecuzione →
      c'è un aggiornamento → mostra la UI:
         - Browser  → popup discreto in basso con bottone "Aggiorna"
         - PWA app  → modal a tutto schermo con barra di progresso
   4. Al click → attiva il nuovo Service Worker (SKIP_WAITING) e ricarica.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

const POLL_INTERVAL = 12 * 1000; // 12 secondi
const PROGRESS_DURATION_MS = 1400;

// Versione con cui è stato compilato QUESTO codice (iniettata da Vite)
const MY_VERSION =
  typeof __BUILD_ID__ !== "undefined" ? String(__BUILD_ID__) : "";

function isStandalonePWA() {
  if (typeof window === "undefined") return false;
  try {
    const mq =
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = window.navigator.standalone === true;
    return !!mq || !!iosStandalone;
  } catch {
    return false;
  }
}

/** Legge la versione attuale dal server, sempre fresca (no cache). */
async function fetchServerVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.version ? String(data.version) : null;
  } catch {
    return null;
  }
}

/** Aspetta che il nuovo SW sia "waiting" (installato e pronto). */
function waitForWaitingSW(reg, timeout = 6000) {
  return new Promise((resolve) => {
    if (reg.waiting) return resolve(reg.waiting);
    let resolved = false;
    const finish = (val) => {
      if (resolved) return;
      resolved = true;
      clearInterval(poll);
      resolve(val);
    };
    const watchInstalling = () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed") finish(reg.waiting);
      });
    };
    watchInstalling();
    reg.addEventListener("updatefound", watchInstalling);
    // Poll di sicurezza: appena compare un waiting, risolvi
    const poll = setInterval(() => {
      if (reg.waiting) finish(reg.waiting);
    }, 300);
    setTimeout(() => finish(reg.waiting || null), timeout);
  });
}

/** Attiva il nuovo SW e ricarica in modo robusto.
   Aspetta che il nuovo SW sia PRONTO prima di ricaricare, così il
   reload carica davvero la versione nuova al PRIMO colpo. */
async function applyUpdateAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Forza il download del nuovo SW
        reg.update().catch(() => {});
        // Aspetta che il nuovo SW sia installato e in attesa
        const waiting = await waitForWaitingSW(reg, 6000);
        if (waiting) {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            window.location.reload();
          };
          navigator.serviceWorker.addEventListener("controllerchange", finish, {
            once: true,
          });
          waiting.postMessage({ type: "SKIP_WAITING" });
          // Fallback: se controllerchange non scatta entro 3s, ricarica
          setTimeout(finish, 3000);
          return;
        }
      }
    }
  } catch {
    /* ignora → reload diretto sotto */
  }
  window.location.reload();
}

export default function PwaUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const location = useLocation();
  const dismissedRef = useRef(false); // l'utente ha chiuso il popup browser

  // Registra il Service Worker (per offline + handler SKIP_WAITING).
  // Il rilevamento update però lo facciamo via version.json (più affidabile).
  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      /* ambiente senza SW */
    }
  }, []);

  // Cleanup vecchie cache runtime non più usate
  useEffect(() => {
    if (typeof caches === "undefined") return;
    const STALE = ["cloudinary-images", "eagle-assets"];
    caches
      .keys()
      .then((keys) =>
        keys.forEach((k) => STALE.includes(k) && caches.delete(k).catch(() => {}))
      )
      .catch(() => {});
  }, []);

  // ✨ POLLING version.json → rilevamento affidabile nuova versione
  useEffect(() => {
    if (!MY_VERSION) return; // dev senza build id
    let stopped = false;

    const check = async () => {
      if (stopped || updateAvailable) return;
      const serverVersion = await fetchServerVersion();
      if (stopped) return;
      if (serverVersion && serverVersion !== MY_VERSION) {
        setUpdateAvailable(true);
      }
    };

    check(); // subito al mount
    const poll = setInterval(check, POLL_INTERVAL);
    const onFocus = () => check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onFocus);

    return () => {
      stopped = true;
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAvailable]);

  // Check anche al cambio pagina
  useEffect(() => {
    if (!MY_VERSION || updateAvailable) return;
    fetchServerVersion().then((v) => {
      if (v && v !== MY_VERSION) setUpdateAvailable(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Click "Aggiorna" del MODAL PWA → barra di progresso poi reload
  const handleApplyModal = () => {
    if (applying) return;
    setApplying(true);
    setProgress(0);
    const startedAt = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const p = Math.min(100, (elapsed / PROGRESS_DURATION_MS) * 100);
      setProgress(p);
      if (p < 100) requestAnimationFrame(tick);
      else applyUpdateAndReload();
    };
    requestAnimationFrame(tick);
  };

  // Click "Aggiorna" del POPUP browser → reload diretto
  const handleApplyBrowser = () => {
    if (applying) return;
    setApplying(true);
    applyUpdateAndReload();
  };

  if (!updateAvailable) return null;

  // ─── BROWSER: popup discreto in basso ───
  if (!isStandalonePWA()) {
    if (dismissedRef.current) return null;
    return (
      <div data-no-twemoji className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99] px-2 w-[94vw] max-w-md nf-pwa-toast-in">
        <div className="relative rounded-xl bg-bg-surface border border-accent/50 shadow-[0_16px_44px_-12px_rgba(0,0,0,0.6),0_0_34px_-10px_rgba(56,189,248,0.55)] overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-accent via-accent-hover to-accent" />
          <div className="p-3.5 flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center">
              <RefreshIcon className={`w-5 h-5 text-accent ${applying ? "nf-spin" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-black">
                Nuova versione disponibile
              </div>
              <div className="text-xs text-text-secondary leading-tight">
                {applying ? "Aggiornamento in corso…" : "Aggiorna per avere le ultime novità."}
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyBrowser}
              disabled={applying}
              className="shrink-0 px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-black uppercase tracking-wider hover:shadow-[0_0_18px_-4px_rgba(56,189,248,0.7)] transition disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {applying && (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              Aggiorna
            </button>
            {!applying && (
              <button
                type="button"
                onClick={() => {
                  dismissedRef.current = true;
                  setUpdateAvailable(false);
                }}
                className="shrink-0 w-6 h-6 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition"
                aria-label="Chiudi"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <style>{`
          @keyframes nf-pwa-toast-in-kf {
            from { opacity: 0; transform: translate(-50%, 24px); }
            to   { opacity: 1; transform: translate(-50%, 0); }
          }
          .nf-pwa-toast-in { animation: nf-pwa-toast-in-kf 0.4s cubic-bezier(0.16,1,0.3,1) both; }
          @keyframes nf-spin-kf { from { transform: rotate(0) } to { transform: rotate(360deg) } }
          .nf-spin { animation: nf-spin-kf 0.9s linear infinite; }
        `}</style>
      </div>
    );
  }

  // ─── PWA installata: modal a tutto schermo con barra ───
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-base/85 backdrop-blur-md nf-pwa-modal-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-bg-surface border border-accent/40 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7),0_0_80px_-20px_rgba(56,189,248,0.55)] overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent via-accent-hover to-accent" />
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-accent-deep/10 blur-3xl pointer-events-none" />

        <div className="relative p-7 sm:p-9 text-center">
          <div className="relative mx-auto w-20 h-20 mb-5">
            <div className="absolute inset-0 bg-accent/25 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 rounded-2xl border-2 border-accent/50 bg-accent/10 flex items-center justify-center">
              <RefreshIcon className={`w-10 h-10 text-accent ${applying ? "nf-spin" : ""}`} />
            </div>
          </div>

          <div className="text-[11px] uppercase tracking-[0.32em] text-accent font-black mb-2">
            Nuova versione disponibile
          </div>
          <h2
            id="pwa-update-title"
            className="text-3xl sm:text-4xl text-text-primary leading-none mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            AGGIORNA L'APP
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-xs mx-auto">
            {applying
              ? "Sto applicando l'aggiornamento. Non chiudere l'app."
              : "Abbiamo pubblicato delle novità. Aggiorna per averle subito."}
          </p>

          {applying ? (
            <div className="space-y-3">
              <div className="h-2.5 w-full rounded-full bg-bg-elevated border border-border overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent via-accent-hover to-accent transition-[width] duration-150 ease-out shadow-[0_0_16px_rgba(56,189,248,0.6)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs font-bold text-accent tabular-nums">
                {Math.round(progress)}%
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleApplyModal}
              className="group relative w-full py-3.5 px-6 rounded-md font-black uppercase tracking-[0.18em] text-text-inverse bg-accent overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_-4px_rgba(56,189,248,0.8)] hover:-translate-y-0.5"
            >
              <span className="relative z-10 inline-flex items-center justify-center gap-2 text-sm">
                Aggiorna ora
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes nf-pwa-modal-in-kf {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .nf-pwa-modal-in { animation: nf-pwa-modal-in-kf 0.3s ease-out both; }
        @keyframes nf-spin-kf { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        .nf-spin { animation: nf-spin-kf 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function RefreshIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3.16-6.85L21 8M21 3v5h-5" />
    </svg>
  );
}
