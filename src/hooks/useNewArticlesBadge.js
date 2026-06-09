/* ─────────────────────────────────────────────────────────────
   src/hooks/useNewArticlesBadge.js
   FIX: ora usa onSnapshot (live listener) invece di polling ogni 60s.
   Quando pubblichi un articolo, il badge appare istantaneamente.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

const LS_KEY = "netflaxt:lastNewsVisit";

function readLastVisit() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function writeLastVisit(ts) {
  try {
    localStorage.setItem(LS_KEY, String(ts));
  } catch {}
}

/**
 * Marca la pagina news come "vista ora" — chiamare in News.jsx al mount.
 */
function markVisited() {
  writeLastVisit(Date.now());
  try {
    window.dispatchEvent(new CustomEvent("netflaxt:news-visited"));
  } catch {}
}

export default function useNewArticlesBadge() {
  const [latestTs, setLatestTs] = useState(0);
  const [lastVisit, setLastVisit] = useState(readLastVisit());

  // ✨ Live listener Firestore — istantaneo, niente polling
  useEffect(() => {
    const q = query(
      collection(db, "articles"),
      orderBy("date", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0].data().date;
          const t = d?.toDate?.()?.getTime?.() || 0;
          setLatestTs(t);
        }
      },
      (err) => console.warn("useNewArticlesBadge listener error:", err)
    );

    return () => unsub();
  }, []);

  // Ascolta evento di "visita news" per aggiornare lastVisit
  useEffect(() => {
    const handlerVisit = () => setLastVisit(readLastVisit());
    const handlerStorage = (e) => {
      if (e.key === LS_KEY) setLastVisit(readLastVisit());
    };
    window.addEventListener("netflaxt:news-visited", handlerVisit);
    window.addEventListener("storage", handlerStorage);
    return () => {
      window.removeEventListener("netflaxt:news-visited", handlerVisit);
      window.removeEventListener("storage", handlerStorage);
    };
  }, []);

  const hasNew = latestTs > 0 && latestTs > lastVisit;
  return { hasNew, latestTs, lastVisit };
}

useNewArticlesBadge.markVisited = markVisited;
export { markVisited };
