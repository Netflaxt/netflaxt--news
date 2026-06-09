/* ─────────────────────────────────────────────────────────────
   src/components/ArticleReactions.jsx
   Barra reazioni live sotto un articolo.
   - 5 tipi (vedi utils/reactions.js)
   - 1 reazione per user
   - se non loggato: invita al login
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  REACTION_TYPES,
  setReaction,
  getUserReaction,
  subscribeReactionCounts,
} from "../utils/reactions";
import { playReact } from "../utils/soundDesign";

export default function ArticleReactions({ articleId }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [myType, setMyType] = useState(null);
  const [pending, setPending] = useState(null); // id in corso di toggle
  const [loadingMine, setLoadingMine] = useState(true);

  useEffect(() => {
    if (!articleId) return;
    return subscribeReactionCounts(articleId, ({ counts, total }) => {
      setCounts(counts);
      setTotal(total);
    });
  }, [articleId]);

  useEffect(() => {
    if (!articleId || !user?.uid) {
      setMyType(null);
      setLoadingMine(false);
      return;
    }
    let cancelled = false;
    setLoadingMine(true);
    getUserReaction(articleId, user.uid)
      .then((t) => {
        if (!cancelled) setMyType(t);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingMine(false));
    return () => {
      cancelled = true;
    };
  }, [articleId, user?.uid]);

  const handleClick = async (type) => {
    if (!user) return;
    if (pending) return;
    setPending(type);
    // Optimistic update locale (i conteggi arrivano via subscribe a stretto giro)
    const prev = myType;
    const next = prev === type ? null : type;
    setMyType(next);
    if (next) playReact();
    try {
      await setReaction(articleId, user.uid, type);
    } catch (e) {
      console.error("setReaction failed", e);
      setMyType(prev); // rollback
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="my-10 rounded-2xl bg-bg-surface border border-border p-6 sm:p-7">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
            Reazioni
          </div>
          <h3
            className="mt-1 text-2xl text-text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Cosa ne pensi?
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black tabular-nums text-text-primary leading-none">
            {total}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold mt-1">
            {total === 1 ? "reazione" : "reazioni"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {REACTION_TYPES.map((r) => {
          const n = counts[r.id] || 0;
          const isMine = myType === r.id;
          const isPending = pending === r.id;
          return (
            <button
              key={r.id}
              onClick={() => handleClick(r.id)}
              disabled={!user || isPending || loadingMine}
              title={r.label}
              className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition-all duration-300 select-none ${
                isMine
                  ? "bg-accent/15 border-accent/60 text-text-primary shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)] -translate-y-0.5"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-accent/40 hover:text-text-primary hover:-translate-y-0.5"
              } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`text-xl leading-none transition-transform duration-300 ${
                  isMine ? "scale-125" : "group-hover:scale-110"
                }`}
              >
                {r.emoji}
              </span>
              <span className="text-xs tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      {!user && (
        <p className="mt-4 text-xs text-text-muted">
          <Link to="/login" className="text-accent font-semibold hover:underline">
            Accedi
          </Link>{" "}
          per lasciare la tua reazione.
        </p>
      )}
    </div>
  );
}
