/* ─────────────────────────────────────────────────────────────
   src/utils/comments.js
   Commenti agli articoli (separati dalla chat).
   Sorgente dati: Firestore subcollection
       articles/{articleId}/comments/{commentId}
   Campi commento:
     - uid, displayName, photoURL
     - text
     - createdAt: serverTimestamp
     - likes: { [uid]: true }
   La moderazione (filtro contenuti + ban progressivo) è
   condivisa con la chat tramite utils/contentFilter +
   utils/moderationService (stesso banCount sull'utente).
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  deleteField,
  increment,
} from "firebase/firestore";

const MAX_COMMENT_LEN = 800;

/** Sottoscrive i commenti di un articolo (più recenti in cima). */
export function subscribeComments(articleId, onData, onError) {
  if (!articleId) return () => {};
  const q = query(
    collection(db, "articles", articleId, "comments"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(list);
    },
    (err) => {
      console.error("Errore lettura commenti:", err);
      onError && onError(err);
    }
  );
}

/** Aggiunge un commento (testo già validato dal chiamante). */
export async function addComment(articleId, user, text, replyTo = null) {
  if (!articleId || !user?.uid) throw new Error("Dati mancanti");
  const clean = (text || "").trim().slice(0, MAX_COMMENT_LEN);
  if (!clean) throw new Error("Commento vuoto");

  const payload = {
    uid: user.uid,
    displayName:
      user.displayName || (user.email ? user.email.split("@")[0] : "Anonimo"),
    photoURL: user.photoURL || null,
    text: clean,
    createdAt: serverTimestamp(),
    likes: {},
  };

  if (replyTo && replyTo.id) {
    payload.replyTo = {
      id: replyTo.id,
      uid: replyTo.uid || null,
      displayName: replyTo.displayName || "Utente",
      text: (replyTo.text || "").slice(0, 200),
    };
  }

  await addDoc(collection(db, "articles", articleId, "comments"), payload);
  // Aggiorna il contatore commenti dell'utente (badge "opinionista")
  try {
    await setDoc(
      doc(db, "users", user.uid),
      { commentCount: increment(1) },
      { merge: true }
    );
  } catch (e) {
    console.warn("Increment commentCount fallito:", e);
  }
}

/** Toggle del like di un commento. */
export async function toggleCommentLike(articleId, commentId, uid, currentlyLiked) {
  if (!articleId || !commentId || !uid) return;
  const ref = doc(db, "articles", articleId, "comments", commentId);
  await updateDoc(ref, {
    [`likes.${uid}`]: currentlyLiked ? deleteField() : true,
  });
}

/** Elimina un commento (autore o admin). */
export async function deleteComment(articleId, commentId) {
  if (!articleId || !commentId) return;
  await deleteDoc(doc(db, "articles", articleId, "comments", commentId));
}

/**
 * Lista i commenti più recenti su TUTTI gli articoli (per la Admin).
 * Evita le collectionGroup query (che richiederebbero regole + indici
 * dedicati): legge i commenti articolo per articolo, così funziona con
 * le stesse regole usate dal sito pubblico.
 */
export async function listRecentComments(max = 150) {
  const artSnap = await getDocs(
    query(collection(db, "articles"), orderBy("date", "desc"))
  );
  const all = [];
  await Promise.all(
    artSnap.docs.map(async (art) => {
      try {
        const cSnap = await getDocs(collection(db, "articles", art.id, "comments"));
        cSnap.forEach((c) => all.push({ id: c.id, articleId: art.id, ...c.data() }));
      } catch (e) {
        console.warn("Commenti non leggibili per articolo", art.id, e);
      }
    })
  );
  all.sort(
    (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
  );
  return all.slice(0, max);
}

export { MAX_COMMENT_LEN };
