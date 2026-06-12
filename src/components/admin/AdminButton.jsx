/* ─────────────────────────────────────────────────────────────
   src/components/admin/AdminButton.jsx
   Bottone riutilizzabile per il pannello admin (e non solo).
   Varianti: accent (azione principale), save (conferma/salva),
   danger (elimina), ghost (annulla/secondario).
   - icona opzionale (check, x, trash, plus)
   - riflesso "shimmer" sulle varianti piene
   - micro-feedback: leggero sollevamento all'hover, schiacciamento al click
   Tutto già coperto da prefers-reduced-motion (CSS globale).
   ───────────────────────────────────────────────────────────── */
import React from "react";

const ICONS = {
  check: "M4.5 12.75l6 6 9-13.5",
  x: "M6 18L18 6M6 6l12 12",
  trash:
    "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  plus: "M12 4.5v15m7.5-7.5h-15",
};

const VARIANTS = {
  accent: {
    cls: "bg-accent text-text-inverse hover:shadow-[0_8px_28px_-8px_rgba(56,189,248,0.75)]",
    shimmer: true,
  },
  save: {
    cls: "bg-success text-white hover:shadow-[0_8px_28px_-8px_rgba(16,185,129,0.7)]",
    shimmer: true,
  },
  danger: {
    cls: "bg-error text-white hover:shadow-[0_8px_28px_-8px_rgba(244,63,94,0.65)]",
    shimmer: true,
  },
  ghost: {
    cls: "bg-bg-elevated text-text-secondary border border-border hover:text-text-primary hover:border-border-strong",
    shimmer: false,
  },
};

export default function AdminButton({
  variant = "accent",
  icon,
  children,
  className = "",
  type = "button",
  ...props
}) {
  const v = VARIANTS[variant] || VARIANTS.accent;
  return (
    <button
      type={type}
      {...props}
      className={`${v.shimmer ? "nf-shimmer " : ""}group inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${v.cls} ${className}`}
    >
      {icon && ICONS[icon] && (
        <svg
          className="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={ICONS[icon]} />
        </svg>
      )}
      {children}
    </button>
  );
}
