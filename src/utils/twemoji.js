/* ─────────────────────────────────────────────────────────────
   src/utils/twemoji.js
   Converte le emoji native (testo) in immagini Twemoji, così
   appaiono identiche e a colori su ogni dispositivo (PC, Android,
   iPhone). Gli asset arrivano da una CDN (jsDelivr).
   ───────────────────────────────────────────────────────────── */
import twemoji from "twemoji";

const BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@14.0.2/assets/";

export function parseTwemoji(node) {
  if (!node) return;
  try {
    twemoji.parse(node, {
      base: BASE,
      folder: "svg",
      ext: ".svg",
      className: "twemoji",
    });
  } catch (e) {
    /* silenzioso: in caso di problemi restano le emoji native */
  }
}
