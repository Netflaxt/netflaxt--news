/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminReportsTab.jsx
   Coda segnalazioni utenti. Azioni: ignora, elimina contenuto, risolvi.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useMemo, useState } from "react";
import {
  subscribeReports,
  resolveReport,
  deleteReportedContent,
  REPORT_REASON_LABEL,
} from "../../utils/reports";

export default function AdminReportsTab({ onToast }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeReports(
      (list) => {
        setReports(list);
        setLoading(false);
      },
      { status: statusFilter === "all" ? null : statusFilter }
    );
    return () => unsub();
  }, [statusFilter]);

  const counts = useMemo(() => {
    return {
      pending: reports.filter((r) => r.status === "pending").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
      dismissed: reports.filter((r) => r.status === "dismissed").length,
    };
  }, [reports]);

  const handleDismiss = async (r) => {
    setBusyId(r.id);
    try {
      await resolveReport(r.id, "dismissed");
      onToast?.("Segnalazione archiviata", "info");
    } catch (e) {
      onToast?.("Errore: " + e.message, "danger");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (r) => {
    setBusyId(r.id);
    try {
      await deleteReportedContent(r);
      await resolveReport(r.id, "content-deleted");
      onToast?.("Contenuto eliminato e segnalazione chiusa", "success");
    } catch (e) {
      onToast?.("Errore eliminazione: " + e.message, "danger");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtro stato */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "pending",   label: "In coda",   color: "amber" },
          { key: "resolved",  label: "Risolte" },
          { key: "dismissed", label: "Ignorate" },
          { key: "all",       label: "Tutte" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              statusFilter === f.key
                ? "bg-accent/15 border-accent/40 text-accent"
                : "bg-bg-surface border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted self-center">
          {counts.pending} in coda · {counts.resolved} risolte · {counts.dismissed} ignorate
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="p-10 text-center text-text-muted bg-bg-surface border border-border rounded-xl">
          {statusFilter === "pending"
            ? "Nessuna segnalazione in coda. Tutto sotto controllo 👌"
            : "Nessun risultato."}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              r={r}
              busy={busyId === r.id}
              onDismiss={() => handleDismiss(r)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ r, busy, onDismiss, onDelete }) {
  const created = r.createdAt?.toDate?.()?.toLocaleString("it-IT");
  const resolved = r.resolvedAt?.toDate?.()?.toLocaleString("it-IT");
  const statusMeta = {
    pending:   { label: "In coda",   color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    resolved:  { label: "Risolta",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    dismissed: { label: "Ignorata",  color: "bg-text-muted/20 text-text-muted border-border" },
  }[r.status] || { label: r.status, color: "bg-bg-elevated text-text-secondary border-border" };

  return (
    <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-bg-elevated text-text-secondary border border-border">
            {r.contentType === "chat" ? "Chat" : "Commento"}
          </span>
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-error/10 text-error border border-error/30">
            {REPORT_REASON_LABEL(r.reason)}
          </span>
          <span className="ml-auto text-[10px] text-text-muted">{created}</span>
        </div>

        {/* Contenuto */}
        {r.contentText && (
          <div className="p-3 rounded-lg bg-bg-elevated border border-border">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1">
              Contenuto segnalato
              {r.contentAuthor?.name && (
                <span className="ml-2 text-text-secondary normal-case tracking-normal">
                  — di {r.contentAuthor.name}
                </span>
              )}
            </div>
            <div className="text-sm text-text-primary italic whitespace-pre-wrap">
              "{r.contentText}"
            </div>
          </div>
        )}

        {/* Nota reporter */}
        {r.note && (
          <div className="p-3 rounded-lg bg-bg-elevated border border-border">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1">
              Dettagli dal reporter
            </div>
            <div className="text-sm text-text-secondary whitespace-pre-wrap">
              {r.note}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-text-muted flex-wrap">
          {r.reporter?.name && (
            <span>
              Segnalato da{" "}
              <span className="text-text-secondary font-semibold">
                {r.reporter.name}
              </span>{" "}
              {r.reporter.email ? <span className="text-text-muted">({r.reporter.email})</span> : null}
            </span>
          )}
          {resolved && <span>· Chiusa il {resolved}</span>}
        </div>

        {r.status === "pending" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle">
            <button
              onClick={onDismiss}
              disabled={busy}
              className="px-4 py-2 text-xs font-bold border border-border text-text-secondary rounded-md hover:bg-bg-elevated hover:text-text-primary transition disabled:opacity-50"
            >
              Ignora
            </button>
            <button
              onClick={onDelete}
              disabled={busy}
              className="px-4 py-2 text-xs font-bold bg-red-500 text-white rounded-md hover:bg-red-600 transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Elimina contenuto e chiudi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
