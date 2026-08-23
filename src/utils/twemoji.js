/* ─────────────────────────────────────────────────────────────
   src/utils/twemoji.js
   Converte le emoji native (testo) in immagini Twemoji, così
   appaiono identiche e a colori su ogni dispositivo (PC, Android,
   iPhone). Gli asset arrivano da una CDN (jsDelivr).

   ⚠️ Perché esistono le zone escluse (`data-no-twemoji`)
   Questa conversione riscrive il DOM: l'emoji-testo diventa un <img>.
   Su contenuti che compaiono e spariscono di continuo (avvisi, toast)
   React poi non ritrova più il testo che aveva creato e la pagina va in
   errore con "Failed to execute 'removeChild'", mostrando la schermata
   di errore anche quando non c'è alcun problema reale.
   Succedeva pubblicando una notizia: l'avviso "📰 Nuova notizia"
   compariva, veniva convertito e alla sua scomparsa faceva crashare la
   pagina. Perciò gli elementi volatili si marcano con
   `data-no-twemoji` e qui vengono saltati: mostreranno le emoji di
   sistema, che per un avviso di pochi secondi va benissimo.
   ───────────────────────────────────────────────────────────── */
import twemoji from "twemoji";

const BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@14.0.2/assets/";
const OPZIONI = {
  base: BASE,
  folder: "svg",
  ext: ".svg",
  className: "twemoji",
};

const ESCLUSO = "[data-no-twemoji]";

export function parseTwemoji(node) {
  if (!node) return;
  try {
    // Caso normale e più veloce: nessuna zona da proteggere
    const zoneEscluse = node.querySelectorAll?.(ESCLUSO);
    if (!zoneEscluse || zoneEscluse.length === 0) {
      twemoji.parse(node, OPZIONI);
      return;
    }

    /* Ci sono zone da saltare: scendiamo ramo per ramo. Quando un ramo
       non contiene zone escluse lo convertiamo tutto insieme; quando le
       contiene proseguiamo più in basso. */
    const daVisitare = [...(node.children || [])];
    while (daVisitare.length) {
      const el = daVisitare.shift();
      if (el.matches?.(ESCLUSO)) continue; // zona protetta: non toccarla
      if (el.querySelector?.(ESCLUSO)) {
        daVisitare.push(...(el.children || [])); // scendi ancora
      } else {
        twemoji.parse(el, OPZIONI); // ramo pulito
      }
    }
  } catch {
    /* silenzioso: in caso di problemi restano le emoji native */
  }
}
