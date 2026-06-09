/* ─────────────────────────────────────────────────────────────
   src/utils/chatMaintenance.js
   Svuotamento AUTOMATICO settimanale della chat.

   Firebase Spark non ha Cloud Functions/cron, quindi usiamo un
   "client-cron": quando l'ADMIN apre la chat, controlla se è passata
   1 settimana dall'ultimo svuotamento e, in caso, cancella tutti i
   messaggi (libera memoria/cache su RTDB).

   Perché solo l'admin?
   - Le regole RTDB consentono di cancellare i messaggi SOLO all'admin
     (per evitare che un utente qualsiasi svuoti la chat per dispetto).
   - L'admin apre il sito regolarmente → la pulizia avviene ~ogni
     settimana senza intervento manuale.

   IMPORTANTE: lo svuotamento automatico NON azzera i contatori
   chatCount → i badge "Voce della curva"/"Capo curva" restano
   sbloccati. È pulizia tecnica, non una punizione. I badge si
   ri-bloccano SOLO con un reset manuale dell'admin.

   Stato in RTDB: meta/chatAutoClear/lastClearedAt (ms epoch).
   ───────────────────────────────────────────────────────────── */
import { rtdb } from "../firebase/firebase";
import { ref, get, set, remove } from "firebase/database";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Controlla e, se serve, svuota la chat. Eseguito SOLO dall'admin.
 * @param {boolean} isAdmin — deve essere true (solo l'admin può pulire)
 * @returns {Promise<boolean>} true se ha effettivamente svuotato.
 */
export async function maybeWeeklyClear(isAdmin) {
  if (!isAdmin) return false;

  const tsRef = ref(rtdb, "meta/chatAutoClear/lastClearedAt");
  const now = Date.now();

  // 1) Leggi il timestamp dell'ultimo svuotamento
  let current = null;
  try {
    const snap = await get(tsRef);
    current = snap.exists() ? snap.val() : null;
  } catch (e) {
    console.warn("maybeWeeklyClear read error:", e);
    return false;
  }

  // 2) Primo avvio: inizializza senza svuotare (chat appena nata)
  if (current == null) {
    try {
      await set(tsRef, now);
    } catch {}
    return false;
  }

  // 3) Non è ancora passata 1 settimana → niente da fare
  if (now - current < WEEK_MS) return false;

  // 4) È ora: svuota i messaggi e aggiorna il timestamp
  try {
    await remove(ref(rtdb, "messages"));
    await set(tsRef, now);
    return true;
  } catch (e) {
    console.warn("maybeWeeklyClear clear failed:", e);
    return false;
  }
}
