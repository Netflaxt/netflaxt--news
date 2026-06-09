/* ─────────────────────────────────────────────────────────────
   src/components/BookmarkButton.jsx
   Bottone "salva articolo" — segnalibro animato.
   Variants:
     - "inline" (default) → pill grande con etichetta, per ArticleDetail
     - "icon"             → solo icona, per card News/Home
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  isBookmarked as checkBookmarked,
  toggleBookmark,
} from "../utils/bookmarks";
import { playSave } from "../utils/soundDesign";

export default function BookmarkButton({ article, variant = "inline" }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (!user?.uid || !article?.id) {
      setSaved(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    checkBookmarked(user.uid, article.id)
      .then((v) => !cancelled && setSaved(v))
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [user?.uid, article?.id]);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.uid || !article?.id || busy) return;
    setBusy(true);
    const prev = saved;
    setSaved(!prev);
    setPop(true);
    setTimeout(() => setPop(false), 380);
    try {
      const newState = await toggleBookmark(user.uid, article);
      setSaved(newState);
      if (newState) playSave();
    } catch (err) {
      console.error("toggleBookmark failed", err);
      setSaved(prev);
    } finally {
      setBusy(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={!user || busy || !ready}
        aria-label={saved ? "Rimuovi dai salvati" : "Salva articolo"}
        title={
          !user
            ? "Accedi per salvare"
            : saved
            ? "Rimuovi dai salvati"
            : "Salva articolo"
        }
        className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 backdrop-blur-md ${
          saved
            ? "bg-accent/20 border-accent/60 text-accent shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)]"
            : "bg-bg-base/70 border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
        } ${!user ? "opacity-50 cursor-not-allowed" : ""} ${
          pop ? "scale-125" : "scale-100"
        }`}
      >
        <BookmarkIcon filled={saved} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!user || busy || !ready}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all duration-300 ${
        saved
          ? "bg-accent/15 border-accent/60 text-text-primary shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)]"
          : "bg-bg-elevated border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
      } ${!user ? "opacity-50 cursor-not-allowed" : ""} ${
        pop ? "scale-110" : "scale-100"
      }`}
    >
      <BookmarkIcon filled={saved} />
      {saved ? "Salvato" : "Salva"}
    </button>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
