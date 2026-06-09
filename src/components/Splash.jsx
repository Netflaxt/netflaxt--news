/* ─────────────────────────────────────────────────────────────
   src/components/Splash.jsx
   Schermata di caricamento mostrata durante l'auth check.
   Sostituisce lo schermo nero attuale.

   USO:
     in AuthContext.jsx, sostituire:
       {!loading && children}
     con:
       {loading ? <Splash /> : children}
   ───────────────────────────────────────────────────────────── */
import React from "react";

export default function Splash({ message = "Caricamento" }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-base text-text-primary overflow-hidden">
      {/* Radial glow background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(14,165,233,0.05), transparent 60%)",
        }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(56,189,248,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* Logo aquila con glow + halo rotante */}
        <div className="relative splash-pulse">
          {/* Soft glow dietro il logo */}
          <div className="absolute inset-0 bg-accent rounded-full blur-3xl opacity-40 scale-110" />
          {/* Halo cyan rotante */}
          <div className="absolute -inset-3 rounded-full splash-halo" aria-hidden />
          {/* Logo */}
          <img
            src="/logo.png"
            alt="Netflaxt News"
            width="160"
            height="160"
            className="relative h-40 w-40 rounded-full object-cover ring-2 ring-accent/30 shadow-[0_0_48px_-4px_rgba(56,189,248,0.5)]"
            draggable="false"
          />
        </div>

        {/* Tagline */}
        <div className="mt-7 text-[10px] uppercase tracking-[0.5em] text-text-secondary">
          News · Curva · Comunità
        </div>

        {/* Spinner */}
        <div className="mt-10 flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <div className="text-[11px] uppercase tracking-[0.3em] text-text-muted">
            {message}
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 inset-x-0 text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-text-muted">
          dal 2025 · Roma
        </div>
      </div>

      {/* Animazione locale (in index.css c'è già animate-spin di Tailwind; questa è la pulse) */}
      <style>{`
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: .96; }
          50% { transform: scale(1.035); opacity: 1; }
        }
        .splash-pulse { animation: splash-pulse 2.2s ease-in-out infinite; }

        @keyframes splash-halo {
          to { transform: rotate(360deg); }
        }
        .splash-halo {
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(56,189,248,0.55) 60deg,
            transparent 120deg,
            transparent 240deg,
            rgba(125,211,252,0.35) 300deg,
            transparent 360deg
          );
          -webkit-mask: radial-gradient(circle, transparent 56%, #000 58%, #000 62%, transparent 64%);
                  mask: radial-gradient(circle, transparent 56%, #000 58%, #000 62%, transparent 64%);
          animation: splash-halo 4s linear infinite;
        }
      `}</style>
    </div>
  );
}
