/* ─────────────────────────────────────────────────────────────
   src/components/admin/AdminTabsBar.jsx
   Barra tab orizzontale scrollabile (drag con mouse + wheel +
   touch swipe) con gradient fade ai bordi che appaiono solo
   quando c'è scroll possibile in quella direzione.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useRef, useState } from "react";

export default function AdminTabsBar({ tabs, current, onChange }) {
  const scrollerRef = useRef(null);
  const dragState = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const [edges, setEdges] = useState({ left: false, right: false });

  /* Aggiorna i gradient di fade in base allo scroll */
  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges({ left, right });
  };

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, []);

  /* Quando cambia il tab attivo, scrolla per portarlo in vista */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const active = el.querySelector(`[data-tab-key="${current}"]`);
    if (!active) return;
    const r = active.getBoundingClientRect();
    const rs = el.getBoundingClientRect();
    if (r.left < rs.left + 8 || r.right > rs.right - 8) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [current]);

  /* DRAG to scroll con mouse */
  const onMouseDown = (e) => {
    // Ignora click destro o su elementi figli che fanno cose
    if (e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragState.current = {
      down: true,
      startX: e.pageX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };
  const onMouseMove = (e) => {
    if (!dragState.current.down) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.pageX - dragState.current.startX;
    if (Math.abs(dx) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startScroll - dx;
  };
  const endDrag = () => {
    dragState.current.down = false;
    const el = scrollerRef.current;
    if (el) {
      el.style.cursor = "";
      el.style.userSelect = "";
    }
  };
  /* Click sul tab: ignora se è stato fatto un drag */
  const handleTabClick = (key) => (e) => {
    if (dragState.current.moved) {
      e.preventDefault();
      dragState.current.moved = false;
      return;
    }
    onChange(key);
  };

  /* Conversione wheel verticale → scroll orizzontale (su trackpad / mouse) */
  const onWheel = (e) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Se il deltaY è significativamente maggiore del deltaX, converti
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  return (
    <div className="relative mb-8 border-b border-border-subtle pb-4">
      {/* Fade gradient sinistro */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-4 w-10 z-10 transition-opacity duration-300 ${
          edges.left ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "linear-gradient(to right, var(--color-bg-base, #05070D), transparent)",
        }}
      />
      {/* Fade gradient destro */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-4 w-10 z-10 transition-opacity duration-300 ${
          edges.right ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "linear-gradient(to left, var(--color-bg-base, #05070D), transparent)",
        }}
      />

      {/* Mini indicatore freccia destra che pulsa quando c'è altro da vedere */}
      {edges.right && (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 z-20 nf-tabs-arrow">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      <div
        ref={scrollerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onWheel={onWheel}
        className="flex gap-2 overflow-x-auto cursor-grab scrollbar-hide select-none"
        style={{ scrollSnapType: "x proximity" }}
      >
        {tabs.map((t) => {
          const Icon = t.Icon;
          const active = current === t.key;
          return (
            <button
              key={t.key}
              data-tab-key={t.key}
              onClick={handleTabClick(t.key)}
              draggable={false}
              className={`shrink-0 px-4 py-2.5 rounded-md text-sm font-bold transition-all duration-200 inline-flex items-center gap-2 ${
                active
                  ? "bg-accent text-text-inverse shadow-[0_0_20px_-4px_rgba(56,189,248,0.5)]"
                  : "bg-bg-surface border border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
              }`}
              style={{ scrollSnapAlign: "start" }}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes nf-tabs-arrow-kf {
          0%, 100% { transform: translate(0, -50%);   opacity: 0.7; }
          50%      { transform: translate(3px, -50%); opacity: 1; }
        }
        .nf-tabs-arrow { animation: nf-tabs-arrow-kf 1.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
