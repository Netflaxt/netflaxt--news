/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminSystemTab.jsx
   Tab "Sistema" del pannello Admin: imposta lo stato del sito
   (operativo / in aggiornamento / giù). Lo stato si riflette nel
   footer e fa comparire un popup grande agli utenti.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import useSiteStatus from "../../hooks/useSiteStatus";
import { setSiteStatus, STATUS_META } from "../../utils/siteStatus";

const OPTIONS = [
  {
    key: "operational",
    title: "Operativo",
    desc: "Tutto funziona. Nessun avviso agli utenti.",
  },
  {
    key: "maintenance",
    title: "In aggiornamento",
    desc: "Mostra un popup di manutenzione e l'avviso nel footer.",
  },
  {
    key: "down",
    title: "Sito giù",
    desc: "Avvisa che il sito ha problemi tecnici.",
  },
];

export default function AdminSystemTab({ onToast }) {
  const { status, message, loading } = useSiteStatus();
  const [sel, setSel] = useState("operational");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Inizializza i campi con lo stato corrente (una volta caricato)
  useEffect(() => {
    if (!loading && !initialized) {
      setSel(status);
      setMsg(message);
      setInitialized(true);
    }
  }, [loading, status, message, initialized]);

  const save = async () => {
    setSaving(true);
    try {
      await setSiteStatus(sel, msg);
      onToast && onToast("Stato del sito aggiornato", sel === "operational" ? "success" : "info");
    } catch (e) {
      console.error(e);
      onToast && onToast("Errore: serve il permesso sulle regole (config/site)", "danger");
    } finally {
      setSaving(false);
    }
  };

  const meta = STATUS_META[sel] || STATUS_META.operational;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-2xl text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
          Stato del sito
        </h3>
        <p className="text-sm text-text-secondary mt-1">
          Imposta lo stato visibile a tutti gli utenti. Lo stato attuale è{" "}
          <span className="font-bold" style={{ color: STATUS_META[status]?.color }}>
            {STATUS_META[status]?.label || "—"}
          </span>
          .
        </p>
      </div>

      {/* Selettore stato */}
      <div className="grid sm:grid-cols-3 gap-3">
        {OPTIONS.map((o) => {
          const m = STATUS_META[o.key];
          const active = sel === o.key;
          return (
            <button
              key={o.key}
              onClick={() => setSel(o.key)}
              className={`text-left rounded-xl border p-4 transition-all ${
                active ? "bg-bg-elevated" : "bg-bg-surface hover:border-border-strong border-border"
              }`}
              style={active ? { borderColor: m.color } : undefined}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-sm font-bold text-text-primary">{o.title}</span>
              </div>
              <div className="text-xs text-text-muted leading-snug">{o.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Messaggio personalizzato (solo per manutenzione/down) */}
      {sel !== "operational" && (
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-2">
            Messaggio per gli utenti (opzionale)
          </label>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder={meta.defaultMessage}
            className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition resize-none"
          />
          <div className="text-[10px] text-text-muted text-right mt-1">{msg.length}/300</div>
        </div>
      )}

      {/* Anteprima */}
      <div className="rounded-xl border bg-bg-surface p-4" style={{ borderColor: `${meta.color}59` }}>
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-2">
          Anteprima avviso
        </div>
        {sel === "operational" ? (
          <p className="text-sm text-text-secondary">
            Nessun popup. Nel footer comparirà il pallino verde “Tutti i sistemi operativi”.
          </p>
        ) : (
          <div>
            <div className="text-sm font-bold" style={{ color: meta.color }}>
              {meta.title}
            </div>
            <p className="text-sm text-text-secondary mt-1">{msg || meta.defaultMessage}</p>
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving || loading}
        className="px-6 py-3 bg-accent text-text-inverse font-bold rounded-md hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition disabled:opacity-50"
      >
        {saving ? "Salvataggio..." : "Salva stato sito"}
      </button>
    </div>
  );
}
