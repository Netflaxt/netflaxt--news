/* ─────────────────────────────────────────────────────────────
   src/utils/siteStatus.js
   Stato del sito, controllato dall'admin. Sorgente: Firestore
   doc `config/site` → { status, message, updatedAt }.
   status: "operational" | "maintenance" | "down"
   Se il documento non esiste o non è leggibile → "operational"
   (il sito appare normale, nessun popup).
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

export const STATUS_META = {
  operational: {
    key: "operational",
    label: "Tutti i sistemi operativi",
    color: "#10B981",
    title: "Tutto operativo",
  },
  maintenance: {
    key: "maintenance",
    label: "Sito in aggiornamento",
    color: "#F59E0B",
    title: "Sito in aggiornamento",
    defaultMessage:
      "Stiamo facendo dei lavori per migliorare Netflaxt News. Alcune funzioni potrebbero non essere disponibili per qualche minuto. Torna a trovarci a breve! 🦅",
  },
  down: {
    key: "down",
    label: "Sito non disponibile",
    color: "#F43F5E",
    title: "Il sito è temporaneamente giù",
    defaultMessage:
      "Stiamo riscontrando dei problemi tecnici e ci stiamo lavorando. Riprova tra poco — grazie per la pazienza! 🦅",
  },
};

export function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.operational;
}

/** Sottoscrive lo stato del sito in tempo reale. */
export function subscribeSiteStatus(cb) {
  return onSnapshot(
    doc(db, "config", "site"),
    (snap) => {
      const d = snap.exists() ? snap.data() : {};
      const status = ["operational", "maintenance", "down"].includes(d.status)
        ? d.status
        : "operational";
      cb({ status, message: d.message || "" });
    },
    () => cb({ status: "operational", message: "" })
  );
}

/** Imposta lo stato del sito (solo admin). */
export async function setSiteStatus(status, message = "") {
  await setDoc(
    doc(db, "config", "site"),
    { status, message: (message || "").slice(0, 300), updatedAt: serverTimestamp() },
    { merge: true }
  );
}
