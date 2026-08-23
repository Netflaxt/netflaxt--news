/* ─────────────────────────────────────────────────────────────
   src/components/BadgeWatcher.jsx
   Watcher GLOBALE dei badge: montato in App, attivo su tutte le
   pagine. Quando l'utente sblocca un nuovo badge (ovunque: chat,
   commenti, pronostici…) mostra un popup celebrativo + campanella.

   Funzionamento:
   1. Ascolta in real-time il doc users/{uid} (chatCount, commentCount,
      reactionsCount, quizPoints, username, firstName…).
   2. Ad ogni cambiamento RILEVANTE ricalcola i badge sbloccati
      (collectUserStats + streak).
   3. Confronta col set "già visto" salvato in localStorage:
      - badge NUOVI → toast + suono
      - badge SPARITI (dati azzerati dall'admin) → aggiorna il set,
        così il badge è di nuovo "bloccato" e ri-notificabile in futuro.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import {
  getBadgeById,
  collectUserStats,
  computeUnlockedBadges,
} from "../utils/badges";
import { computePredictionStreak } from "../utils/predictions";
import { playBell } from "../utils/soundDesign";

const SEEN_KEY = (uid) => `netflaxt:seenBadges:${uid}`;

function loadSeen(uid) {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || "[]");
  } catch {
    return [];
  }
}
function saveSeen(uid, ids) {
  try {
    localStorage.setItem(SEEN_KEY(uid), JSON.stringify(ids));
  } catch {}
}

export default function BadgeWatcher() {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);
  // Per evitare ricalcoli inutili: hash dei campi rilevanti
  const prevSigRef = useRef(null);
  const firstRunRef = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) {
      prevSigRef.current = null;
      firstRunRef.current = true;
      return;
    }
    const uid = user.uid;
    firstRunRef.current = true;

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, async (snap) => {
      const d = snap.exists() ? snap.data() : {};
      // Firma dei soli campi che possono cambiare i badge
      const sig = [
        d.chatCount || 0,
        d.commentCount || 0,
        d.reactionsCount || 0,
        d.quizPoints || 0,
        d.username || "",
        d.firstName || "",
        d.photoURL || "",
      ].join("|");

      // Salta se nulla di rilevante è cambiato (es. solo lastSeenAt)
      if (sig === prevSigRef.current) return;
      prevSigRef.current = sig;

      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const [s, sk] = await Promise.all([
          collectUserStats(uid),
          computePredictionStreak(uid),
        ]);
        const ctx = {
          user,
          profile: {
            username: s.username,
            firstName: s.firstName,
            photoURL: user.photoURL || s.photoURL,
          },
          predictionCount: s.predictionCount,
          exactCount: s.exactCount,
          bookmarksCount: s.bookmarksCount,
          commentCount: s.commentCount,
          chatCount: s.chatCount,
          reactionsCount: s.reactionsCount,
          bestStreak: sk.best,
        };
        const unlocked = computeUnlockedBadges(ctx);
        const seen = loadSeen(uid);
        const seenSet = new Set(seen);
        const newly = unlocked.filter((id) => !seenSet.has(id));

        // Aggiorna SEMPRE il set salvato allo stato corrente.
        // Così se un badge sparisce (dati azzerati) viene rimosso dal
        // set → è di nuovo "bloccato" e potrà ri-notificare in futuro.
        saveSeen(uid, unlocked);

        // Al PRIMO calcolo (apertura app) NON notifichiamo i badge già
        // posseduti — solo i futuri sblocchi. Eccezione: se non c'era
        // alcun set salvato (utente nuovo) e sblocca qualcosa subito,
        // mostriamo comunque (founder) — ma per evitare spam, saltiamo
        // il primo run sempre.
        const isFirst = firstRunRef.current;
        firstRunRef.current = false;
        if (isFirst) return;

        if (newly.length > 0) {
          const badge = getBadgeById(newly[0]);
          if (badge) {
            setToast({ badge, extra: newly.length - 1 });
            try {
              playBell();
            } catch {}
            setTimeout(() => setToast(null), 6000);
          }
        }
      } catch (e) {
        console.warn("BadgeWatcher recompute error:", e);
      } finally {
        busyRef.current = false;
      }
    });

    return () => unsub();
  }, [user?.uid]);

  if (!toast) return null;

  return (
    <div
      data-no-twemoji
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[96] px-2 max-w-[92vw] sm:max-w-sm nf-badgew-in"
      role="status"
    >
      <div className="relative rounded-2xl bg-bg-surface border border-accent/50 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7),0_0_40px_-10px_rgba(56,189,248,0.5)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-accent-hover to-accent" />
        <div className="p-4 flex items-center gap-3">
          <div
            className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${
              toast.badge.color || "from-accent to-accent-deep"
            } flex items-center justify-center text-2xl shadow-lg nf-badgew-pop`}
          >
            {toast.badge.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-black">
              Badge sbloccato!
            </div>
            <div className="text-sm font-bold text-text-primary leading-tight truncate">
              {toast.badge.title}
            </div>
            <div className="text-[11px] text-text-muted truncate">
              {toast.extra > 0
                ? `e altri ${toast.extra} badge!`
                : toast.badge.description}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
      </div>
      <style>{`
        @keyframes nf-badgew-in-kf {
          from { opacity: 0; transform: translate(-50%, 30px) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .nf-badgew-in { animation: nf-badgew-in-kf 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes nf-badgew-pop-kf {
          0% { transform: scale(0.5) rotate(-12deg); }
          60% { transform: scale(1.15) rotate(6deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .nf-badgew-pop { animation: nf-badgew-pop-kf 0.6s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
    </div>
  );
}
