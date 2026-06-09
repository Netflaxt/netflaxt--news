/* ─────────────────────────────────────────────────────────────
   src/components/BadgeChip.jsx
   Visualizza un badge con emoji, titolo, tooltip.
   Modalità: 'unlocked' (default) o 'locked' (grigio).
   ───────────────────────────────────────────────────────────── */
import React from "react";

export default function BadgeChip({ badge, locked = false, size = "md" }) {
  if (!badge) return null;
  const small = size === "sm";
  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 ${
        locked
          ? "border-border bg-bg-elevated/40 opacity-60"
          : "border-border bg-bg-surface hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_0_22px_-6px_rgba(56,189,248,0.5)]"
      } ${small ? "p-3" : "p-4"}`}
      title={`${badge.title} — ${badge.description}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 rounded-xl flex items-center justify-center text-2xl shadow-inner ${
            small ? "w-10 h-10" : "w-12 h-12"
          } ${
            locked
              ? "bg-bg-base text-text-muted grayscale"
              : `bg-gradient-to-br ${badge.color} text-white`
          }`}
        >
          {badge.emoji}
        </div>
        <div className="min-w-0">
          <div
            className={`font-black text-text-primary leading-tight truncate ${
              small ? "text-sm" : "text-base"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {badge.title}
          </div>
          <div className="text-[10px] text-text-muted leading-snug line-clamp-2">
            {badge.description}
          </div>
        </div>
      </div>
      {locked && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-text-muted font-bold">
          🔒
        </div>
      )}
    </div>
  );
}

/* Streak fire badge (riusabile, mostra fiamma + numero) */
export function StreakFire({ current, best, compact = false }) {
  if (!current && !best) return null;
  const showCurrent = (current || 0) > 0;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/15 text-orange-300 ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      } font-black tabular-nums shadow-[0_0_18px_-6px_rgba(249,115,22,0.7)]`}
      title={
        showCurrent
          ? `${current} azzeccati di fila — record: ${best}`
          : `Miglior streak: ${best}`
      }
    >
      <FireIcon />
      {showCurrent ? current : best}
      {!compact && (
        <span className="text-[9px] uppercase tracking-wider opacity-80">
          {showCurrent ? "Streak" : "Record"}
        </span>
      )}
    </div>
  );
}

function FireIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 C 13 6, 17 7, 17 12 C 17 15.3, 14.5 18, 12 18 C 9.5 18, 7 15.3, 7 12 C 7 9, 9 8, 9 5 C 10 7, 12 6, 12 2 Z" />
    </svg>
  );
}
