/* ─────────────────────────────────────────────────────────────
   src/components/SiteStatusModal.jsx
   Quando il sito è "in aggiornamento" o "giù" BLOCCA l'accesso con
   un overlay a schermo intero (non si può navigare).
   Eccezioni:
     - l'admin può sempre navigare (per riattivare il sito);
     - la pagina /login resta accessibile (così l'admin può entrare).
   L'overlay sparisce in automatico appena lo stato torna "operativo"
   (aggiornamento in tempo reale).
   ───────────────────────────────────────────────────────────── */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import useSiteStatus from "../hooks/useSiteStatus";
import { statusMeta } from "../utils/siteStatus";
import { useAuth } from "../context/AuthContext";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

export default function SiteStatusModal() {
  const { status, message, loading } = useSiteStatus();
  const { user } = useAuth();
  const location = useLocation();

  if (loading || status === "operational") return null;

  const meta = statusMeta(status);
  const isDown = status === "down";
  const text = message || meta.defaultMessage;
  const isAdmin = user?.email === ADMIN_EMAIL;

  /* ─── Admin: nessun blocco, solo un promemoria non invasivo ─── */
  if (isAdmin) {
    return (
      <div className="fixed bottom-4 left-4 z-[90] max-w-xs">
        <Link
          to="/admin"
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-bg-surface border shadow-xl backdrop-blur-xl hover:-translate-y-0.5 transition"
          style={{ borderColor: `${meta.color}66` }}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: meta.color }} />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
          </span>
          <span className="text-xs leading-tight">
            <span className="font-bold" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <br />
            <span className="text-text-muted">Solo tu vedi il sito · gestisci →</span>
          </span>
        </Link>
      </div>
    );
  }

  /* ─── Login sempre raggiungibile (recovery admin) ─── */
  if (location.pathname === "/login") return null;

  /* ─── Tutti gli altri: blocco totale ─── */
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-base/95 backdrop-blur-xl site-status-in">
      {/* glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[140px] opacity-30" style={{ backgroundColor: meta.color }} />
      </div>

      <div
        className="relative w-full max-w-md rounded-2xl bg-bg-surface border shadow-2xl overflow-hidden"
        style={{ borderColor: `${meta.color}66` }}
      >
        <div className="h-1.5" style={{ backgroundColor: meta.color }} />

        <div className="p-8 text-center">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-bg-elevated to-bg-base ring-1 ring-accent/30 flex items-center justify-center overflow-hidden mb-5">
            <img src="/logo.png" alt="Netflaxt News" className="w-11 h-11 object-contain" draggable="false" />
          </div>

          <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color: meta.color }}>
            {isDown ? "Servizio non disponibile" : "Manutenzione in corso"}
          </div>
          <h2 className="text-3xl text-text-primary leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {meta.title}
          </h2>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed">{text}</p>

          {/* Stato in attesa di ripristino */}
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-base/60 border border-border">
            <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
              In attesa del ripristino…
            </span>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full py-3 rounded-md border border-border text-text-secondary font-semibold text-sm hover:bg-bg-elevated hover:text-text-primary transition"
          >
            Riprova
          </button>
          <div className="mt-4 text-[10px] uppercase tracking-[0.25em] text-text-muted">
            Netflaxt News
          </div>
        </div>
      </div>

      <style>{`
        @keyframes site-status-in { from { opacity: 0; } to { opacity: 1; } }
        .site-status-in { animation: site-status-in 0.3s ease both; }
      `}</style>
    </div>
  );
}
