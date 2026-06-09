/* ─────────────────────────────────────────────────────────────
   src/components/SoundToggleCard.jsx
   Toggle per attivare/disattivare i mini suoni discreti.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  onSoundEnabledChange,
  playClick,
  playSave,
  playReact,
  playBell,
} from "../utils/soundDesign";

export default function SoundToggleCard() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    return onSoundEnabledChange((e) => setEnabled(!!e.detail?.enabled));
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) {
      // Suono di conferma all'attivazione
      setTimeout(() => playBell(), 50);
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
            Audio
          </div>
          <h2
            className="text-2xl text-text-primary mt-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Mini suoni
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-md">
            Piccoli effetti sonori discreti su salvataggi, reazioni e
            notifiche. Volume basso, disattivabili in qualunque momento.
          </p>
        </div>
        <button
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? "Disattiva suoni" : "Attiva suoni"}
          className={`relative w-14 h-8 rounded-full border transition-all duration-300 ${
            enabled
              ? "bg-accent border-accent shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)]"
              : "bg-bg-elevated border-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full transition-transform duration-300 ${
              enabled ? "translate-x-6 bg-text-inverse" : "bg-text-secondary"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="pt-4 border-t border-border-subtle">
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-3">
            Prova i suoni
          </div>
          <div className="flex flex-wrap gap-2">
            <PreviewBtn label="Click" onClick={playClick} />
            <PreviewBtn label="Salva" onClick={playSave} />
            <PreviewBtn label="Reazione" onClick={playReact} />
            <PreviewBtn label="Notifica" onClick={playBell} />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewBtn({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 text-xs font-semibold transition"
    >
      ▶ {label}
    </button>
  );
}
