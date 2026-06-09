/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminCommentsTab.jsx
   Tab "Commenti" del pannello Admin.
   Lista i commenti più recenti su tutti gli articoli (collectionGroup)
   e permette di eliminarli. Sorgente: articles/{id}/comments.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listRecentComments, deleteComment } from "../../utils/comments";
import { ChatIcon, EmptyIcon } from "../../components/icons";

export default function AdminCommentsTab({ onToast }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listRecentComments(150);
      setComments(list);
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore caricamento commenti", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return comments;
    return comments.filter(
      (c) =>
        (c.text || "").toLowerCase().includes(s) ||
        (c.displayName || "").toLowerCase().includes(s)
    );
  }, [comments, searchTerm]);

  const handleDelete = async (c) => {
    if (!c.articleId) {
      onToast && onToast("Impossibile risalire all'articolo", "danger");
      return;
    }
    setDeleting(c.id);
    try {
      await deleteComment(c.articleId, c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      setDeleteId(null);
      onToast && onToast("Commento eliminato", "danger");
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore eliminazione", "danger");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Ricerca + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per testo o autore..."
            className="adminInput pl-11"
          />
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-border-strong text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aggiorna
        </button>
      </div>

      <div className="text-xs text-text-muted px-1">
        <span className="text-text-primary font-semibold tabular-nums">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "commento" : "commenti"}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-bg-surface border border-border rounded-xl">
          <EmptyIcon icon={ChatIcon} className="mb-3" />
          <p className="text-text-secondary font-semibold">
            {searchTerm ? "Nessun commento trovato" : "Nessun commento ancora"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const created = c.createdAt?.toDate?.()?.toLocaleString("it-IT") || "—";
            const likeCount = c.likes ? Object.keys(c.likes).length : 0;
            return (
              <div
                key={c.id}
                className="bg-bg-surface rounded-xl border border-border p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-text-primary">
                      {c.displayName || "Tifoso"}
                    </span>
                    <span className="text-[10px] text-text-muted">{created}</span>
                    {likeCount > 0 && (
                      <span className="text-[10px] text-accent font-semibold">
                        ♥ {likeCount}
                      </span>
                    )}
                    {c.articleId && (
                      <Link
                        to={`/news/${c.articleId}`}
                        className="text-[10px] uppercase tracking-wider text-text-muted hover:text-accent font-semibold"
                      >
                        → articolo
                      </Link>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed break-words whitespace-pre-wrap">
                    {c.text}
                  </p>
                </div>
                <div className="shrink-0">
                  {deleteId === c.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting === c.id}
                        className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-md hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {deleting === c.id ? "..." : "Conferma"}
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="px-3 py-1.5 text-xs font-bold border border-border text-text-secondary rounded-md hover:bg-bg-elevated transition"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="px-3 py-1.5 text-xs font-bold border border-red-500/40 text-red-400 rounded-md hover:bg-red-500/10 transition"
                    >
                      Elimina
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
