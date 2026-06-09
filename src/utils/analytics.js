/* ─────────────────────────────────────────────────────────────
   src/utils/analytics.js
   Helper analytics — usa Plausible (privacy-friendly, GDPR-OK
   senza cookie banner obbligatorio, ma rispettiamo comunque
   il consenso dell'utente).

   COME ATTIVARE PLAUSIBLE:
   1. Crea account gratuito su https://plausible.io (o usa self-hosted)
   2. Aggiungi il dominio "netflaxtnews.it"
   3. Plausible ti dà uno snippet — basta che lasci ATTIVO questo file
      e tutto è gestito automaticamente al primo consent.
   4. Sostituisci PLAUSIBLE_DOMAIN qui sotto col tuo dominio

   ALTERNATIVA — Google Analytics 4:
   Decommenta la sezione GA4 e inserisci il tuo Measurement ID.
   ───────────────────────────────────────────────────────────── */

import { getCookieConsent } from "../components/CookieBanner";

const PLAUSIBLE_DOMAIN = "netflaxtnews.it"; // ⚠️ Cambia col tuo dominio
const PLAUSIBLE_SCRIPT_URL = "https://plausible.io/js/script.js";

// const GA4_ID = "G-XXXXXXXXXX"; // Decommenta per usare Google Analytics

let initialized = false;

/**
 * Inizializza il sistema di analytics SE l'utente ha dato consenso.
 * Da chiamare in App.jsx (o ovunque al mount).
 */
export function initAnalytics() {
  if (initialized) return;
  const consent = getCookieConsent();
  if (consent !== "accepted") return;

  // ─── PLAUSIBLE ───
  if (!document.querySelector(`script[data-domain="${PLAUSIBLE_DOMAIN}"]`)) {
    const s = document.createElement("script");
    s.defer = true;
    s.setAttribute("data-domain", PLAUSIBLE_DOMAIN);
    s.src = PLAUSIBLE_SCRIPT_URL;
    document.head.appendChild(s);
    // Funzione globale per eventi custom
    window.plausible =
      window.plausible ||
      function () {
        (window.plausible.q = window.plausible.q || []).push(arguments);
      };
  }

  // ─── GOOGLE ANALYTICS 4 (decommenta se preferisci GA4) ───
  // const s = document.createElement("script");
  // s.async = true;
  // s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  // document.head.appendChild(s);
  // window.dataLayer = window.dataLayer || [];
  // function gtag() { window.dataLayer.push(arguments); }
  // window.gtag = gtag;
  // gtag("js", new Date());
  // gtag("config", GA4_ID, { anonymize_ip: true });

  initialized = true;
}

/**
 * Traccia un evento custom.
 * Plausible: plausible(eventName, { props: {...} })
 * Es. trackEvent("Click Newsletter", { variant: "footer" })
 */
export function trackEvent(name, props = {}) {
  if (!initialized) return;
  if (typeof window.plausible === "function") {
    window.plausible(name, { props });
  }
  if (typeof window.gtag === "function") {
    window.gtag("event", name, props);
  }
}

/**
 * Da chiamare quando l'utente cambia la sua scelta cookie.
 * Re-inizializza se necessario o nasconde lo script.
 */
export function syncConsent() {
  const consent = getCookieConsent();
  if (consent === "accepted" && !initialized) {
    initAnalytics();
  }
  // Nota: se l'utente revoca il consenso DOPO averlo dato, lo script
  // resta caricato fino al refresh della pagina. Plausible è cookie-less
  // e anonimizzato quindi il rischio privacy è minimo.
}
