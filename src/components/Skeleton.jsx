/* ─────────────────────────────────────────────────────────────
   src/components/Skeleton.jsx
   Placeholder grigi animati (shimmer) per stati di caricamento.
   Variants: line, circle, image, card-article, card-match.
   ───────────────────────────────────────────────────────────── */
import React from "react";

function Box({ className = "", style }) {
  return (
    <span
      className={`block relative overflow-hidden bg-bg-elevated ${className}`}
      style={style}
      aria-hidden="true"
    >
      <span className="absolute inset-0 nf-skeleton-shimmer" />
    </span>
  );
}

export function SkeletonLine({ width = "100%", className = "" }) {
  return (
    <Box
      className={`h-3 rounded ${className}`}
      style={{ width }}
    />
  );
}

export function SkeletonCircle({ size = 40, className = "" }) {
  return (
    <Box
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonImage({ aspect = "16/10", className = "" }) {
  return (
    <Box
      className={`w-full rounded-lg ${className}`}
      style={{ aspectRatio: aspect }}
    />
  );
}

/* Card articolo (Home + News) */
export function SkeletonArticleCard() {
  return (
    <div className="flex flex-col rounded-xl bg-bg-surface border border-border overflow-hidden">
      <SkeletonImage aspect="16/10" className="!rounded-none" />
      <div className="p-5 space-y-3">
        <SkeletonLine width="30%" />
        <SkeletonLine width="90%" className="h-5" />
        <SkeletonLine width="70%" className="h-5" />
        <div className="pt-4 border-t border-border-subtle mt-3">
          <SkeletonLine width="40%" />
        </div>
      </div>
    </div>
  );
}

/* Card partita (Calendario) */
export function SkeletonMatchCard() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-bg-surface border border-border p-5">
      <div className="flex items-center gap-3 flex-1">
        <SkeletonCircle size={36} />
        <SkeletonLine width="80px" className="h-4" />
      </div>
      <SkeletonLine width="60px" className="h-6" />
      <div className="flex items-center gap-3 flex-1 justify-end">
        <SkeletonLine width="80px" className="h-4" />
        <SkeletonCircle size={36} />
      </div>
    </div>
  );
}

/* Articolo dettaglio */
export function SkeletonArticleDetail() {
  return (
    <div className="space-y-6">
      <SkeletonImage aspect="16/8" className="rounded-2xl" />
      <div className="space-y-3">
        <SkeletonLine width="30%" />
        <SkeletonLine width="95%" className="h-8" />
        <SkeletonLine width="80%" className="h-8" />
      </div>
      <div className="space-y-2 pt-4">
        <SkeletonLine width="100%" />
        <SkeletonLine width="98%" />
        <SkeletonLine width="92%" />
        <SkeletonLine width="100%" />
        <SkeletonLine width="85%" />
      </div>
    </div>
  );
}

/* Riga lista (utenti, commenti) */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-bg-surface border border-border">
      <SkeletonCircle size={40} />
      <div className="flex-1 space-y-2">
        <SkeletonLine width="40%" />
        <SkeletonLine width="80%" className="h-2.5" />
      </div>
    </div>
  );
}

/* CSS shimmer iniettato una sola volta */
let _injected = false;
function injectShimmerStyles() {
  if (_injected || typeof document === "undefined") return;
  _injected = true;
  const style = document.createElement("style");
  style.setAttribute("data-nf-skeleton", "");
  style.textContent = `
    @keyframes nf-skeleton-shimmer-kf {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .nf-skeleton-shimmer {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.06) 45%,
        rgba(255, 255, 255, 0.10) 50%,
        rgba(255, 255, 255, 0.06) 55%,
        transparent 100%
      );
      animation: nf-skeleton-shimmer-kf 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .nf-skeleton-shimmer { animation: none; }
    }
  `;
  document.head.appendChild(style);
}
injectShimmerStyles();

export default Box;
