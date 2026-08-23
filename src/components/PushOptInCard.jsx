/* ─────────────────────────────────────────────────────────────
   src/components/PushOptInCard.jsx
   Tile nel Profile per abilitare/disabilitare le notifiche push.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  isPushSupported,
  currentPermission,
  enablePush,
  getUserPushTokens,
} from "../utils/push";

export default function PushOptInCard({ user }) {
  const [supported, setSupported] = useState(true);
  const [perm, setPerm] = useState("default");
  const [tokens, setTokens] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    setPerm(currentPermission());
    if (user?.uid) {
      getUserPushTokens(user.uid).then(setTokens).catch(() => {});
    }
  }, [user?.uid]);

  /* Notifica generata dal dispositivo stesso, senza passare dal server.
     Serve a distinguere due problemi diversi: se questa NON compare, il
     permesso è stato revocato dalle impostazioni del telefono; se compare
     ma quelle del sito no, il problema è nella consegna. */
  const handleProva = async () => {
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🦅 Prova Netflaxt", {
        body: "Se leggi questo, il tuo dispositivo mostra le notifiche.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `prova-${Date.now()}`,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(
        e?.message ||
          "Il dispositivo non ha mostrato la notifica: controlla i permessi nelle impostazioni."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = async () => {
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await enablePush(user.uid);
      setPerm(currentPermission());
      const list = await getUserPushTokens(user.uid);
      setTokens(list);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e.message || "Errore attivazione notifiche");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="bg-bg-surface border border-border rounded-2xl p-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">
          Notifiche push
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Il tuo browser non supporta le notifiche push. Prova da Chrome, Edge o
          Firefox.
        </p>
      </div>
    );
  }

  const enabled = perm === "granted" && tokens.length > 0;

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
            Notifiche push
          </div>
          <h2 className="text-2xl text-text-primary mt-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Resta sul pezzo
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-md">
            Ricevi un avviso per ogni nuovo articolo Netflaxt e per i risultati
            della Lazio, anche quando il sito è chiuso.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] uppercase tracking-wider font-bold ${
            enabled
              ? "bg-success/10 border-success/40 text-success"
              : perm === "denied"
              ? "bg-error/10 border-error/40 text-error"
              : "bg-bg-elevated border-border text-text-muted"
          }`}
        >
          {enabled ? "✓ Attive" : perm === "denied" ? "✕ Bloccate" : "Disattive"}
        </div>
      </div>

      {perm === "denied" && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-xs mb-3">
          Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser.
        </div>
      )}

      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-xs mb-3">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-success/10 border border-success/30 rounded-md text-success text-xs font-semibold mb-3">
          ✓ Notifiche attivate su questo dispositivo.
        </div>
      )}

      {!enabled && perm !== "denied" && (
        <button
          onClick={handleEnable}
          disabled={busy || !user}
          className="px-5 py-3 rounded-md bg-accent text-text-inverse text-sm font-bold transition disabled:opacity-50 hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] inline-flex items-center gap-2"
        >
          {busy && <span className="w-4 h-4 border-2 border-text-inverse border-t-transparent rounded-full animate-spin" />}
          {busy ? "Attivazione…" : "🔔 Attiva notifiche"}
        </button>
      )}

      {enabled && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleProva}
              disabled={busy}
              className="px-4 py-2 rounded-md bg-bg-elevated border border-border text-text-primary text-xs font-bold uppercase tracking-wider hover:border-accent/40 transition disabled:opacity-50"
            >
              Prova qui
            </button>
            <button
              onClick={handleEnable}
              disabled={busy}
              className="px-4 py-2 rounded-md bg-bg-elevated border border-border text-text-secondary text-xs font-bold uppercase tracking-wider hover:border-accent/40 transition disabled:opacity-50"
            >
              Riattiva su questo dispositivo
            </button>
          </div>
          <div className="mt-3 text-xs text-text-muted">
            Notifiche attive su {tokens.length}{" "}
            {tokens.length === 1 ? "dispositivo" : "dispositivi"}.{" "}
            <strong className="text-text-secondary">Prova qui</strong> controlla
            che il telefono le mostri; se non compare nulla, il permesso è stato
            tolto dalle impostazioni del dispositivo.
          </div>
        </>
      )}
    </div>
  );
}
