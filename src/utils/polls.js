/* ─────────────────────────────────────────────────────────────
   src/utils/polls.js
   Sondaggi gestiti dall'admin, visibili sulla home.
   Storage:
     - polls/{pollId}                      { question, options[], status, createdAt, closesAt, totalVotes, optionCounts }
     - polls/{pollId}/votes/{uid}          { optionId, votedAt }
   Status: 'active' | 'closed'
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";

const COL = "polls";

/* ─── Admin: crea/aggiorna/chiudi/elimina ───────────────── */
export async function createPoll({ question, options, closesAt }) {
  if (!question?.trim()) throw new Error("Domanda mancante");
  const cleanedOpts = (options || [])
    .map((o, i) => ({
      id: o.id || `opt_${i + 1}`,
      text: (o.text || "").trim(),
    }))
    .filter((o) => o.text);
  if (cleanedOpts.length < 2) throw new Error("Almeno 2 opzioni");
  if (cleanedOpts.length > 6) throw new Error("Massimo 6 opzioni");

  const optionCounts = {};
  cleanedOpts.forEach((o) => (optionCounts[o.id] = 0));

  return await addDoc(collection(db, COL), {
    question: question.trim(),
    options: cleanedOpts,
    status: "active",
    createdAt: serverTimestamp(),
    closesAt: closesAt ? Timestamp.fromDate(new Date(closesAt)) : null,
    totalVotes: 0,
    optionCounts,
  });
}

export async function closePoll(pollId) {
  await updateDoc(doc(db, COL, pollId), { status: "closed" });
}

export async function reopenPoll(pollId) {
  await updateDoc(doc(db, COL, pollId), { status: "active" });
}

export async function deletePoll(pollId) {
  await deleteDoc(doc(db, COL, pollId));
}

/* ─── User: vota / cambia voto ─────────────────────────── */
export async function voteOnPoll(pollId, uid, optionId) {
  if (!pollId || !uid || !optionId) throw new Error("Parametri mancanti");
  const pollRef = doc(db, COL, pollId);
  const voteRef = doc(db, COL, pollId, "votes", uid);

  const [pollSnap, voteSnap] = await Promise.all([
    getDoc(pollRef),
    getDoc(voteRef),
  ]);
  if (!pollSnap.exists()) throw new Error("Sondaggio non esiste");
  const poll = pollSnap.data();
  if (poll.status === "closed") throw new Error("Sondaggio chiuso");

  const prev = voteSnap.exists() ? voteSnap.data().optionId : null;
  if (prev === optionId) return prev; // già votato uguale → no-op

  await setDoc(voteRef, {
    optionId,
    votedAt: serverTimestamp(),
  });

  const updates = {
    [`optionCounts.${optionId}`]: increment(1),
  };
  if (prev) {
    updates[`optionCounts.${prev}`] = increment(-1);
  } else {
    updates.totalVotes = increment(1);
  }
  await updateDoc(pollRef, updates);
  return optionId;
}

export async function getUserVote(pollId, uid) {
  if (!pollId || !uid) return null;
  const snap = await getDoc(doc(db, COL, pollId, "votes", uid));
  return snap.exists() ? snap.data().optionId : null;
}

/* ─── Subscriptions ─────────────────────────────────────── */
export function subscribeActivePoll(cb) {
  // 1 sondaggio attivo più recente (no orderBy per evitare indice composito)
  const q = query(collection(db, COL), where("status", "==", "active"), limit(8));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    cb(list[0] || null);
  });
}

export function subscribeAllPolls(cb) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
