/* ─────────────────────────────────────────────────────────────
   src/utils/analytics.js
   Statistiche di visita con Google Analytics 4 (gratis).

   ► COME ATTIVARLO (una volta sola):
     1. Vai su https://analytics.google.com → Amministrazione →
        Crea proprietà → inserisci "Netflaxt News"
     2. Crea un flusso di dati di tipo "Web" col dominio del sito
     3. Copia il "ID misurazione": è nel formato G-XXXXXXXXXX
     4. Incollalo qui sotto al posto della stringa vuota. Fine.

   Finché GA4_ID è vuoto il sito NON carica nulla e non traccia niente:
   nessun errore, nessuna richiesta di rete inutile.

   PRIVACY: lo script parte SOLO se l'utente ha accettato i cookie dal
   banner. Senza consenso, Google Analytics non viene nemmeno caricato.
   ───────────────────────────────────────────────────────────── */

import { getCookieConsent } from "../components/CookieBanner";

/** ID misurazione GA4 della proprietà "Netflaxt News" */
export const GA4_ID = "G-V4BBWWK8FL";

let initialized = false;

/**
 * Carica Google Analytics, ma solo con il consenso dell'utente.
 * Chiamata da App.jsx al mount e a ogni cambio di consenso.
 */
export function initAnalytics() {
  if (initialized || !GA4_ID) return;
  if (typeof window === "undefined") return;
  if (getCookieConsent() !== "accepted") return;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  // send_page_view: false → le visite le mandiamo noi a ogni cambio pagina,
  // altrimenti in una SPA come questa GA conterebbe solo la prima schermata.
  gtag("config", GA4_ID, { send_page_view: false, anonymize_ip: true });

  initialized = true;
  // Registra la pagina da cui l'utente è entrato
  trackPageView(window.location.pathname + window.location.search);
}

/**
 * Registra la visita di una pagina. In questo sito il contenuto cambia
 * senza ricaricare il browser, quindi va segnalato a mano a ogni route.
 */
export function trackPageView(path) {
  if (!initialized || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/**
 * Traccia un'azione specifica.
 * Es. trackEvent("iscrizione_newsletter", { punto: "footer" })
 */
export function trackEvent(name, props = {}) {
  if (!initialized || typeof window.gtag !== "function") return;
  window.gtag("event", name, props);
}

/**
 * Richiamata quando l'utente cambia la scelta sui cookie dal banner.
 * Se accetta ora, attiva le statistiche senza bisogno di ricaricare.
 */
export function syncConsent() {
  if (getCookieConsent() === "accepted" && !initialized) {
    initAnalytics();
  }
  // Nota: se revoca il consenso dopo averlo dato, lo script resta in
  // memoria fino al refresh: al successivo caricamento non partirà più.
}
