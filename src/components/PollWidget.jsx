/* ─────────────────────────────────────────────────────────────
   src/components/PollWidget.jsx
   Mostra il sondaggio attivo (sulla home).
   Live: contatori in tempo reale + barre risultato.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  subscribeActivePoll,
  voteOnPoll,
  getUserVote,
} from "../utils/polls";

export default function PollWidget() {
  const { user } = useAuth();
  const [poll, setPoll] = useState(undefined); // undefined=loading, null=none
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const unsub = subscribeActivePoll((p) => setPoll(p));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!poll?.id || !user?.uid) {
      setMyVote(null);
      return;
    }
    let cancelled = false;
    getUserVote(poll.id, user.uid)
      .then((v) => !cancelled && setMyVote(v))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [poll?.id, user?.uid]);

  // Loading o assente: non occupare spazio
  if (poll === undefined) return null;
  if (poll === null) return null;

  const handleVote = async (optionId) => {
    if (!user) return;
    if (busy) return;
    setBusy(true);
    try {
      const newVote = await voteOnPoll(poll.id, user.uid, optionId);
      setMyVote(newVote);
    } catch (e) {
      console.error("voteOnPoll failed", e);
    } finally {
      setBusy(false);
    }
  };

  const total = Math.max(1, poll.totalVotes || 0);
  const counts = poll.optionCounts || {};
  const showBars = !!myVote || showResults || poll.status === "closed";

  const closesAt = poll.closesAt?.toDate?.();
  const closesAtStr = closesAt
    ? closesAt.toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="relative rounded-2xl border border-border bg-bg-surface overflow-hidden shadow-xl">
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          Sondaggio Netflaxt
          {poll.status === "closed" && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
              Chiuso
            </span>
          )}
        </div>
        <h3
          className="text-3xl sm:text-4xl text-text-primary leading-tight text-balance"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {poll.question}
        </h3>

        {/* Opzioni */}
        <div className="mt-6 space-y-2.5">
          {(poll.options || []).map((opt) => {
            const n = Number(counts[opt.id]) || 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            const isMine = myVote === opt.id;
            const isClosed = poll.status === "closed";
            return (
              <button
                key={opt.id}
                onClick={() => handleVote(opt.id)}
                disabled={!user || busy || isClosed}
                className={`group relative w-full text-left rounded-xl border overflow-hidden transition-all duration-300 ${
                  isMine
                    ? "border-accent/60 bg-accent/10 shadow-[0_0_22px_-4px_rgba(56,189,248,0.55)]"
                    : "border-border bg-bg-elevated hover:border-accent/40"
                } ${(!user || isClosed) ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5"}`}
              >
                {/* Barra risultato */}
                {showBars && (
                  <span
                    className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
                      isMine
                        ? "bg-gradient-to-r from-accent/30 to-accent/10"
                        : "bg-bg-base/40"
                    }`}
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                        isMine
                          ? "border-accent bg-accent"
                          : "border-border bg-transparent group-hover:border-accent/60"
                      }`}
                    >
                      {isMine && (
                        <span className="w-2 h-2 rounded-full bg-bg-base" />
                      )}
                    </span>
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {opt.text}
                    </span>
                  </div>
                  {showBars && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-xs text-text-muted">
                        {n}
                      </span>
                      <span
                        className={`tabular-nums text-sm font-black ${
                          isMine ? "text-accent" : "text-text-secondary"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between text-xs gap-3 flex-wrap">
          <div className="text-text-muted">
            <span className="text-text-primary font-bold tabular-nums">
              {poll.totalVotes || 0}
            </span>{" "}
            {(poll.totalVotes || 0) === 1 ? "voto" : "voti"}
            {closesAtStr && (
              <span className="ml-2">· Chiude {closesAtStr}</span>
            )}
          </div>
          {!user && (
            <Link
              to="/login"
              className="text-accent font-bold hover:underline"
            >
              Accedi per votare →
            </Link>
          )}
          {user && !myVote && !showResults && poll.status === "active" && (
            <button
              onClick={() => setShowResults(true)}
              className="text-text-secondary hover:text-text-primary font-semibold transition"
            >
              Mostra risultati senza votare
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
