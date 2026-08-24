/* ─────────────────────────────────────────────────────────────
   src/pages/NotFound.jsx
   Pagina 404 personalizzata in dark theme.

   USO:
     in App.jsx aggiungere come ULTIMA route (catch-all):
       <Route path="*" element={<NotFound />} />
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { setSEO, resetSEO } from "../utils/seo";
import { Link, useLocation } from "react-router-dom";

export default function NotFound({ variant = "page" }) {
  // variant: 'page' (default — rotta generica) | 'article' (articolo eliminato)
  const isArticle = variant === "article";
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  /* Una pagina inesistente non deve presentarsi ai motori di ricerca
     con il titolo del sito, altrimenti finisce indicizzata come se
     fosse una pagina vera. */
  useEffect(() => {
    setSEO({
      title: isArticle ? "Articolo non disponibile" : "Pagina non trovata",
      description: "La pagina che cercavi non esiste o è stata spostata.",
      type: "website",
    });
    return () => resetSEO();
  }, [isArticle]);

  return (
    <main className="relative min-h-screen bg-bg-base text-text-primary flex items-center justify-center px-6 overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 -z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-error/5 rounded-full blur-[120px]" />
      </div>

      <div
        className={`relative z-10 text-center max-w-2xl transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* 404 con effetto glitch */}
        <div className="relative inline-block">
          <div
            className="leading-none text-[180px] sm:text-[240px] bg-gradient-to-b from-text-primary via-accent-hover to-accent bg-clip-text text-transparent"
            style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)", letterSpacing: "0.01em" }}
          >
            404
          </div>
          <div
            className="absolute inset-0 leading-none text-[180px] sm:text-[240px] text-error/20 -translate-x-1 -translate-y-0.5 select-none pointer-events-none"
            style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)", letterSpacing: "0.01em" }}
            aria-hidden
          >
            404
          </div>
        </div>

        <h1
          className="mt-2 text-5xl sm:text-6xl text-text-primary leading-none"
          style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)" }}
        >
          {isArticle ? "Articolo non trovato" : "Pagina fuori curva"}
        </h1>

        <p className="mt-5 text-text-secondary text-lg max-w-md mx-auto leading-relaxed text-pretty">
          {isArticle
            ? "L'articolo che cerchi è stato rimosso, archiviato o non è mai esistito. Capita anche ai migliori."
            : "Questa pagina non esiste. Probabilmente un link vecchio o un errore di battitura."}
        </p>

        {/* URL non trovato (debug-friendly) */}
        {!isArticle && location?.pathname && (
          <div className="mt-4 inline-block px-3 py-1.5 rounded-md bg-bg-surface border border-border">
            <code className="text-xs text-text-muted font-mono">{location.pathname}</code>
          </div>
        )}

        {/* CTA principali */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 px-5 py-3 rounded-md bg-accent text-text-inverse text-sm font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 hover:shadow-[0_0_28px_-6px_rgba(56,189,248,0.6)]"
          >
            <span className="inline-block transition-transform group-hover:-translate-x-1">←</span>
            Torna alla home
          </Link>
          <Link
            to="/news"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-bg-surface border border-border hover:border-accent/40 text-text-primary text-sm font-semibold uppercase tracking-wider transition-all"
          >
            {isArticle ? "Vedi tutte le news" : "Vai alle news"}
          </Link>
        </div>

        {/* Quick links a categorie */}
        <div className="mt-12">
          <div className="text-[10px] uppercase tracking-[0.3em] text-text-muted mb-4 font-semibold">
            O salta a una sezione
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: "Chat Curva", to: "/chat" },
              { label: "Chi sono", to: "/about" },
            ].map((t) => (
              <Link
                key={t.label}
                to={t.to}
                className="px-3 py-1.5 rounded-full bg-bg-surface border border-border hover:border-accent/40 text-xs font-medium text-text-secondary hover:text-text-primary transition-all"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
