/* ─────────────────────────────────────────────────────────────
   src/utils/bookmarks.js
   Salvataggi articoli per utente.
   Storage:
     - users/{uid}/bookmarks/{articleId}  → { savedAt, articleSnapshot }
   Lo snapshot dell'articolo permette di mostrarlo in /profile/saved
   anche se l'articolo viene poi modificato (UX più veloce).
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export async function isBookmarked(uid, articleId) {
  if (!uid || !articleId) return false;
  const snap = await getDoc(doc(db, "users", uid, "bookmarks", articleId));
  return snap.exists();
}

export async function addBookmark(uid, article) {
  if (!uid || !article?.id) throw new Error("uid/article mancanti");
  await setDoc(doc(db, "users", uid, "bookmarks", article.id), {
    savedAt: serverTimestamp(),
    articleSnapshot: {
      title: article.title || "",
      excerpt: article.excerpt || "",
      imageUrl: article.imageUrl || "",
      category: article.category || "",
      date: article.date || null,
    },
  });
}

export async function removeBookmark(uid, articleId) {
  if (!uid || !articleId) return;
  await deleteDoc(doc(db, "users", uid, "bookmarks", articleId));
}

export async function toggleBookmark(uid, article) {
  const exists = await isBookmarked(uid, article.id);
  if (exists) {
    await removeBookmark(uid, article.id);
    return false;
  }
  await addBookmark(uid, article);
  return true;
}

export async function listBookmarks(uid) {
  if (!uid) return [];
  const q = query(
    collection(db, "users", uid, "bookmarks"),
    orderBy("savedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeBookmarks(uid, cb) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "users", uid, "bookmarks"),
    orderBy("savedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
