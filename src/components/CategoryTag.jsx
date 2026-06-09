/* ─────────────────────────────────────────────────────────────
   src/components/CategoryTag.jsx
   Tag colorato per categoria. Riusabile su card, hero, filtri.
   ───────────────────────────────────────────────────────────── */
import React from "react";

const CATEGORY_STYLES = {
  "Breaking News":      { c: "#EF4444", bg: "rgba(239,68,68,0.14)",   border: "rgba(239,68,68,0.40)" },
  "Calciomercato":      { c: "#F472B6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.35)" },
  "Serie A":            { c: "#10B981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)" },
  "Esclusive Netflaxt": { c: "#FBBF24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)" },
  "Tattica":            { c: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)" },
  "Cronaca":            { c: "#38BDF8", bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.35)" },
  "Curva":              { c: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.35)" },
};

const DEFAULT_STYLE = CATEGORY_STYLES["Cronaca"];

/**
 * Restituisce lo stile (colore/bg/border) per una categoria.
 * Esportato per usarlo anche fuori dal componente (es. background hero).
 */
export function getCategoryStyle(category) {
  return CATEGORY_STYLES[category] || DEFAULT_STYLE;
}

export default function CategoryTag({ category, size = "sm", className = "" }) {
  const s = getCategoryStyle(category);
  const px = size === "lg" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.18em] border ${px} ${className}`}
      style={{ color: s.c, backgroundColor: s.bg, borderColor: s.border }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: s.c, boxShadow: `0 0 8px ${s.c}` }}
      />
      {category || "News"}
    </span>
  );
}
