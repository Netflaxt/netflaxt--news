/* ─────────────────────────────────────────────────────────────
   src/utils/predictions.js
   Pronostici 1X2 + risultato esatto (#25).
   Sorgente dati: Firestore collection `predictions`
     doc id deterministico: `${matchId}_${uid}` (un pronostico per
     utente per partita, aggiornabile fino al kickoff).
   Campi:
     - matchId, uid, displayName, photoURL
     - outcome: "1"|"X"|"2"
     - homeScore, awayScore (interi)
     - points: number|null  (assegnati alla finalizzazione)
     - createdAt, updatedAt
   Punteggio:
     - risultato esatto → 3 punti
     - solo esito (1X2) corretto → 1 punto
     - altrimenti → 0
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export const POINTS = { exact: 3, outcome: 1 };

// I pronostici di una partita si APRONO questo numero di giorni prima del
// calcio d'inizio (anche se la partita è già in calendario da mesi).
export const PREDICTIONS_OPEN_DAYS_BEFORE = 2;
const OPEN_WINDOW_MS = PREDICTIONS_OPEN_DAYS_BEFORE * 24 * 60 * 60 * 1000;

/** Istante (ms) in cui si aprono i pronostici per una partita, o null. */
export function predictionsOpenAtMs(match) {
  const k = match?.kickoff?.toDate?.()?.getTime?.()
    ?? (match?.kickoff ? new Date(match.kickoff).getTime() : null);
  return k != null ? k - OPEN_WINDOW_MS : null;
}

export function outcomeOf(homeScore, awayScore) {
  const h = Number(homeScore);
  const a = Number(awayScore);
  if (Number.isNaN(h) || Number.isNaN(a)) return null;
  if (h > a) return "1";
  if (h < a) return "2";
  return "X";
}

function predId(matchId, uid) {
  return `${matchId}_${uid}`;
}

/**
 * Cancella TUTTI i pronostici (uso admin: reset di test / nuova stagione).
 * Azzera anche il flag `scored` sui match così possono essere ri-valutati.
 */
export async function clearAllPredictions() {
  const snap = await getDocs(collection(db, "predictions"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

/**
 * Reset COMPLETO della classifica generale (admin):
 * - cancella tutti i pronostici (predictions/*)
 * - azzera quizPoints e seenQuizIds su ogni utente in users/*
 * Ritorna { predictionsDeleted, usersReset }
 */
export async function clearLeaderboard() {
  // 1) Predictions: tutti cancellati
  const predSnap = await getDocs(collection(db, "predictions"));
  await Promise.all(predSnap.docs.map((d) => deleteDoc(d.ref)));

  // 2) Users: azzera punti quiz + seen, ma solo per quelli che ne hanno
  const usersSnap = await getDocs(collection(db, "users"));
  let usersReset = 0;
  await Promise.all(
    usersSnap.docs.map(async (d) => {
      const data = d.data() || {};
      const hasQuiz = (data.quizPoints || 0) > 0 ||
        (Array.isArray(data.seenQuizIds) && data.seenQuizIds.length > 0);
      if (!hasQuiz) return;
      try {
        await updateDoc(d.ref, {
          quizPoints: 0,
          seenQuizIds: [],
        });
        usersReset += 1;
      } catch (e) {
        console.warn("Reset quiz utente fallito per", d.id, e);
      }
    })
  );

  return { predictionsDeleted: predSnap.size, usersReset };
}

/** Tutti i pronostici di un utente (per la cronologia personale). */
export async function getUserPredictions(uid) {
  if (!uid) return [];
  const q = query(collection(db, "predictions"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Pronostico dell'utente per una partita (o null). */
export async function getUserPrediction(matchId, uid) {
  if (!matchId || !uid) return null;
  const snap = await getDoc(doc(db, "predictions", predId(matchId, uid)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Salva/aggiorna il pronostico (consentito solo prima del kickoff). */
export async function setPrediction({ match, user, outcome, homeScore, awayScore }) {
  if (!match?.id || !user?.uid) throw new Error("Dati mancanti");
  const kickoff = match.kickoff?.toDate?.() || (match.kickoff ? new Date(match.kickoff) : null);
  if (kickoff && kickoff.getTime() <= Date.now()) {
    throw new Error("Pronostici chiusi: la partita è già iniziata.");
  }
  if (match.status && match.status !== "scheduled") {
    throw new Error("Pronostici chiusi per questa partita.");
  }
  const opensAt = predictionsOpenAtMs(match);
  if (opensAt != null && Date.now() < opensAt) {
    throw new Error(
      `I pronostici aprono ${PREDICTIONS_OPEN_DAYS_BEFORE} giorni prima della partita.`
    );
  }
  const h = parseInt(homeScore, 10);
  const a = parseInt(awayScore, 10);
  if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
    throw new Error("Inserisci un risultato valido.");
  }
  if (!["1", "X", "2"].includes(outcome)) {
    throw new Error("Seleziona l'esito (1, X o 2).");
  }

  await setDoc(
    doc(db, "predictions", predId(match.id, user.uid)),
    {
      matchId: match.id,
      uid: user.uid,
      displayName:
        user.displayName || (user.email ? user.email.split("@")[0] : "Anonimo"),
      photoURL: user.photoURL || null,
      outcome,
      homeScore: h,
      awayScore: a,
      // ✨ salvataggio kickoff per computare lo streak senza extra query
      matchKickoff: match.kickoff || null,
      points: null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Streak di pronostici azzeccati (esito 1X2 o esatto) di un utente.
 * Restituisce { current, best, totalScored, hitRate }.
 * Considera azzeccato un pronostico con points > 0.
 */
export async function computePredictionStreak(uid) {
  if (!uid) return { current: 0, best: 0, totalScored: 0, hitRate: 0 };
  const q = query(collection(db, "predictions"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const list = snap.docs
    .map((d) => d.data())
    .filter((p) => p.points != null);

  const millis = (v) =>
    v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0);

  list.sort((a, b) => millis(a.matchKickoff) - millis(b.matchKickoff));

  let best = 0;
  let current = 0;
  let hits = 0;
  for (const p of list) {
    if ((p.points || 0) > 0) {
      current += 1;
      best = Math.max(best, current);
      hits += 1;
    } else {
      current = 0;
    }
  }

  return {
    current,
    best,
    totalScored: list.length,
    hitRate: list.length ? Math.round((hits / list.length) * 100) : 0,
  };
}

/** Sottoscrive i pronostici di una partita (per mostrare le percentuali). */
export function subscribeMatchPredictions(matchId, cb) {
  if (!matchId) return () => {};
  const q = query(collection(db, "predictions"), where("matchId", "==", matchId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => console.error("Errore lettura pronostici:", e)
  );
}

/**
 * Calcola e assegna i punti per tutti i pronostici di una partita
 * finita. Da chiamare quando l'admin finalizza il risultato.
 */
export async function scoreMatch(match) {
  if (!match?.id) throw new Error("Match mancante");
  const finalOutcome = outcomeOf(match.homeScore, match.awayScore);
  if (!finalOutcome) throw new Error("Risultato finale non valido");

  const q = query(collection(db, "predictions"), where("matchId", "==", match.id));
  const snap = await getDocs(q);

  let scored = 0;
  await Promise.all(
    snap.docs.map((d) => {
      const p = d.data();
      let points = 0;
      const exact =
        Number(p.homeScore) === Number(match.homeScore) &&
        Number(p.awayScore) === Number(match.awayScore);
      if (exact) points = POINTS.exact;
      else if (p.outcome === finalOutcome) points = POINTS.outcome;
      scored += 1;
      return updateDoc(d.ref, { points });
    })
  );
  return { scored };
}

/**
 * Classifica tifosi: aggrega i punti di tutti i pronostici già valutati.
 * Per la scala di un fan site l'aggregazione lato client è adeguata.
 */
export async function getLeaderboard() {
  const snap = await getDocs(collection(db, "predictions"));
  const byUser = new Map();
  snap.docs.forEach((d) => {
    const p = d.data();
    if (p.points == null) return; // non ancora valutato
    const entry =
      byUser.get(p.uid) || {
        uid: p.uid,
        displayName: p.displayName || "Tifoso",
        photoURL: p.photoURL || null,
        points: 0,
        played: 0,
        exact: 0,
        correct: 0,
      };
    entry.points += p.points || 0;
    entry.played += 1;
    if (p.points === POINTS.exact) entry.exact += 1;
    else if (p.points === POINTS.outcome) entry.correct += 1;
    // tieni il displayName/photo più recente disponibile
    if (p.displayName) entry.displayName = p.displayName;
    if (p.photoURL) entry.photoURL = p.photoURL;
    byUser.set(p.uid, entry);
  });
  return Array.from(byUser.values()).sort(
    (a, b) => b.points - a.points || b.exact - a.exact || b.played - a.played
  );
}
