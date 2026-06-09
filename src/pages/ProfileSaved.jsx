/* ─────────────────────────────────────────────────────────────
   src/pages/ProfileSaved.jsx
   Lista degli articoli salvati dall'utente loggato.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeBookmarks, removeBookmark } from "../utils/bookmarks";
import { SkeletonArticleCard } from "../components/Skeleton";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900&q=80";

export default function ProfileSaved() {
  const { user, loading } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    setLoadingList(true);
    const unsub = subscribeBookmarks(user.uid, (list) => {
      setBookmarks(list);
      setLoadingList(false);
    });
    return () => unsub();
  }, [user?.uid]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const handleRemove = async (id) => {
    await removeBookmark(user.uid, id);
  };

  return (
    <main className="min-h-screen bg-bg-base text-text-primary py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent font-semibold">
            <span className="h-px w-8 bg-accent" />
            La tua libreria
          </div>
          <div className="mt-3 flex items-end justify-between flex-wrap gap-4">
            <h1
              className="text-5xl sm:text-6xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Articoli salvati
            </h1>
            <Link
              to="/profile"
              className="text-xs uppercase tracking-[0.22em] font-bold text-text-secondary hover:text-text-primary transition"
            >
              ← Torna al profilo
            </Link>
          </div>
          <p className="text-text-secondary text-sm mt-3 max-w-2xl">
            I pezzi che hai messo da parte. Cliccando il segnalibro li rimuovi dalla lista.
          </p>
        </div>

        {/* Lista */}
        {loadingList ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonArticleCard key={i} />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarks.map((b) => {
              const a = b.articleSnapshot || {};
              const date = a.date?.toDate?.()?.toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              const savedAt = b.savedAt?.toDate?.()?.toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
              });
              return (
                <div
                  key={b.id}
                  className="group relative isolate flex flex-col rounded-xl bg-bg-surface border border-border hover:border-accent/40 overflow-hidden transform-gpu transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_32px_-8px_rgba(56,189,248,0.4)]"
                >
                  <Link to={`/news/${b.id}`} className="block">
                    <div
                      className="relative aspect-[16/10] overflow-hidden bg-bg-surface"
                      style={{
                        maskImage: "linear-gradient(#000, #000)",
                        WebkitMaskImage: "linear-gradient(#000, #000)",
                        transform: "translateZ(0)",
                      }}
                    >
                      <img
                        src={a.imageUrl || FALLBACK_IMG}
                        alt={a.title}
                        className="block w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-bg-surface/80 via-transparent to-transparent" />
                      {a.category && (
                        <span className="absolute top-3 left-3 px-2 py-1 bg-bg-base/80 backdrop-blur-md border border-border text-[10px] font-bold uppercase tracking-[0.18em] text-text-primary rounded">
                          {a.category}
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-col flex-1 p-5">
                    {date && (
                      <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted mb-2">
                        {date}
                      </div>
                    )}
                    <Link to={`/news/${b.id}`}>
                      <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors leading-snug">
                        {a.title || "Articolo senza titolo"}
                      </h3>
                    </Link>
                    {a.excerpt && (
                      <p className="mt-3 text-sm text-text-secondary leading-relaxed line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                    <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-xs">
                      <span className="text-text-muted">
                        Salvato {savedAt ? `il ${savedAt}` : "di recente"}
                      </span>
                      <button
                        onClick={() => handleRemove(b.id)}
                        className="text-text-muted hover:text-error font-semibold uppercase tracking-wider text-[10px] transition"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-24 bg-bg-surface border border-border rounded-2xl">
      <div className="relative">
        <div className="absolute inset-0 bg-accent/10 blur-2xl rounded-full" />
        <div className="relative w-20 h-20 rounded-2xl border border-border bg-bg-elevated flex items-center justify-center">
          <svg
            className="w-9 h-9 text-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      </div>
      <h3
        className="mt-6 text-3xl text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Ancora nessun salvato
      </h3>
      <p className="mt-2 text-text-secondary max-w-md">
        Apri un articolo e clicca il segnalibro in alto per metterlo da parte.
      </p>
      <Link
        to="/news"
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-accent text-text-inverse text-sm font-bold hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition"
      >
        Vai alle news →
      </Link>
    </div>
  );
}
