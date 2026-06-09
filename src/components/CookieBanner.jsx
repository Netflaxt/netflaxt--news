/* ─────────────────────────────────────────────────────────────
   src/components/CookieBanner.jsx
   Banner di consenso cookie GDPR.
   Mostrato fino a quando l'utente non clicca "Accetta" o "Rifiuta".
   La scelta viene salvata in localStorage.

   USO: mount in App.jsx (qualunque posizione, è position:fixed)
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const LS_KEY = "netflaxt:cookieConsent";
// Versione: cambiala se aggiorni la policy → utenti vedono di nuovo il banner
const POLICY_VERSION = "1";

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== POLICY_VERSION) return null;
    return data.choice; // "accepted" | "rejected"
  } catch {
    return null;
  }
}

function saveConsent(choice) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        choice,
        version: POLICY_VERSION,
        ts: Date.now(),
      })
    );
    window.dispatchEvent(new CustomEvent("netflaxt:cookie-consent-changed"));
  } catch {}
}

export default function CookieBanner() {
  const [choice, setChoice] = useState(getCookieConsent());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mostra solo dopo un breve delay (evita lampo iniziale)
    const t = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (choice) return null;
  if (!mounted) return null;

  const handle = (newChoice) => {
    saveConsent(newChoice);
    setChoice(newChoice);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 z-[80] cookie-banner-in">
      <div className="mx-auto max-w-3xl p-5 rounded-2xl bg-bg-surface border border-border shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-4">
          {/* Icona cookie */}
          <div className="shrink-0 w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2a10 10 0 100 20 10 10 0 000-20zM8 9h.01M16 14h.01M11 13h.01M14 7h.01M9 16h.01"
              />
            </svg>
          </div>

          {/* Testo */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-text-primary mb-1">
              🍪 Privacy & cookie
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Usiamo cookie tecnici essenziali per far funzionare il sito (login,
              chat). Con il tuo consenso, anche cookie analitici anonimi per
              capire come migliorarlo.{" "}
              <Link
                to="/privacy"
                className="text-accent hover:underline font-semibold"
              >
                Privacy policy →
              </Link>
            </p>

            {/* Azioni */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handle("accepted")}
                className="px-4 py-2 bg-accent text-text-inverse font-bold text-xs rounded-md uppercase tracking-wider hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)] transition"
              >
                Accetta tutti
              </button>
              <button
                onClick={() => handle("rejected")}
                className="px-4 py-2 bg-bg-elevated border border-border text-text-secondary hover:text-text-primary font-bold text-xs rounded-md uppercase tracking-wider transition"
              >
                Solo essenziali
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cookie-banner-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cookie-banner-in { animation: cookie-banner-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
