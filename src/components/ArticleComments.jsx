/* ─────────────────────────────────────────────────────────────
   src/components/ArticleComments.jsx
   Sezione commenti sotto ogni articolo (#20).
   - Solo utenti registrati possono commentare
   - Filtro contenuti + ban progressivo condivisi con la chat
   - Like ai commenti, eliminazione (autore o admin)
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  subscribeComments,
  addComment,
  toggleCommentLike,
  deleteComment,
  MAX_COMMENT_LEN,
} from "../utils/comments";
import { checkText } from "../utils/contentFilter";
import {
  getModerationStatus,
  applyViolation,
  suspensionDurationLabel,
} from "../utils/moderationService";
import { ChatIcon, EmptyIcon } from "./icons";
import ReportButton from "./ReportButton";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

const AVATAR_GRADIENTS = [
  "from-sky-400 to-sky-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-violet-400 to-violet-600",
  "from-cyan-400 to-cyan-600",
];

function gradientFor(seed = "x") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function initials(name) {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

function timeAgo(date) {
  if (!date) return "ora";
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function CommentAvatar({ photoURL, displayName, seed, size = "h-9 w-9" }) {
  const [broken, setBroken] = useState(false);
  if (photoURL && !broken) {
    return (
      <img
        src={photoURL}
        alt={displayName || ""}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${size} rounded-full object-cover ring-2 ring-bg-base bg-bg-elevated shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br ${gradientFor(
        seed || displayName || "x"
      )} flex items-center justify-center text-[11px] font-black text-text-inverse ring-2 ring-bg-base shrink-0`}
    >
      {initials(displayName)}
    </div>
  );
}

export default function ArticleComments({ articleId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [modStatus, setModStatus] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [replyTo, setReplyTo] = useState(null); // {id, uid, displayName, text}
  const inputRef = useRef(null);

  // Sottoscrizione commenti
  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    const unsub = subscribeComments(
      articleId,
      (list) => {
        setComments(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [articleId]);

  // Stato moderazione (per bloccare sospesi/disabilitati)
  useEffect(() => {
    if (!user?.uid) {
      setModStatus(null);
      return;
    }
    let cancelled = false;
    getModerationStatus(user.uid)
      .then((s) => !cancelled && setModStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const blocked = modStatus?.accountDisabled || modStatus?.isSuspended;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending || !user) return;
    setError(null);

    if (modStatus?.accountDisabled) {
      setError({ kind: "blocked", msg: "Il tuo account è disattivato. Non puoi commentare." });
      return;
    }
    if (modStatus?.isSuspended) {
      setError({
        kind: "blocked",
        msg: `Sei sospeso fino al ${modStatus.suspendedUntil?.toLocaleString("it-IT")}.`,
      });
      return;
    }

    // Filtro contenuti condiviso con la chat
    const check = checkText(text);
    if (!check.ok) {
      setSending(true);
      try {
        const result = await applyViolation(
          user.uid,
          { type: check.type, match: check.match, text },
          []
        );
        const fresh = await getModerationStatus(user.uid);
        setModStatus(fresh);
        setDraft("");
        setError({
          kind: "violation",
          msg: result.accountDisabled
            ? "Hai raggiunto la 4ª violazione: account disattivato."
            : `Commento bloccato per "${check.match}". Sospeso per ${suspensionDurationLabel(
                result.banCount
              )}. Puoi fare ricorso dal profilo.`,
        });
      } catch (err) {
        console.error(err);
        setError({ kind: "error", msg: "Errore. Riprova." });
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      await addComment(articleId, user, text, replyTo);
      setDraft("");
      setReplyTo(null);
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
      setError({ kind: "error", msg: "Errore nell'invio del commento." });
    } finally {
      setSending(false);
    }
  };

  const handleStartReply = (c) => {
    setReplyTo({
      id: c.id,
      uid: c.uid,
      displayName: c.displayName,
      text: c.text,
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleLike = (c) => {
    if (!user) return;
    const liked = !!c.likes?.[user.uid];
    toggleCommentLike(articleId, c.id, user.uid, liked).catch((e) =>
      console.error("Errore like:", e)
    );
  };

  const handleDelete = async (c) => {
    try {
      await deleteComment(articleId, c.id);
      setDeleteId(null);
    } catch (e) {
      console.error("Errore eliminazione:", e);
    }
  };

  const sortedByTop = useMemo(() => comments, [comments]);

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pb-16">
      <div className="pt-10 border-t border-border-subtle">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-1.5">
              La parola ai tifosi
            </div>
            <h2
              className="text-3xl sm:text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)" }}
            >
              COMMENTI
              <span className="ml-2 text-accent text-2xl tabular-nums">
                {comments.length}
              </span>
            </h2>
          </div>
        </div>

        {/* Composer */}
        {user ? (
          blocked ? (
            <div className="mb-8 p-4 rounded-xl border border-error/30 bg-error/10 text-sm text-text-primary">
              {modStatus?.accountDisabled
                ? "Il tuo account è disattivato: non puoi commentare."
                : `Sei sospeso dalla community fino al ${modStatus.suspendedUntil?.toLocaleString(
                    "it-IT"
                  )}.`}{" "}
              <Link to="/profile" className="font-bold text-accent hover:underline">
                Vai al profilo
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="flex gap-3">
                <CommentAvatar
                  photoURL={user.photoURL}
                  displayName={user.displayName || user.email}
                  seed={user.uid}
                />
                <div className="flex-1 min-w-0">
                  {replyTo && (
                    <div className="mb-2 flex items-start gap-2 p-2.5 rounded-lg bg-accent/8 border border-accent/30 text-xs">
                      <span className="shrink-0 mt-0.5 text-accent">↩</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-accent font-bold">
                          In risposta a {replyTo.displayName}
                        </div>
                        <div className="text-text-secondary truncate italic">
                          "{replyTo.text}"
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="shrink-0 text-text-muted hover:text-text-primary text-base leading-none"
                        aria-label="Annulla risposta"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
                      if (e.key === "Escape" && replyTo) setReplyTo(null);
                    }}
                    rows={3}
                    maxLength={MAX_COMMENT_LEN}
                    placeholder={
                      replyTo
                        ? `Rispondi a ${replyTo.displayName}…`
                        : "Scrivi un commento rispettoso..."
                    }
                    disabled={sending}
                    className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition resize-none disabled:opacity-50"
                  />
                  {error && (
                    <div
                      className={`mt-2 p-3 rounded-lg text-xs ${
                        error.kind === "violation" || error.kind === "blocked"
                          ? "bg-error/10 border border-error/30 text-error"
                          : "bg-warning/10 border border-warning/30 text-warning"
                      }`}
                    >
                      {error.msg}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">
                      {draft.length}/{MAX_COMMENT_LEN} ·{" "}
                      <span className="hidden sm:inline">Niente bestemmie o insulti</span>
                    </span>
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="px-5 py-2 rounded-lg bg-accent text-text-inverse text-sm font-bold transition-all hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sending ? "Invio..." : "Commenta"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )
        ) : (
          <div className="mb-8 p-5 rounded-xl border border-border bg-bg-surface text-center">
            <p className="text-text-secondary text-sm">
              <Link to="/login" className="font-bold text-accent hover:underline">
                Accedi
              </Link>{" "}
              per lasciare un commento e unirti alla discussione.
            </p>
          </div>
        )}

        {/* Lista commenti */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-bg-surface/50">
            <EmptyIcon icon={ChatIcon} className="mb-3" />
            <p className="text-text-secondary font-semibold">Ancora nessun commento.</p>
            <p className="text-text-muted text-sm mt-1">Sii il primo a dire la tua.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {sortedByTop.map((c) => {
              const liked = !!(user && c.likes?.[user.uid]);
              const likeCount = c.likes ? Object.keys(c.likes).length : 0;
              const canDelete = user && (c.uid === user.uid || isAdmin);
              const created = c.createdAt?.toDate?.() || null;
              return (
                <li key={c.id} className="flex gap-3">
                  <CommentAvatar
                    photoURL={c.photoURL}
                    displayName={c.displayName}
                    seed={c.uid}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="rounded-xl bg-bg-surface border border-border px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-text-primary">
                          {c.displayName || "Tifoso"}
                        </span>
                        <span className="text-[10px] text-text-muted">{timeAgo(created)}</span>
                      </div>
                      {c.replyTo && (
                        <div className="mb-2 pl-2.5 border-l-2 border-accent/40 text-xs">
                          <div className="text-[10px] uppercase tracking-wider text-accent font-bold">
                            ↩ in risposta a {c.replyTo.displayName || "Utente"}
                          </div>
                          <div className="text-text-muted italic truncate">
                            "{c.replyTo.text}"
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
                        {c.text}
                      </p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 px-1">
                      <button
                        onClick={() => handleLike(c)}
                        disabled={!user}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${
                          liked ? "text-accent" : "text-text-muted hover:text-text-secondary"
                        } disabled:cursor-not-allowed`}
                        aria-label="Mi piace"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill={liked ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
                      </button>

                      {user && c.uid !== user.uid && !blocked && (
                        <button
                          onClick={() => handleStartReply(c)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-accent transition"
                          aria-label="Rispondi"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4 4-4m-3 4h11a4 4 0 014 4v4" />
                          </svg>
                          Rispondi
                        </button>
                      )}

                      {canDelete &&
                        (deleteId === c.id ? (
                          <span className="inline-flex items-center gap-2 text-xs">
                            <button
                              onClick={() => handleDelete(c)}
                              className="font-bold text-error hover:underline"
                            >
                              Elimina
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="text-text-muted hover:text-text-secondary"
                            >
                              Annulla
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteId(c.id)}
                            className="text-xs font-semibold text-text-muted hover:text-error transition"
                          >
                            Elimina
                          </button>
                        ))}

                      {/* Segnala — solo per commenti NON propri e se loggato */}
                      {user && c.uid !== user.uid && (
                        <ReportButton
                          contentType="comment"
                          contentId={c.id}
                          contentText={c.text}
                          contentAuthor={{ uid: c.uid, name: c.displayName }}
                          targetRefPath={["articles", articleId, "comments", c.id]}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
