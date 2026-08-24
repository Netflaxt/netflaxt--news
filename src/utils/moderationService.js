/* ═══════════════════════════════════════════════════════════════
   MODERATION SERVICE — netflaxt-news
   ───────────────────────────────────────────────────────────────
   Tutto Firestore. Niente backend.

   ⚠️ QUESTI DATI NON VANNO NEL PROFILO (`users/{uid}`).
   Il profilo è leggibile pubblicamente: serve a mostrare nome e foto
   accanto a messaggi e commenti. Tenere lì il motivo di una sanzione
   significava renderlo consultabile da chiunque — sono informazioni
   sul comportamento di una persona, non un dato da vetrina.
   Da qui la collection separata, leggibile solo dall'interessato e
   dall'amministratore (spostati il 24/08/2026).

   ⚠️ LIMITE NOTO, da tenere presente: la sanzione la scrive il browser
   di chi ha commesso la violazione, perché senza un server non c'è
   nessun altro che possa farlo. Chi ha competenze tecniche può quindi
   annullarsi la sospensione da solo. Spostare i dati non cambia questo:
   è una conseguenza del non avere un server, e per risolverlo servirebbe
   il piano a pagamento di Firebase.

   Collezioni usate:
   ───────────────────
   • moderazione/{uid}
       Stato di moderazione dell'utente:
         - banCount: number              (0|1|2|3 — 4 = disabilitato)
         - suspendedUntil: Timestamp|null
         - suspensionReason: string
         - suspensionViolationType: "blasphemy"|"insult"
         - suspensionStartAt: Timestamp|null
         - flaggedMessages: Array<{text, timestamp}>
         - lastViolationAt: Timestamp
         - accountDisabled: boolean
         - accountDisabledAt: Timestamp|null
         - lastResetCheckedAt: Timestamp

   • appeals/{appealId}
       - uid, userEmail, userDisplayName
       - banCount (al momento del ricorso)
       - suspensionStartAt, suspensionEndAt
       - violationType, violationMatch
       - flaggedMessages: Array<{text, timestamp}>
       - userMessage: string (motivo del ricorso)
       - status: "pending" | "confirmed" | "accepted"
       - createdAt: Timestamp
       - resolvedAt: Timestamp|null
       - adminNote: string

   Durate sospensione progressive:
   ───────────────────────────────
     1ª violazione → AVVISO (nessuna sospensione, solo richiamo)
     2ª violazione → 24 ore (1 giorno)
     3ª violazione → 7 giorni
     4ª violazione → account disabilitato (permanente)

   Reset contatore:
     Dopo 90 giorni senza violazioni, banCount viene resettato a 0
     al prossimo check (chiamato automaticamente da getModerationStatus).
   ═══════════════════════════════════════════════════════════════ */

import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

/* Durate sospensione (giorni) per ban-count.
   1ª violazione = 0 (solo avviso, niente ban effettivo). */
export const SUSPENSION_DURATIONS_DAYS = {
  1: 0, // prima volta: solo avviso, account libero
  2: 1, // seconda: 24 ore
  3: 7, // terza: 7 giorni
};

export const MAX_BAN_COUNT_BEFORE_DISABLE = 3;
export const RESET_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ───────────────────────────────────────────────────────────────
   getModerationStatus(uid)
   Ritorna lo stato moderazione corrente. Esegue auto-reset
   del banCount se sono passati > 90 giorni dall'ultima violazione.
   ─────────────────────────────────────────────────────────────── */
export async function getModerationStatus(uid) {
  if (!uid) return defaultStatus();
  const modRef = doc(db, "moderazione", uid);
  const snap = await getDoc(modRef);
  const data = snap.exists() ? snap.data() : {};

  let banCount = data.banCount || 0;
  const suspendedUntil = data.suspendedUntil?.toDate?.() || null;
  const accountDisabled = !!data.accountDisabled;
  const lastViolationAt = data.lastViolationAt?.toDate?.() || null;

  // Auto-reset banCount dopo RESET_AFTER_DAYS giorni senza violazioni
  // (solo se non c'è una sospensione attiva)
  const now = Date.now();
  const isSuspendedNow = suspendedUntil && suspendedUntil.getTime() > now;

  if (
    banCount > 0 &&
    !isSuspendedNow &&
    !accountDisabled &&
    lastViolationAt &&
    now - lastViolationAt.getTime() > RESET_AFTER_DAYS * DAY_MS
  ) {
    try {
      await updateDoc(modRef, {
        banCount: 0,
        lastResetCheckedAt: serverTimestamp(),
      });
      banCount = 0;
    } catch (e) {
      console.warn("Errore reset banCount:", e);
    }
  }

  return {
    banCount,
    isSuspended: isSuspendedNow,
    suspendedUntil,
    suspensionStartAt: data.suspensionStartAt?.toDate?.() || null,
    suspensionReason: data.suspensionReason || "",
    suspensionViolationType: data.suspensionViolationType || null,
    flaggedMessages: data.flaggedMessages || [],
    accountDisabled,
    accountDisabledAt: data.accountDisabledAt?.toDate?.() || null,
  };
}

function defaultStatus() {
  return {
    banCount: 0,
    isSuspended: false,
    suspendedUntil: null,
    suspensionStartAt: null,
    suspensionReason: "",
    suspensionViolationType: null,
    flaggedMessages: [],
    accountDisabled: false,
    accountDisabledAt: null,
  };
}

/* ───────────────────────────────────────────────────────────────
   applyViolation(uid, violation, messages)
   Applica sospensione progressiva.
   - violation: { type, match, text }
   - messages: array dei messaggi recenti dell'utente in chat
     (verranno allegati per il ricorso)
   Ritorna: { banCount, suspendedUntil, accountDisabled }
   ─────────────────────────────────────────────────────────────── */
export async function applyViolation(uid, violation, recentMessages = []) {
  if (!uid) throw new Error("uid mancante");

  const modRef = doc(db, "moderazione", uid);
  const snap = await getDoc(modRef);
  const currentCount = snap.exists() ? snap.data().banCount || 0 : 0;
  const nextCount = currentCount + 1;

  // 4ª violazione → account disabilitato (irrevocabile lato app)
  if (nextCount > MAX_BAN_COUNT_BEFORE_DISABLE) {
    await setDoc(
      modRef,
      {
        banCount: nextCount,
        accountDisabled: true,
        accountDisabledAt: serverTimestamp(),
        lastViolationAt: serverTimestamp(),
        suspensionReason: `Disattivazione definitiva — 4ª violazione (${violation.match})`,
        suspensionViolationType: violation.type,
        flaggedMessages: [
          ...(recentMessages.slice(-5).map((m) => ({
            text: m.text || "",
            timestamp: m.timestamp || Date.now(),
          })) || []),
          { text: violation.text || "", timestamp: Date.now() },
        ],
      },
      { merge: true }
    );
    return {
      banCount: nextCount,
      suspendedUntil: null,
      accountDisabled: true,
    };
  }

  const days = SUSPENSION_DURATIONS_DAYS[nextCount] ?? 1;

  const flagged = [
    ...recentMessages.slice(-5).map((m) => ({
      text: m.text || "",
      timestamp: m.timestamp || Date.now(),
    })),
    { text: violation.text || "", timestamp: Date.now() },
  ];

  // Caso 1ª violazione: SOLO AVVISO. Niente suspendedUntil → l'utente
  // può continuare a scrivere, ma il banCount sale a 1 e alla prossima
  // violazione scatta la sospensione vera.
  if (days <= 0) {
    await setDoc(
      modRef,
      {
        banCount: nextCount,
        suspendedUntil: null,
        suspensionStartAt: null,
        suspensionReason: `Avviso — "${violation.match}" (prima violazione)`,
        suspensionViolationType: violation.type,
        lastViolationAt: serverTimestamp(),
        flaggedMessages: flagged,
      },
      { merge: true }
    );
    return {
      banCount: nextCount,
      suspendedUntil: null,
      accountDisabled: false,
      suspensionDays: 0,
      warningOnly: true,
    };
  }

  // 2ª/3ª violazione: sospensione effettiva
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + days * DAY_MS);

  await setDoc(
    modRef,
    {
      banCount: nextCount,
      suspendedUntil: Timestamp.fromDate(endAt),
      suspensionStartAt: Timestamp.fromDate(startAt),
      suspensionReason: `${violationLabel(violation.type)} — "${violation.match}"`,
      suspensionViolationType: violation.type,
      lastViolationAt: serverTimestamp(),
      flaggedMessages: flagged,
    },
    { merge: true }
  );

  return {
    banCount: nextCount,
    suspendedUntil: endAt,
    accountDisabled: false,
    suspensionDays: days,
  };
}

function violationLabel(type) {
  if (type === "blasphemy") return "Bestemmia";
  if (type === "insult") return "Insulto / slur";
  return "Violazione";
}

/* ───────────────────────────────────────────────────────────────
   submitAppeal(user, status, appealText)
   Salva un ricorso. Lo status DEVE essere "pending".
   Ritorna l'id del ricorso creato.
   ─────────────────────────────────────────────────────────────── */
export async function submitAppeal(user, modStatus, appealText) {
  if (!user?.uid) throw new Error("user mancante");

  // Verifica che non ci sia già un ricorso pending per la stessa sospensione
  const existing = await getActiveAppeal(user.uid);
  if (existing) {
    throw new Error("Hai già un ricorso in valutazione per questa sospensione.");
  }

  const appealRef = await addDoc(collection(db, "appeals"), {
    uid: user.uid,
    userEmail: user.email || null,
    userDisplayName: user.displayName || (user.email || "").split("@")[0],
    userPhotoURL: user.photoURL || null,
    banCount: modStatus.banCount,
    suspensionStartAt: modStatus.suspensionStartAt
      ? Timestamp.fromDate(modStatus.suspensionStartAt)
      : null,
    suspensionEndAt: modStatus.suspendedUntil
      ? Timestamp.fromDate(modStatus.suspendedUntil)
      : null,
    violationType: modStatus.suspensionViolationType,
    violationReason: modStatus.suspensionReason,
    flaggedMessages: modStatus.flaggedMessages || [],
    userMessage: (appealText || "").slice(0, 2000),
    status: "pending",
    createdAt: serverTimestamp(),
    resolvedAt: null,
    adminNote: "",
  });

  return appealRef.id;
}

/* ───────────────────────────────────────────────────────────────
   getActiveAppeal(uid)
   Ritorna il ricorso pending o resolved dell'ultima sospensione
   (utile per mostrare lo stato nel profilo).
   ─────────────────────────────────────────────────────────────── */
export async function getActiveAppeal(uid) {
  if (!uid) return null;
  try {
    const q = query(
      collection(db, "appeals"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch (e) {
    console.error("Errore lettura appeals:", e);
    return null;
  }
}

/* ───────────────────────────────────────────────────────────────
   listPendingAppeals()
   Per la Admin: lista tutti i ricorsi pending.
   ─────────────────────────────────────────────────────────────── */
export async function listAppeals() {
  try {
    const q = query(collection(db, "appeals"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Errore lista appeals:", e);
    return [];
  }
}

/* ───────────────────────────────────────────────────────────────
   resolveAppeal(appealId, decision, adminNote)
   decision: "confirmed" → sospensione mantenuta
             "accepted"  → sospensione annullata
   Se accepted, azzera suspendedUntil sull'utente e decrementa
   banCount di 1 (così la violazione non conta).
   ─────────────────────────────────────────────────────────────── */
export async function resolveAppeal(appealId, decision, adminNote = "") {
  if (!appealId) throw new Error("appealId mancante");
  if (decision !== "confirmed" && decision !== "accepted") {
    throw new Error("decision deve essere 'confirmed' o 'accepted'");
  }

  const appealRef = doc(db, "appeals", appealId);
  const appealSnap = await getDoc(appealRef);
  if (!appealSnap.exists()) throw new Error("Ricorso non trovato");
  const appeal = appealSnap.data();

  // Aggiorna lo stato del ricorso
  await updateDoc(appealRef, {
    status: decision,
    resolvedAt: serverTimestamp(),
    adminNote: (adminNote || "").slice(0, 1000),
  });

  if (decision === "accepted") {
    // Annulla sospensione + decrementa banCount + riabilita account se 4ª
    const modRef = doc(db, "moderazione", appeal.uid);
    const modSnap = await getDoc(modRef);
    const currentCount = modSnap.exists() ? modSnap.data().banCount || 0 : 0;
    await setDoc(modRef, {
      banCount: Math.max(0, currentCount - 1),
      suspendedUntil: null,
      suspensionStartAt: null,
      suspensionReason: "",
      suspensionViolationType: null,
      flaggedMessages: [],
      accountDisabled: false,
      accountDisabledAt: null,
    }, { merge: true });
  }

  return true;
}

/* ───────────────────────────────────────────────────────────────
   formatRemainingTime(date)
   Per UI countdown: "2g 03h 14m 21s" o "03h 14m 21s" ecc.
   ─────────────────────────────────────────────────────────────── */
export function formatRemainingTime(endDate) {
  if (!endDate) return "—";
  const ms = endDate.getTime() - Date.now();
  if (ms <= 0) return "Scaduta";
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  if (days > 0) return `${days}g ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(minutes)}m ${pad(seconds)}s`;
}

/* ───────────────────────────────────────────────────────────────
   formatDuration(banCount) — utility UI
   ─────────────────────────────────────────────────────────────── */
export function suspensionDurationLabel(banCount) {
  const days = SUSPENSION_DURATIONS_DAYS[banCount];
  if (days == null) return "—";
  if (days <= 0) return "solo avviso";
  if (days === 1) return "24 ore";
  if (days === 7) return "7 giorni";
  return days === 1 ? "1 giorno" : `${days} giorni`;
}
