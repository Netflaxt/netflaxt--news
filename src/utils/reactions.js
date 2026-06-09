/* ─────────────────────────────────────────────────────────────
   src/utils/reactions.js
   Sistema reazioni agli articoli.
   Storage:
     - articles/{articleId}/reactions/{uid}  → { type, createdAt }
     - articles/{articleId}                  → { reactionCounts: {...} } (cache)
   Anti-spam: 1 reazione per user per articolo (sovrascrivibile o togglabile).
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  increment,
  updateDoc,
} from "firebase/firestore";

export const REACTION_TYPES = [
  { id: "heart",   emoji: "💙", label: "Forza Lazio" },
  { id: "clap",    emoji: "👏", label: "Grande pezzo" },
  { id: "fire",    emoji: "🔥", label: "Bomba" },
  { id: "angry",   emoji: "😡", label: "Polemica" },
  { id: "sad",     emoji: "😢", label: "Tristissimo" },
];

const isValidType = (t) => REACTION_TYPES.some((r) => r.id === t);

/* ─── Read user's current reaction ───────────────────────── */
export async function getUserReaction(articleId, uid) {
  if (!articleId || !uid) return null;
  const snap = await getDoc(doc(db, "articles", articleId, "reactions", uid));
  if (!snap.exists()) return null;
  return snap.data().type || null;
}

/* ─── Toggle/set reaction ─────────────────────────────────
   Logica:
   - se l'utente non aveva reazione → aggiunge
   - se aveva la STESSA reazione    → la rimuove (toggle off)
   - se aveva un'ALTRA reazione     → la sostituisce
   Aggiorna anche i contatori cache su articles/{id}.reactionCounts.
   ───────────────────────────────────────────────────────── */
export async function setReaction(articleId, uid, newType) {
  if (!articleId || !uid) throw new Error("articleId/uid mancanti");
  if (newType && !isValidType(newType)) throw new Error("Tipo non valido");

  const userRef = doc(db, "articles", articleId, "reactions", uid);
  const articleRef = doc(db, "articles", articleId);
  const existing = await getDoc(userRef);
  const prevType = existing.exists() ? existing.data().type : null;

  // Caso 1: toggle off (stesso tipo)
  if (prevType && prevType === newType) {
    await deleteDoc(userRef);
    await updateDoc(articleRef, {
      [`reactionCounts.${prevType}`]: increment(-1),
    }).catch(() => {});
    return null;
  }

  // Caso 2: nuovo / cambio tipo
  await setDoc(userRef, {
    type: newType,
    createdAt: serverTimestamp(),
  });
  const updates = { [`reactionCounts.${newType}`]: increment(1) };
  if (prevType) updates[`reactionCounts.${prevType}`] = increment(-1);
  await updateDoc(articleRef, updates).catch(() => {});
  return newType;
}

/* ─── Subscribe ai contatori live (campo articles/{id}.reactionCounts) ─── */
export function subscribeReactionCounts(articleId, cb) {
  if (!articleId) return () => {};
  const ref = doc(db, "articles", articleId);
  return onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    const counts = data.reactionCounts || {};
    const normalized = {};
    let total = 0;
    REACTION_TYPES.forEach((r) => {
      const n = Math.max(0, Number(counts[r.id]) || 0);
      normalized[r.id] = n;
      total += n;
    });
    cb({ counts: normalized, total });
  });
}

/* ─── Top articoli per reazioni (admin dashboard) ─────────
   Letture leggere: usa reactionCounts già presenti su /articles.
   ───────────────────────────────────────────────────────── */
export function totalReactions(article) {
  const c = article?.reactionCounts || {};
  return REACTION_TYPES.reduce((s, r) => s + (Number(c[r.id]) || 0), 0);
}
