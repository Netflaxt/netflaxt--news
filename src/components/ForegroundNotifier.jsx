/* ─────────────────────────────────────────────────────────────
   src/components/ForegroundNotifier.jsx
   Mostra le notifiche mentre il sito è APERTO.

   Il sistema operativo mostra le notifiche solo quando l'app è chiusa o
   in secondo piano: se il tifoso sta navigando su Netflaxt, non vedrebbe
   nulla. Ed è proprio il momento peggiore per perdersele — durante la
   partita la gente è sul sito.

   Qui intercettiamo il messaggio e lo mostriamo come banner in alto,
   cliccabile per andare al contenuto.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { onForegroundMessage } from "../utils/push";

const DURATA_MS = 8000;

export default function ForegroundNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [avviso, setAvviso] = useState(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    let stacca = () => {};

    onForegroundMessage((payload) => {
      if (!vivo) return;
      const n = payload?.notification || {};
      const d = payload?.data || {};
      const titolo = n.title || d.title;
      const testo = n.body || d.body;
      if (!titolo && !testo) return;
      setAvviso({ titolo, testo, url: d.url || "/", id: Date.now() });
    })
      .then((f) => {
        if (typeof f === "function") stacca = f;
      })
      .catch(() => {});

    return () => {
      vivo = false;
      stacca();
    };
  }, [user]);

  // Sparisce da solo dopo qualche secondo
  useEffect(() => {
    if (!avviso) return;
    const t = setTimeout(() => setAvviso(null), DURATA_MS);
    return () => clearTimeout(t);
  }, [avviso]);

  if (!avviso) return null;

  const apri = () => {
    const url = avviso.url || "/";
    setAvviso(null);
    try {
      // Gli url arrivano assoluti dal server: qui serve solo il percorso
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      navigate(path);
    } catch {
      navigate("/");
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] px-2 w-[94vw] max-w-sm nf-pwa-toast-in">
      <div className="rounded-xl bg-bg-surface border border-accent/50 shadow-[0_16px_44px_-12px_rgba(0,0,0,0.6),0_0_34px_-10px_rgba(56,189,248,0.45)] overflow-hidden">
        <button
          onClick={apri}
          className="w-full text-left p-4 pr-10 hover:bg-accent/5 transition"
        >
          <div className="flex items-start gap-3">
            <img
              src="/icon-192.png"
              alt=""
              className="w-9 h-9 rounded-lg shrink-0"
            />
            <div className="min-w-0">
              {avviso.titolo && (
                <div className="text-sm font-bold text-text-primary truncate">
                  {avviso.titolo}
                </div>
              )}
              {avviso.testo && (
                <div className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                  {avviso.testo}
                </div>
              )}
            </div>
          </div>
        </button>
        <button
          onClick={() => setAvviso(null)}
          aria-label="Chiudi avviso"
          className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
