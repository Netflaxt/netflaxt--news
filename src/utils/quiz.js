/* ─────────────────────────────────────────────────────────────
   src/utils/quiz.js
   Quiz giornaliero S.S. Lazio:
   - 5 domande/giorno scelte fra le NON ancora viste (rotazione fair)
   - 1 punto per OGNI risposta corretta (max 5 punti/giorno)
   - Quando l'utente ha visto tutte le 140 → reset automatico del
     pool e ricomincia il ciclo
   Storage:
     users/{uid}/quizDays/{YYYY-MM-DD} = {
       answers: [{ questionId, userAnswer, correct }],
       score: number (0-5),
       awardedPoints: number (= score),
       completedAt: Timestamp,
     }
     users/{uid}.quizPoints = sommatoria di tutti gli awardedPoints
     users/{uid}.seenQuizIds = array di id domande già viste
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { QUIZ_QUESTIONS } from "./quizQuestions";

export const QUIZ_DAILY_COUNT = 5;
// Punto per ogni risposta corretta (max 5 al giorno).
export const QUIZ_POINTS_PER_CORRECT = 1;
// Retro-compat: alcuni componenti importano ancora QUIZ_PERFECT_POINTS.
// Manteniamo l'export come "punteggio massimo del quiz" (5/5).
export const QUIZ_PERFECT_POINTS = QUIZ_DAILY_COUNT * QUIZ_POINTS_PER_CORRECT;

/* Data corrente in formato YYYY-MM-DD (timezone Europe/Rome) */
export function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* Hash semplice ma deterministico (mulberry32) */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Restituisce le 5 domande di oggi per questo utente, pescate dal
 * pool delle NON ancora viste. Quando le rimanenti sono meno di 5
 * fa il reset del campo seenQuizIds (ciclo completo) e ricomincia.
 *
 * È async perché legge/scrive Firestore (campo users/{uid}.seenQuizIds).
 * Lo shuffle è deterministico per (uid + dateKey) così se chiami due
 * volte nello stesso giorno ottieni le stesse 5 domande (idempotente
 * finché l'utente non submitta).
 */
export async function getDailyQuestions(uid, dateKey = todayKey()) {
  if (!uid) return [];

  // Legge gli id già visti dall'utente
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  let seenIds = Array.isArray(userSnap.data()?.seenQuizIds)
    ? userSnap.data().seenQuizIds
    : [];

  const seenSet = new Set(seenIds);
  let pool = QUIZ_QUESTIONS.filter((q) => !seenSet.has(q.id));

  // Se rimangono meno di 5 domande non viste → reset del pool
  if (pool.length < QUIZ_DAILY_COUNT) {
    pool = [...QUIZ_QUESTIONS];
    try {
      await setDoc(userRef, { seenQuizIds: [] }, { merge: true });
    } catch (e) {
      console.warn("Reset seenQuizIds fallito:", e);
    }
  }

  // Shuffle deterministico (Fisher-Yates con seed uid+data)
  const seed = hashSeed(`${uid}::${dateKey}`);
  const rng = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, QUIZ_DAILY_COUNT);
}

/* Risultato di oggi (null se non ancora giocato) */
export async function getTodayResult(uid) {
  if (!uid) return null;
  const snap = await getDoc(
    doc(db, "users", uid, "quizDays", todayKey())
  );
  return snap.exists() ? snap.data() : null;
}

/* Salva risultato del quiz di oggi.
   answers = [{ questionId, userAnswer }] (indice opzione scelta)
   Calcola score, assegna 1 punto per ogni risposta corretta e
   aggiunge gli id delle domande viste alla rotazione. */
export async function submitTodayQuiz(uid, answers) {
  if (!uid) throw new Error("Devi essere loggato");
  const dateKey = todayKey();
  const ref = doc(db, "users", uid, "quizDays", dateKey);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error("Hai già completato il quiz di oggi");
  }

  // Verifica le risposte: lookup diretto in QUIZ_QUESTIONS by id.
  // Non possiamo richiamare getDailyQuestions qui perché potrebbe
  // restituire un set diverso (la lista seen non include ancora queste).
  const map = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));
  let score = 0;
  const enriched = answers.map(({ questionId, userAnswer }) => {
    const q = map.get(questionId);
    const correct = q && Number(userAnswer) === Number(q.answer);
    if (correct) score += 1;
    return { questionId, userAnswer, correct };
  });

  // 1 punto per ogni risposta corretta.
  const awardedPoints = score * QUIZ_POINTS_PER_CORRECT;

  await setDoc(ref, {
    answers: enriched,
    score,
    awardedPoints,
    completedAt: serverTimestamp(),
  });

  // Aggiorna il doc utente:
  // - seenQuizIds: aggiunge gli id delle 5 domande appena giocate
  //   (arrayUnion gestisce automaticamente eventuali duplicati)
  // - quizPoints: somma i punti guadagnati (solo se > 0)
  const questionIds = answers
    .map((a) => a.questionId)
    .filter((id) => id != null);
  const userUpdate = {
    seenQuizIds: arrayUnion(...questionIds),
  };
  if (awardedPoints > 0) {
    userUpdate.quizPoints = increment(awardedPoints);
  }
  await setDoc(doc(db, "users", uid), userUpdate, { merge: true });

  return { score, awardedPoints };
}

/* Recupera quizPoints totali di tutti gli utenti (per leaderboard generale).
   Restituisce mappa uid -> quizPoints. */
export async function getAllQuizPoints() {
  const snap = await getDocs(collection(db, "users"));
  const map = {};
  snap.docs.forEach((d) => {
    const p = d.data()?.quizPoints;
    if (p && p > 0) map[d.id] = p;
  });
  return map;
}

/* Streak di giorni consecutivi di partecipazione al quiz (best-effort,
   solo ultimo 30 giorni). */
export async function getQuizStreak(uid) {
  if (!uid) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const s = await getDoc(doc(db, "users", uid, "quizDays", key));
    if (!s.exists()) break;
    streak += 1;
  }
  return streak;
}
