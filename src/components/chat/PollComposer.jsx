/* ─────────────────────────────────────────────────────────────
   src/components/chat/PollComposer.jsx
   Form inline per creare un sondaggio in chat (solo admin).
   ───────────────────────────────────────────────────────────── */
import React, { useState } from "react";

export default function PollComposer({ onSubmit, onCancel }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setOption = (i, value) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  };

  const addOption = () => {
    if (options.length < 4) setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (i) => {
    if (options.length > 2) setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    setError("");
    const valid = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return setError("Scrivi la domanda del sondaggio.");
    if (valid.length < 2) return setError("Inserisci almeno 2 opzioni.");
    setSubmitting(true);
    try {
      await onSubmit({ question: question.trim(), options });
      setQuestion("");
      setOptions(["", ""]);
    } catch (e) {
      setError(e.message || "Errore nella creazione del sondaggio.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-3 p-4 rounded-xl border border-accent/30 bg-bg-base/60 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-accent">
          Nuovo sondaggio
        </span>
        <button
          onClick={onCancel}
          className="text-text-muted hover:text-text-primary text-sm leading-none"
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>

      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Es. Chi gioca titolare in attacco?"
        maxLength={200}
        className="w-full px-3 py-2 mb-3 bg-bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition"
      />

      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="shrink-0 w-6 h-6 rounded-full bg-bg-elevated border border-border text-[10px] font-bold text-text-muted flex items-center justify-center">
              {i + 1}
            </span>
            <input
              type="text"
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Opzione ${i + 1}`}
              maxLength={80}
              className="flex-1 px-3 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(i)}
                className="shrink-0 w-7 h-7 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition"
                aria-label="Rimuovi opzione"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < 4 && (
        <button
          onClick={addOption}
          className="mt-2 text-xs font-semibold text-accent hover:text-accent-hover transition inline-flex items-center gap-1"
        >
          + Aggiungi opzione
        </button>
      )}

      {error && (
        <div className="mt-3 p-2 rounded-lg bg-error/10 border border-error/30 text-error text-xs">
          {error}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-semibold hover:bg-bg-elevated hover:text-text-primary transition"
        >
          Annulla
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-accent text-text-inverse text-sm font-bold transition hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] disabled:opacity-50"
        >
          {submitting ? "Creazione..." : "Pubblica sondaggio"}
        </button>
      </div>
    </div>
  );
}
