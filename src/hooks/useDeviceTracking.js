/* ─────────────────────────────────────────────────────────────
   src/hooks/useDeviceTracking.js
   Per ogni utente loggato:
   1. Registra il device corrente in users/{uid}/devices/{deviceId}
   2. Manda un heartbeat ogni 60 secondi così "ultimo accesso" è
      sempre fresco e l'utente vede chi è realmente attivo
   3. Watcha il proprio doc device: se sparisce (rimosso da altro
      device) → signOut automatico
   ───────────────────────────────────────────────────────────── */
import { useEffect } from "react";
import { auth } from "../firebase/firebase";
import { signOut } from "firebase/auth";
import {
  registerDevice,
  touchDevice,
  watchMyDevice,
} from "../utils/devices";

const HEARTBEAT_MS = 60 * 1000; // 60 secondi

export default function useDeviceTracking(user) {
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    let unsubWatch = () => {};
    let interval = null;

    (async () => {
      try {
        const esito = await registerDevice(user.uid);
        if (cancelled) return;

        // Questo dispositivo è stato disconnesso da un altro: si esce
        // subito, senza aspettare il controllo in tempo reale (che
        // scatterebbe comunque, ma solo un istante dopo).
        if (esito?.revocato) {
          await signOut(auth).catch(() => {});
          return;
        }

        // Heartbeat lastSeen
        interval = setInterval(() => {
          touchDevice(user.uid).catch(() => {});
        }, HEARTBEAT_MS);

        // Anche al focus/visibility ridiamo un colpo
        const onFocus = () => touchDevice(user.uid).catch(() => {});
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);

        // Watcher: se il doc viene cancellato → signOut
        unsubWatch = watchMyDevice(user.uid, async () => {
          try {
            await signOut(auth);
          } catch (e) {
            console.warn("signOut auto fallito:", e);
          }
        });

        // Cleanup completo
        return () => {
          window.removeEventListener("focus", onFocus);
          document.removeEventListener("visibilitychange", onFocus);
        };
      } catch (e) {
        console.warn("useDeviceTracking error:", e);
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      unsubWatch();
    };
  }, [user?.uid]);
}
