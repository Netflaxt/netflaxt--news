/* ─────────────────────────────────────────────────────────────
   src/utils/reports.js
   Segnalazioni di contenuti (commenti articoli, messaggi chat).
   Storage:
     - reports/{reportId}  {
         contentType: 'comment' | 'chat',
         contentId:    string,
         contentText:  string (snapshot),
         contentAuthor:{uid, name},
         targetRef:    { collection, ...path } (per agire),
         reason:       string (spam, offensivo, off-topic, altro),
         note:         string,
         reporter:     {uid, name, email},
         status:       'pending' | 'resolved' | 'dismissed',
         createdAt, resolvedAt, adminAction
       }
   ───────────────────────────────────────────────────────────── */
import { db, rtdb } from "../firebase/firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { ref as rtdbRef, remove as rtdbRemove } from "firebase/database";

export const REPORT_REASONS = [
  { id: "spam",      label: "Spam / pubblicità" },
  { id: "offensive", label: "Offensivo / insulti" },
  { id: "offtopic",  label: "Off-topic" },
  { id: "harass",    label: "Molestie / minacce" },
  { id: "other",     label: "Altro" },
];

export async function submitReport({
  contentType, contentId, contentText, contentAuthor,
  targetRef, reason, note, reporter,
}) {
  if (!contentType || !contentId || !reason) throw new Error("Dati mancanti");
  if (!reporter?.uid) throw new Error("Devi essere loggato per segnalare");

  await addDoc(collection(db, "reports"), {
    contentType,
    contentId,
    contentText: (contentText || "").slice(0, 600),
    contentAuthor: contentAuthor || null,
    targetRef: targetRef || null,
    reason,
    note: (note || "").slice(0, 1000),
    reporter: {
      uid: reporter.uid,
      name: reporter.displayName || reporter.name || "",
      email: reporter.email || "",
    },
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export function subscribeReports(cb, { status = "pending" } = {}) {
  // limit alto, ordinamento lato client per evitare indici compositi
  const q = status
    ? query(collection(db, "reports"), where("status", "==", status), limit(200))
    : query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    cb(list);
  });
}

export async function countPendingReports() {
  try {
    const q = query(collection(db, "reports"), where("status", "==", "pending"));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function resolveReport(reportId, action, adminNote = "") {
  await updateDoc(doc(db, "reports", reportId), {
    status: action === "dismissed" ? "dismissed" : "resolved",
    adminAction: action, // dismissed | content-deleted | warned-user
    adminNote,
    resolvedAt: serverTimestamp(),
  });
}

/* Elimina il contenuto segnalato (commento Firestore o messaggio chat RTDB) */
export async function deleteReportedContent(report) {
  const t = report.targetRef;
  if (!t) throw new Error("targetRef mancante");

  // Caso 1: chat (Realtime Database)
  if (t.rtdbPath) {
    await rtdbRemove(rtdbRef(rtdb, t.rtdbPath));
    return;
  }

  // Caso 2: commento (Firestore)
  if (!t.path) throw new Error("targetRef.path mancante");
  if (!Array.isArray(t.path) || t.path.length < 2 || t.path.length % 2 !== 0)
    throw new Error("targetRef.path non valido");
  const ref = doc(db, ...t.path);
  await deleteDoc(ref);
}

export const REPORT_REASON_LABEL = (id) =>
  REPORT_REASONS.find((r) => r.id === id)?.label || id;
