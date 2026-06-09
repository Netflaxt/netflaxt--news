/* ─────────────────────────────────────────────────────────────
   src/components/ReportButton.jsx
   Bottone + modal per segnalare un contenuto (commento / chat).
   ───────────────────────────────────────────────────────────── */
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  REPORT_REASONS,
  submitReport,
} from "../utils/reports";

export default function ReportButton({
  contentType,         // 'comment' | 'chat'
  contentId,
  contentText,
  contentAuthor,       // { uid, name }
  targetRefPath,       // commenti: array di segmenti firestore ["articles","X","comments","Y"]
  targetRtdbPath,      // chat: stringa rtdb es. "messages/abc123"
  size = "sm",
  className = "",
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setOpen(false);
    setReason("");
    setNote("");
    setSending(false);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!reason) {
      setError("Scegli un motivo.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await submitReport({
        contentType,
        contentId,
        contentText,
        contentAuthor,
        targetRef: targetRtdbPath
          ? { rtdbPath: targetRtdbPath }
          : { path: targetRefPath },
        reason,
        note,
        reporter: user,
      });
      setSuccess(true);
      setTimeout(() => {
        reset();
        setSuccess(false);
      }, 1800);
    } catch (err) {
      setError(err.message || "Errore invio segnalazione");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => user && setOpen(true)}
        disabled={!user}
        title={user ? "Segnala questo contenuto" : "Accedi per segnalare"}
        className={`inline-flex items-center gap-1 text-text-muted hover:text-error transition ${
          size === "sm" ? "text-[10px]" : "text-xs"
        } font-bold uppercase tracking-wider ${className} ${
          !user ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <FlagIcon />
        Segnala
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-bg-base/85 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => !sending && reset()}
          />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md rounded-2xl bg-bg-surface border border-border shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-error font-bold">
                  Segnalazione
                </div>
                <h3 className="text-2xl text-text-primary mt-1" style={{ fontFamily: "var(--font-display)" }}>
                  Cosa non va?
                </h3>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={sending}
                className="w-8 h-8 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition"
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Snapshot contenuto */}
              {contentText && (
                <div className="p-3 rounded-lg bg-bg-elevated border border-border text-xs text-text-secondary italic max-h-24 overflow-y-auto">
                  "{contentText.slice(0, 240)}{contentText.length > 240 ? "…" : ""}"
                </div>
              )}

              {/* Motivi */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-secondary mb-2">
                  Motivo *
                </div>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        reason === r.id
                          ? "bg-error/10 border-error/40 text-text-primary"
                          : "bg-bg-elevated border-border text-text-secondary hover:border-error/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={(e) => setReason(e.target.value)}
                        className="accent-error"
                      />
                      <span className="text-sm font-semibold">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nota */}
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.22em] font-bold text-text-secondary mb-2">
                  Dettagli (opzionale)
                </span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Aggiungi un dettaglio che possa aiutare l'admin…"
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-md text-text-primary text-sm focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 resize-none"
                />
                <span className="block text-right text-[10px] text-text-muted mt-1">
                  {note.length}/500
                </span>
              </label>

              {error && (
                <div className="p-2.5 bg-error/10 border border-error/30 rounded-md text-error text-xs">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-2.5 bg-success/10 border border-success/30 rounded-md text-success text-xs font-semibold flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-success flex items-center justify-center text-white text-[10px]">
                    ✓
                  </span>
                  Segnalazione inviata. Grazie!
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex gap-2 justify-end">
              <button
                type="button"
                onClick={reset}
                disabled={sending}
                className="px-4 py-2.5 rounded-md border border-border text-text-secondary text-sm font-semibold hover:bg-bg-elevated hover:text-text-primary transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={sending || success}
                className="px-4 py-2.5 rounded-md bg-error text-white text-sm font-bold transition disabled:opacity-50 inline-flex items-center gap-2 hover:brightness-110"
              >
                {sending && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Invia segnalazione
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function FlagIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21V4M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}
