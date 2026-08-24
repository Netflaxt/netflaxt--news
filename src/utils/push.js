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
/* Il sito è aperto come app installata (schermata Home) o dal browser? */
function appInstallata() {
  try {
    return (
      (typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (typeof navigator !== "undefined" && navigator.standalone === true)
    );
  } catch {
    return false;
  }
}

async function salvaToken(uid, token) {
  const deviceId = getDeviceId();
  const snap = await getDoc(doc(db, "tokenDispositivi", uid));
  const attuali = (snap.exists() && snap.data().pushTokens) || [];

  // Via il vecchio collegamento di questo dispositivo e gli eventuali
  // doppioni dello stesso token registrati altrove.
  const altri = attuali.filter(
    (t) => t && t.token && t.token !== token && t.deviceId !== deviceId
  );

  await setDoc(
    doc(db, "tokenDispositivi", uid),
    {
      ultimoAccesso: serverTimestamp(),
      pushTokens: [
        ...altri,
        {
          token,
          deviceId,
          ua: navigator.userAgent,
          createdAt: new Date().toISOString(),
          /* Su iPhone le notifiche arrivano SOLO dall'app aggiunta alla
             schermata Home, mai da Safari. Senza questo dato, guardando
             la diagnostica non si può sapere se un iPhone registrato le
             riceverà davvero: si vedrebbe un dispositivo collegato che
             però non riceve nulla, senza capire perché. */
          pwa: appInstallata(),
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
const VERSIONE_PUSH_KEY = "netflaxt:pushBuildId";

export async function refreshPushToken(uid) {
  try {
    if (!uid || !isPushSupported()) return;
    if (currentPermission() !== "granted") return; // mai attivate o negate

    const reg = await registerServiceWorker();
    const { getToken, deleteToken } = await import("firebase/messaging");
    const messaging = await loadMessaging();

    /* Dopo un aggiornamento del sito il collegamento va RIGENERATO.
       Il motivo è insidioso: il codice identificativo resta identico lato
       dispositivo (quindi sembra tutto a posto), ma il canale a cui punta
       è stato invalidato e le notifiche non arrivano più. Finché non lo si
       ricrea a mano, il telefono resta muto — è esattamente quello che è
       successo il 23/08/2026 dopo aver aggiornato l'app.
       Perciò: se la versione del sito è cambiata, buttiamo via il vecchio
       collegamento e ne creiamo uno nuovo. */
    const versione = String(typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "");
    let versionePrecedente = null;
    try {
      versionePrecedente = localStorage.getItem(VERSIONE_PUSH_KEY);
    } catch {
      /* localStorage non disponibile: procediamo senza forzare */
    }
    const appAggiornata = !!versionePrecedente && versionePrecedente !== versione;

    if (appAggiornata) {
      await deleteToken(messaging).catch(() => {});
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg || undefined,
    });
    if (!token) return;

    try {
      localStorage.setItem(VERSIONE_PUSH_KEY, versione);
    } catch {
      /* niente da fare, riproverà al prossimo avvio */
    }

    const snap = await getDoc(doc(db, "tokenDispositivi", uid));
    const attuali = (snap.exists() && snap.data().pushTokens) || [];
    const deviceId = getDeviceId();
    const giaCorretto =
      !appAggiornata &&
      attuali.some((t) => t?.token === token && t?.deviceId === deviceId);
    if (giaCorretto) {
      /* Il collegamento è a posto, ma segniamo comunque il passaggio:
         è la data che distingue chi usa ancora l'app da chi l'ha
         abbandonata, e serve alle notifiche rivolte ai soli attivi.
         Prima quella data stava nel profilo pubblico. */
      await setDoc(
        doc(db, "tokenDispositivi", uid),
        { ultimoAccesso: serverTimestamp() },
        { merge: true }
      );
      return;
    }

    await salvaToken(uid, token);
  } catch {
    // Silenzioso di proposito: è un controllo di manutenzione, non deve
    // mai disturbare l'utente né bloccare l'avvio dell'app.
  }
}

export async function getUserPushTokens(uid) {
  if (!uid) return [];
  const snap = await getDoc(doc(db, "tokenDispositivi", uid));
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
