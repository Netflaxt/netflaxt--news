/* ─────────────────────────────────────────────────────────────
   src/utils/devices.js
   Gestione dispositivi connessi all'account.
   Sorgente dati: Firestore subcollection
     users/{uid}/devices/{deviceId}
   Campi:
     - userAgent: string
     - os:        string (iOS / Android / Windows / macOS / Linux)
     - browser:   string (Safari / Chrome / Edge / Firefox)
     - kind:      "mobile" | "tablet" | "desktop" | "pwa"
     - label:     string ("iPhone 15", "Chrome su Windows", ecc.)
     - firstSeen: Timestamp
     - lastSeen:  Timestamp (aggiornato ad ogni heartbeat)
     - isCurrent: bool (calcolato lato client confrontando il deviceId)

   Strategia "device removal":
   Quando l'utente clicca "Rimuovi" da un altro dispositivo, eliminiamo
   il doc Firestore di quel device. Sul device target, watchMyDevice()
   è sottoscritto in real-time al proprio doc → quando sparisce esegue
   signOut. Risultato: l'utente viene buttato fuori da quel device
   senza dover essere fisicamente lì.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

const DEVICE_ID_KEY = "netflaxt:deviceId";

/* ─── Device ID stabile ─────────────────────────────────────── */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage non disponibile (es. modalità incognito strict)
    return generateId();
  }
}

function generateId() {
  // nanoid-style 16 chars (no deps)
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const arr = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 16; i++) s += chars[arr[i] % chars.length];
  return s;
}

/* ─── Parsing user agent ────────────────────────────────────── */
function detectOSAndBrowser(ua) {
  ua = ua || "";
  let os = "Sconosciuto";
  let browser = "Browser";
  let kind = "desktop";

  if (/iPhone|iPod/i.test(ua)) {
    os = "iOS";
    kind = "mobile";
  } else if (/iPad/i.test(ua)) {
    os = "iPadOS";
    kind = "tablet";
  } else if (/Android/i.test(ua)) {
    os = "Android";
    kind = /Mobile/i.test(ua) ? "mobile" : "tablet";
  } else if (/Windows NT 10\.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  // PWA standalone detection
  const isStandalone =
    (typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && navigator.standalone === true);
  if (isStandalone) kind = "pwa";

  return { os, browser, kind };
}

function buildLabel({ os, browser, kind }) {
  if (kind === "pwa") return `App installata · ${os}`;
  if (kind === "mobile") return `${os} · ${browser}`;
  if (kind === "tablet") return `Tablet ${os} · ${browser}`;
  return `${browser} su ${os}`;
}

/* ─── Registra/aggiorna il device corrente al login ─────────── */
export async function registerDevice(uid) {
  if (!uid) return null;
  const deviceId = getDeviceId();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const detected = detectOSAndBrowser(ua);
  const label = buildLabel(detected);

  const ref = doc(db, "users", uid, "devices", deviceId);
  const snap = await getDoc(ref);

  const payload = {
    deviceId,
    userAgent: ua.slice(0, 300),
    os: detected.os,
    browser: detected.browser,
    kind: detected.kind,
    label,
    lastSeen: serverTimestamp(),
  };
  if (!snap.exists()) {
    payload.firstSeen = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
  return deviceId;
}

/* ─── Heartbeat periodico (chiamato dall'app) ───────────────── */
export async function touchDevice(uid) {
  if (!uid) return;
  try {
    await setDoc(
      doc(db, "users", uid, "devices", getDeviceId()),
      { lastSeen: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    /* silent */
  }
}

/* ─── Sottoscrive la lista device in real-time ──────────────── */
export function subscribeDevices(uid, cb, onErr) {
  if (!uid) return () => {};
  const colRef = collection(db, "users", uid, "devices");
  return onSnapshot(
    colRef,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordina per ultimo accesso (più recente prima)
      list.sort((a, b) => {
        const ta = a.lastSeen?.toMillis?.() || 0;
        const tb = b.lastSeen?.toMillis?.() || 0;
        return tb - ta;
      });
      cb(list);
    },
    (err) => {
      console.error("Errore lista dispositivi:", err);
      onErr && onErr(err);
    }
  );
}

/* ─── Rimuovi un device (forza logout su quel device) ───────── */
export async function removeDevice(uid, deviceId) {
  if (!uid || !deviceId) return;
  await deleteDoc(doc(db, "users", uid, "devices", deviceId));
}

/* ─── Watch sul MIO device — se sparisce → signOut ──────────── */
export function watchMyDevice(uid, onRevoked) {
  if (!uid) return () => {};
  const deviceId = getDeviceId();
  const ref = doc(db, "users", uid, "devices", deviceId);
  // Stato locale: il watch parte SOLO dopo che il primo snapshot
  // ha confermato l'esistenza del doc (così evitiamo signOut
  // prematuro durante la race condition login → register)
  let initialized = false;
  return onSnapshot(
    ref,
    (snap) => {
      if (!initialized) {
        if (snap.exists()) initialized = true;
        return;
      }
      // initialized = true e doc è sparito → admin/utente ha revocato
      if (!snap.exists()) {
        onRevoked && onRevoked();
      }
    },
    (err) => console.error("Errore watch device:", err)
  );
}
