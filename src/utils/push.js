/* ─────────────────────────────────────────────────────────────
   src/utils/push.js
   Web Push (Firebase Cloud Messaging) — lato client.
   - getMessaging dinamico (cache-friendly)
   - request permission, generate FCM token, salvataggio in Firestore
     su users/{uid}.pushTokens (array di {token, deviceId, ua, createdAt})
   L'invio vero avviene nel Worker Cloudflare (scripts/live-poller):
   legge la coda pushQueue e spedisce via FCM.
     pushQueue/{id} = { title, body, url, audience, createdAt, status }
   ───────────────────────────────────────────────────────────── */
import app, { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { getDeviceId } from "./devices";

/* VAPID key — generata in Firebase Console → Cloud Messaging.
   Senza VAPID il getToken fallisce. Lasciamo placeholder finché
   il progetto non genera la propria coppia. */
export const VAPID_KEY = "BMpGj3hfVDaFMO0R1lMEfRMByER9zPNIbK2KLNj4q_Ve60EA7En9U3gUVrZCzJPJVyeH0Idrj1geb6EJKbirrjc"; 

export function isPushSupported() {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function currentPermission() {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission;
}

async function loadMessaging() {
  if (!isPushSupported()) throw new Error("Browser non supporta le push");
  const { getMessaging, isSupported } = await import("firebase/messaging");
  const ok = await isSupported().catch(() => false);
  if (!ok) throw new Error("Firebase Messaging non supportato");
  return getMessaging(app);
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  // /firebase-messaging-sw.js viene servito dal folder /public
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
  });
}

export async function enablePush(uid) {
  if (!isPushSupported()) throw new Error("Push non supportate");
  if (!uid) throw new Error("Devi essere loggato");
  if (!VAPID_KEY) {
    throw new Error(
      "VAPID_KEY mancante: configura la chiave Web Push in Firebase Console e incollala in src/utils/push.js"
    );
  }

  // 1) Permesso
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("Permesso notifiche negato");
  }

  // 2) Service worker
  const reg = await registerServiceWorker();

  // 3) Token FCM
  const { getToken } = await import("firebase/messaging");
  const messaging = await loadMessaging();
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg || undefined,
  });

  if (!token) throw new Error("Impossibile generare token push");

  await salvaToken(uid, token);
  return token;
}

/**
 * Salva il collegamento di QUESTO dispositivo, sostituendo il precedente.
 *
 * Non usiamo arrayUnion: l'oggetto salvato contiene la data, quindi ogni
 * salvataggio ne aggiungerebbe uno nuovo anche per lo stesso telefono, e
 * l'elenco si riempirebbe di voci morte (è già successo: da 2 dispositivi
 * reali erano diventate 6 registrazioni).
 */
async function salvaToken(uid, token) {
  const deviceId = getDeviceId();
  const snap = await getDoc(doc(db, "users", uid));
  const attuali = (snap.exists() && snap.data().pushTokens) || [];

  // Via il vecchio collegamento di questo dispositivo e gli eventuali
  // doppioni dello stesso token registrati altrove.
  const altri = attuali.filter(
    (t) => t && t.token && t.token !== token && t.deviceId !== deviceId
  );

  await setDoc(
    doc(db, "users", uid),
    {
      pushTokens: [
        ...altri,
        {
          token,
          deviceId,
          ua: navigator.userAgent,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    { merge: true }
  );
}

/**
 * Rinnovo silenzioso all'avvio dell'app.
 *
 * I collegamenti alle notifiche scadono (reinstallazione, aggiornamenti di
 * sistema, pulizia dati del browser). Senza questo controllo l'utente se ne
 * accorgerebbe solo smettendo di ricevere le notifiche. Qui il token viene
 * riletto a ogni avvio e, se è cambiato, aggiornato: nessun popup, nessuna
 * richiesta di permesso, tutto invisibile.
 *
 * Non fa nulla se l'utente non ha mai attivato le notifiche.
 */
export async function refreshPushToken(uid) {
  try {
    if (!uid || !isPushSupported()) return;
    if (currentPermission() !== "granted") return; // mai attivate o negate

    const reg = await registerServiceWorker();
    const { getToken } = await import("firebase/messaging");
    const messaging = await loadMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg || undefined,
    });
    if (!token) return;

    const snap = await getDoc(doc(db, "users", uid));
    const attuali = (snap.exists() && snap.data().pushTokens) || [];
    const deviceId = getDeviceId();
    const giaCorretto = attuali.some(
      (t) => t?.token === token && t?.deviceId === deviceId
    );
    if (giaCorretto) return; // tutto a posto, niente scritture inutili

    await salvaToken(uid, token);
  } catch {
    // Silenzioso di proposito: è un controllo di manutenzione, non deve
    // mai disturbare l'utente né bloccare l'avvio dell'app.
  }
}

export async function getUserPushTokens(uid) {
  if (!uid) return [];
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().pushTokens || [];
}

/* Foreground listener: notifica ricevuta mentre l'app è aperta.
   Restituisce unsubscribe. */
export async function onForegroundMessage(cb) {
  try {
    const messaging = await loadMessaging();
    const { onMessage } = await import("firebase/messaging");
    return onMessage(messaging, cb);
  } catch {
    return () => {};
  }
}

/* Admin: enqueue messaggio in pushQueue per essere inviato dal
   backend (Cloud Function / endpoint Vercel). */
export async function enqueuePushNotification({ title, body, url, audience }) {
  if (!title?.trim() || !body?.trim()) throw new Error("Titolo e testo richiesti");
  return await addDoc(collection(db, "pushQueue"), {
    title: title.trim(),
    body: body.trim(),
    url: url?.trim() || "/",
    audience: audience || "all", // 'all' | 'subscribed-only'
    status: "queued", // queued | sent | failed
    createdAt: serverTimestamp(),
  });
}
