/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminPollsTab.jsx
   Crea, chiudi, riapri, elimina sondaggi.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  subscribeAllPolls,
  createPoll,
  closePoll,
  reopenPoll,
  deletePoll,
} from "../../utils/polls";

export default function AdminPollsTab({ onToast }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form stato
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [closesAt, setClosesAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    const unsub = subscribeAllPolls((list) => {
      setPolls(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setQuestion("");
    setOptions(["", ""]);
    setClosesAt("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createPoll({
        question,
        options: options
          .map((t, i) => ({ id: `opt_${i + 1}`, text: t }))
          .filter((o) => o.text.trim()),
        closesAt: closesAt || null,
      });
      resetForm();
      onToast?.("Sondaggio creato", "success");
    } catch (err) {
      onToast?.(err.message || "Errore creazione sondaggio", "danger");
    } finally {
      setCreating(false);
    }
  };

  const updateOption = (i, v) => {
    setOptions((arr) => arr.map((o, idx) => (idx === i ? v : o)));
  };
  const addOption = () => setOptions((arr) => (arr.length >= 6 ? arr : [...arr, ""]));
  const removeOption = (i) =>
    setOptions((arr) => (arr.length <= 2 ? arr : arr.filter((_, idx) => idx !== i)));

  const handleClose = async (id) => {
    try {
      await closePoll(id);
      onToast?.("Sondaggio chiuso", "info");
    } catch (e) {
      onToast?.("Errore: " + e.message, "danger");
    }
  };
  const handleReopen = async (id) => {
    try {
      await reopenPoll(id);
      onToast?.("Sondaggio riaperto", "success");
    } catch (e) {
      onToast?.("Errore: " + e.message, "danger");
    }
  };
  const handleDelete = async (id) => {
    try {
      await deletePoll(id);
      setDeleteConfirm(null);
      onToast?.("Sondaggio eliminato", "danger");
    } catch (e) {
      onToast?.("Errore: " + e.message, "danger");
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* FORM CREA */}
      <form
        onSubmit={handleCreate}
        className="lg:col-span-5 bg-bg-surface rounded-2xl border border-border shadow-xl overflow-hidden h-fit"
      >
        <div className="p-6 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
            Nuovo sondaggio
          </div>
          <h3 className="mt-1 text-2xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
            Crea sondaggio
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            Apparirà nella home come "sondaggio attivo". Solo l'ultimo creato è mostrato agli utenti.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Domanda *
            </span>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Es. Chi è stato il man of the match?"
              required
              maxLength={150}
              className="adminInput"
            />
          </label>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Opzioni * (min 2 — max 6)
            </div>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={o}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Opzione ${i + 1}`}
                    maxLength={80}
                    className="adminInput flex-1"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="w-9 h-9 rounded-md border border-border text-text-muted hover:text-error hover:border-error/40 transition"
                      aria-label="Rimuovi opzione"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-xs font-semibold text-accent hover:underline"
              >
                + Aggiungi opzione
              </button>
            )}
          </div>

          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
              Chiude il (opzionale)
            </span>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="adminInput"
            />
            <span className="block mt-1 text-[11px] text-text-muted">
              Se vuoto, il sondaggio resta attivo finché non lo chiudi manualmente.
            </span>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3 bg-accent text-text-inverse font-bold rounded-md hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] transition disabled:opacity-50"
          >
            {creating ? "Pubblicazione…" : "🚀 Pubblica sondaggio"}
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="lg:col-span-7 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
            Sondaggi
          </h3>
          <span className="text-xs text-text-muted">
            {polls.length} totali · {polls.filter((p) => p.status === "active").length} attivi
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : polls.length === 0 ? (
          <div className="p-10 text-center text-text-muted bg-bg-surface border border-border rounded-xl">
            Nessun sondaggio. Creane uno!
          </div>
        ) : (
          polls.map((p) => {
            const total = p.totalVotes || 0;
            const counts = p.optionCounts || {};
            const isClosed = p.status === "closed";
            const created = p.createdAt?.toDate?.()?.toLocaleString("it-IT");
            return (
              <div
                key={p.id}
                className="bg-bg-surface border border-border rounded-xl overflow-hidden"
              >
                <div className="p-5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                          isClosed
                            ? "bg-text-muted/20 text-text-muted"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {isClosed ? "Chiuso" : "Attivo"}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {created}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        · {total} voti
                      </span>
                    </div>
                    <div className="font-bold text-text-primary text-base mb-3 leading-snug">
                      {p.question}
                    </div>
                    <div className="space-y-1.5">
                      {(p.options || []).map((opt) => {
                        const n = Number(counts[opt.id]) || 0;
                        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                        return (
                          <div
                            key={opt.id}
                            className="relative overflow-hidden rounded-md bg-bg-elevated border border-border"
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-accent/20"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-3 px-3 py-2 text-xs">
                              <span className="text-text-primary font-semibold truncate">
                                {opt.text}
                              </span>
                              <span className="tabular-nums text-text-secondary font-bold shrink-0">
                                {n} ({pct}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {isClosed ? (
                      <button
                        onClick={() => handleReopen(p.id)}
                        className="px-3 py-1.5 text-[11px] font-bold border border-accent/40 text-accent rounded-md hover:bg-accent/10 transition"
                      >
                        Riapri
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClose(p.id)}
                        className="px-3 py-1.5 text-[11px] font-bold border border-amber-500/40 text-amber-400 rounded-md hover:bg-amber-500/10 transition"
                      >
                        Chiudi
                      </button>
                    )}
                    {deleteConfirm === p.id ? (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-3 py-1.5 text-[11px] font-bold bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                        >
                          Conferma
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 text-[11px] font-bold border border-border text-text-secondary rounded-md"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(p.id)}
                        className="px-3 py-1.5 text-[11px] font-bold border border-red-500/40 text-red-400 rounded-md hover:bg-red-500/10 transition"
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
