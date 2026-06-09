/* ─────────────────────────────────────────────────────────────
   src/hooks/useTwemoji.js
   Converte le emoji in immagini Twemoji su tutta la pagina e
   ri-converte automaticamente quando arriva nuovo contenuto
   (es. nuovi messaggi in chat, cambio pagina).
   ───────────────────────────────────────────────────────────── */
import { useEffect } from "react";
import { parseTwemoji } from "../utils/twemoji";

export default function useTwemoji() {
  useEffect(() => {
    const root = document.body;
    if (!root) return;

    let scheduled = false;
    let observer;

    const run = () => {
      scheduled = false;
      if (observer) observer.disconnect();
      parseTwemoji(root);
      if (observer) observer.observe(root, { childList: true, subtree: true });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(run);
    };

    observer = new MutationObserver(schedule);

    // Conversione iniziale + osservazione dei nuovi nodi
    parseTwemoji(root);
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
}
