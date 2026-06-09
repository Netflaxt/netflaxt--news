/* ─────────────────────────────────────────────────────────────
   src/hooks/usePwaInstall.js
   Hook globale per gestire l'installazione PWA.

   Funzionamento per piattaforma:
   • Chrome / Edge / Samsung Internet (Android + Desktop):
     evento `beforeinstallprompt` → catturato e usato per install nativo
   • iOS Safari: nessuna API; restituiamo platform="ios" così il
     bottone può mostrare istruzioni "Tap Condividi → Aggiungi a Home"
   • Altri browser (Firefox, ecc.): platform="unsupported" → bottone
     mostra un fallback elegante
   • App già installata: platform="installed"

   Lo stato è condiviso da tutti i componenti che usano il hook
   tramite un singleton + custom events.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";

const STATE = {
  deferredPrompt: null,
  installed: false,
};
const EVENT_CHANGE = "netflaxt:pwa-install-changed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
}

function emitChange() {
  window.dispatchEvent(new CustomEvent(EVENT_CHANGE));
}

/* ─── Inizializzazione globale (una volta sola) ─────────── */
let _initialized = false;
function initOnce() {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  if (isStandalone()) STATE.installed = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    STATE.deferredPrompt = e;
    emitChange();
  });

  window.addEventListener("appinstalled", () => {
    STATE.deferredPrompt = null;
    STATE.installed = true;
    emitChange();
  });
}

/* ─── Hook esposto ──────────────────────────────────────── */
export default function usePwaInstall() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    initOnce();
    const handler = () => setVersion((v) => v + 1);
    window.addEventListener(EVENT_CHANGE, handler);
    return () => window.removeEventListener(EVENT_CHANGE, handler);
  }, []);

  let platform;
  if (STATE.installed || isStandalone()) platform = "installed";
  else if (STATE.deferredPrompt) platform = "native";
  else if (isIOS()) platform = "ios";
  else platform = "unsupported";

  /* Tenta l'installazione (mostra il prompt nativo se disponibile).
     Restituisce "accepted" | "dismissed" | "unavailable" | "ios". */
  const install = async () => {
    if (STATE.installed) return "installed";
    if (STATE.deferredPrompt) {
      try {
        STATE.deferredPrompt.prompt();
        const result = await STATE.deferredPrompt.userChoice;
        STATE.deferredPrompt = null;
        emitChange();
        return result?.outcome || "dismissed";
      } catch {
        return "unavailable";
      }
    }
    if (isIOS()) return "ios";
    return "unavailable";
  };

  return { platform, install };
}
