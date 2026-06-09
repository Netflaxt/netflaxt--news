/* ─────────────────────────────────────────────────────────────
   src/components/ChatMessageNotifier.jsx
   Popup GLOBALE "nuovo messaggio in chat".
   - Visibile su tutte le pagine TRANNE /chat (lì li leggi già).
   - Mostra: foto + nome mittente + anteprima messaggio.
   - Suono solo se l'utente ha attivato i micro-suoni.
   - Non notifica i propri messaggi.
   - Anti-spam:
       • L'utente può silenziare: 2 ore / 1 giorno / per sempre.
       • Se arrivano > 10 messaggi di fila in poco tempo (flood),
         il popup smette di apparire finché il flusso non si calma.
   - Click sul popup → vai alla chat.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { rtdb } from "../firebase/firebase";
import { ref, query, orderByChild, limitToLast, onChildAdded } from "firebase/database";
import { useAuth } from "../context/AuthContext";
import { playReact } from "../utils/soundDesign";

const SILENCE_KEY = "netflaxt:chatNotifSilenceUntil";
const BURST_LIMIT = 10; // dopo 10 msg di fila smette
const BURST_RESET_MS = 60 * 1000; // il "di fila" si azzera dopo 60s di calma

function getSilencedUntil() {
  try {
    const v = localStorage.getItem(SILENCE_KEY);
    if (!v) return 0;
    if (v === "forever") return Infinity;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function isSilenced() {
  return getSilencedUntil() > Date.now();
}
function setSilence(kind) {
  try {
    if (kind === "forever") localStorage.setItem(SILENCE_KEY, "forever");
    else if (kind === "1d") localStorage.setItem(SILENCE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    else if (kind === "2h") localStorage.setItem(SILENCE_KEY, String(Date.now() + 2 * 60 * 60 * 1000));
  } catch {}
}

function Avatar({ photoURL, name }) {
  const [broken, setBroken] = useState(false);
  if (photoURL && !broken) {
    return (
      <img
        src={photoURL}
        alt={name || ""}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="w-10 h-10 rounded-full object-cover bg-bg-elevated shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center text-xs font-black text-text-inverse shrink-0">
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function ChatMessageNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [showSilenceMenu, setShowSilenceMenu] = useState(false);

  // Refs per logica burst e per leggere lo stato "sono in /chat" dentro
  // la callback senza ri-sottoscrivere il listener.
  const onChatRef = useRef(false);
  const burstCountRef = useRef(0);
  const burstTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    onChatRef.current = location.pathname.startsWith("/chat");
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.uid) return;
    initializedRef.current = false;
    burstCountRef.current = 0;

    const q = query(ref(rtdb, "messages"), orderByChild("timestamp"), limitToLast(1));
    const unsub = onChildAdded(q, (snap) => {
      // Il primo evento è il messaggio già esistente al mount: ignora.
      if (!initializedRef.current) {
        initializedRef.current = true;
        return;
      }
      const m = snap.val();
      if (!m) return;

      // Niente notifica per i propri messaggi
      if (m.uid === user.uid) return;
      // Niente notifica se sei già in chat
      if (onChatRef.current) return;
      // Sondaggi: niente popup (sono eventi speciali)
      if (m.type === "poll") return;
      // Silenziato dall'utente?
      if (isSilenced()) return;

      // Anti-flood: conta i messaggi ravvicinati. Oltre il limite, stop.
      burstCountRef.current += 1;
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => {
        burstCountRef.current = 0;
      }, BURST_RESET_MS);
      if (burstCountRef.current > BURST_LIMIT) return;

      // Anteprima testo
      let preview = (m.text || "").trim();
      if (!preview && m.media) {
        preview = m.media.type === "video" ? "🎥 Video" : "📷 Foto";
      }
      if (!preview) preview = "Nuovo messaggio";

      setToast({
        name: m.displayName || "Tifoso",
        photoURL: m.photoURL || null,
        preview: preview.slice(0, 90),
      });
      setShowSilenceMenu(false);
      try { playReact(); } catch {}

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setToast(null), 5000);
    });

    return () => {
      unsub();
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [user?.uid]);

  // Non renderizzare se: niente toast, in chat, o non loggato
  if (!toast || !user || location.pathname.startsWith("/chat")) return null;

  const goToChat = () => {
    setToast(null);
    navigate("/chat");
  };

  const silence = (kind) => {
    setSilence(kind);
    setShowSilenceMenu(false);
    setToast(null);
  };

  return (
    <div className="fixed top-20 right-4 z-[94] w-[88vw] max-w-xs nf-chatnotif-in">
      <div className="relative rounded-2xl bg-bg-surface border border-accent/40 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6),0_0_36px_-12px_rgba(56,189,248,0.5)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent-hover to-accent" />
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <button onClick={goToChat} className="flex items-start gap-2.5 flex-1 min-w-0 text-left">
              <Avatar photoURL={toast.photoURL} name={toast.name} />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-[0.22em] text-accent font-black">
                  Nuovo messaggio in chat
                </div>
                <div className="text-sm font-bold text-text-primary truncate">
                  {toast.name}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {toast.preview}
                </div>
              </div>
            </button>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button
                onClick={() => setToast(null)}
                className="w-6 h-6 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition"
                aria-label="Chiudi"
              >
                ✕
              </button>
              <button
                onClick={() => setShowSilenceMenu((v) => !v)}
                className="w-6 h-6 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition"
                aria-label="Silenzia notifiche"
                title="Silenzia"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14V11a5 5 0 00-4-4.9M7 7l10 10M5.6 5.6A5 5 0 007 11v3l-2 2h11" />
                </svg>
              </button>
            </div>
          </div>

          {showSilenceMenu && (
            <div className="mt-2 pt-2 border-t border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5">
                Silenzia notifiche
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => silence("2h")} className="px-2.5 py-1 rounded-md bg-bg-elevated border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition">
                  2 ore
                </button>
                <button onClick={() => silence("1d")} className="px-2.5 py-1 rounded-md bg-bg-elevated border border-border text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition">
                  1 giorno
                </button>
                <button onClick={() => silence("forever")} className="px-2.5 py-1 rounded-md bg-error/10 border border-error/30 text-[11px] font-semibold text-error hover:bg-error/20 transition">
                  Per sempre
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes nf-chatnotif-in-kf {
          from { opacity: 0; transform: translateY(-16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .nf-chatnotif-in { animation: nf-chatnotif-in-kf 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
    </div>
  );
}
