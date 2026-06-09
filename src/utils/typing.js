/* ─────────────────────────────────────────────────────────────
   src/utils/typing.js
   Helpers per scrivere/leggere lo stato "sta scrivendo"
   nel Realtime Database. Path: typing/{uid}
   ───────────────────────────────────────────────────────────── */
import { rtdb } from "../firebase/firebase";
import { ref, set, remove, onDisconnect, serverTimestamp } from "firebase/database";

const TYPING_THROTTLE_MS = 2500; // riscrivi al più ogni 2.5s

let lastWriteTs = 0;
let clearTimer = null;

/**
 * Segna l'utente corrente come "sta scrivendo".
 * Auto-rimosso dopo `idleMs` ms di inattività.
 */
export function setTyping(user, idleMs = 4000) {
  if (!user?.uid) return;

  const now = Date.now();

  // Throttle: non scrivere troppo spesso
  if (now - lastWriteTs > TYPING_THROTTLE_MS) {
    lastWriteTs = now;
    const myRef = ref(rtdb, `typing/${user.uid}`);
    set(myRef, {
      displayName:
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "Anonimo"),
      ts: serverTimestamp(),
    }).catch(() => {});
    // Auto-cleanup se l'utente perde la connessione
    onDisconnect(myRef).remove().catch(() => {});
  }

  // Reset timer "idle"
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    clearTyping(user);
  }, idleMs);
}

/**
 * Rimuove subito lo stato "sta scrivendo" (es. dopo invio).
 */
export function clearTyping(user) {
  if (!user?.uid) return;
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  lastWriteTs = 0;
  remove(ref(rtdb, `typing/${user.uid}`)).catch(() => {});
}
