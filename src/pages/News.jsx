import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { markVisited } from "../hooks/useNewArticlesBadge";
import { JOURNALIST_SOURCES } from "../utils/sources";
import BookmarkButton from "../components/BookmarkButton";

const PAGE_SIZE = 6;

/* Filtri data — opzioni preset */
const DATE_RANGES = [
  { key: "all", label: "Sempre" },
  { key: "7", label: "Ultimi 7 giorni" },
  { key: "30", label: "Ultimi 30 giorni" },
  { key: "90", label: "Ultimi 3 mesi" },
];

export default function News() {
  const categories = ["Tutto", "Calciomercato", "Serie A", "Esclusive Netflaxt", "Breaking News"];

  // Filtri base + avanzati
  const [active, setActive] = useState("Tutto");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    markVisited();
  }, []);

  useEffect(() => {
    // ✨ REAL-TIME: nuovi articoli pubblicati dall'admin appaiono
    // istantaneamente sulla pagina /news senza bisogno di refresh.
    const q = query(collection(db, "articles"), orderBy("date", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setArticles(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Errore listener articoli:", error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Reset paginazione quando cambia qualsiasi filtro
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [active, searchTerm, dateRange, authorFilter]);

  /* ✨ Fonti/giornalisti: preimpostate + eventuali personalizzate dagli articoli */
  const authors = useMemo(() => {
    const set = new Set(JOURNALIST_SOURCES);
    articles.forEach((a) => {
      if (a.journalist) set.add(a.journalist);
    });
    return ["all", ...Array.from(set)];
  }, [articles]);

  /* ✨ Applica tutti i filtri in cascata */
  const filtered = useMemo(() => {
    let list = articles;

    // 1. Categoria
    if (active !== "Tutto") {
      list = list.filter((a) => a.category === active);
    }

    // 2. Data range
    if (dateRange !== "all") {
      const days = Number(dateRange);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter((a) => {
        const t = a.date?.toDate?.()?.getTime?.() || 0;
        return t >= cutoff;
      });
    }

    // 3. Fonte / giornalista
    if (authorFilter !== "all") {
      list = list.filter((a) => a.journalist === authorFilter);
    }

    // 4. Ricerca testuale (titolo + excerpt + content stripped HTML)
    const s = searchTerm.trim().toLowerCase();
    if (s) {
      list = list.filter((a) => {
        const haystack = [
          a.title || "",
          a.excerpt || "",
          (a.content || "").replace(/<[^>]+>/g, " "),
          a.category || "",
          a.author || "",
          a.journalist || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(s);
      });
    }

    return list;
  }, [articles, active, dateRange, authorFilter, searchTerm]);

  const visibleArticles = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  /* Conteggi per categoria */
  const counts = useMemo(() => {
    const map = { Tutto: articles.length };
    categories.slice(1).forEach((c) => {
      map[c] = articles.filter((a) => a.category === c).length;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles]);

  const lastUpdate = useMemo(() => {
    if (!articles[0]?.date?.toDate) return null;
    return articles[0].date.toDate().toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [articles]);

  /* C'è almeno un filtro non-default? */
  const anyAdvancedActive =
    searchTerm.trim() !== "" || dateRange !== "all" || authorFilter !== "all";
  const anyFilterActive = anyAdvancedActive || active !== "Tutto";

  const resetAll = () => {
    setActive("Tutto");
    setSearchTerm("");
    setDateRange("all");
    setAuthorFilter("all");
  };

  return (
    <main className="bg-bg-base text-text-primary min-h-screen">
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <section className="relative border-b border-border-subtle overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/3 w-[600px] h-[400px] bg-accent/12 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-deep/8 rounded-full blur-[120px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 lg:pt-20 pb-14">
          <div
            className={`transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-secondary">
                Archivio
              </span>
            </div>

            <h1
              className="mt-6 text-6xl sm:text-7xl lg:text-8xl text-text-primary leading-[0.92]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.005em" }}
            >
              TUTTE LE <span className="text-gradient-accent">NEWS</span>
            </h1>

            <p className="mt-5 text-lg text-text-secondary max-w-2xl leading-relaxed text-pretty">
              Cronaca, analisi e approfondimenti dal mondo biancoceleste. Aggiornato ogni
              giorno dalla redazione.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="text-3xl text-text-primary"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {articles.length}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-text-muted leading-tight">
                  Articoli<br />pubblicati
                </span>
              </div>

              <div className="h-10 w-px bg-border" />

              {lastUpdate && (
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                      Ultimo aggiornamento
                    </div>
                    <div className="text-sm font-semibold text-text-primary">
                      {lastUpdate}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FILTRI STICKY ═══════════════════ */}
      <div className="sticky top-16 z-30 bg-bg-base/80 backdrop-blur-xl border-b border-border-subtle">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-3">
          {/* Riga 1: search + toggle filtri avanzati */}
          <div className="flex items-center gap-2">
            {/* Ricerca testuale */}
            <div className="relative flex-1 min-w-0">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca un articolo per titolo, contenuto, autore..."
                className="w-full pl-10 pr-9 py-2.5 bg-bg-surface/60 border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated transition flex items-center justify-center"
                  aria-label="Cancella ricerca"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Toggle filtri avanzati */}
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold border transition-all whitespace-nowrap ${
                advancedOpen || anyAdvancedActive
                  ? "bg-accent/10 border-accent/40 text-accent"
                  : "bg-bg-surface/50 border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="hidden sm:inline">Filtri</span>
              {anyAdvancedActive && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-text-inverse text-[10px] font-black">
                  {(searchTerm.trim() ? 1 : 0) +
                    (dateRange !== "all" ? 1 : 0) +
                    (authorFilter !== "all" ? 1 : 0)}
                </span>
              )}
            </button>

            {anyFilterActive && (
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md text-sm font-semibold bg-bg-surface/50 border border-border text-text-secondary hover:text-text-primary hover:border-border-strong transition whitespace-nowrap"
                title="Cancella tutti i filtri"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>

          {/* Riga 2: categorie */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((c) => {
              const isActive = active === c;
              const count = counts[c] ?? 0;
              return (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 border ${
                    isActive
                      ? "bg-accent/10 border-accent/40 text-accent shadow-[0_0_20px_-6px_rgba(56,189,248,0.5)]"
                      : "bg-bg-surface/50 border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
                  }`}
                >
                  <span>{c}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums transition-colors duration-300 ${
                      isActive
                        ? "bg-accent/20 text-accent"
                        : "bg-bg-elevated text-text-muted group-hover:bg-bg-base group-hover:text-text-secondary"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Riga 3: filtri avanzati (collapsible) */}
          {advancedOpen && (
            <div
              className="grid sm:grid-cols-2 gap-3 pt-2 advanced-filters-in"
              style={{ animation: "advanced-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              {/* Data range */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1.5">
                  Periodo
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DATE_RANGES.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setDateRange(d.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
                        dateRange === d.key
                          ? "bg-accent/15 border-accent/40 text-accent"
                          : "bg-bg-elevated border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Autore */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1.5">
                  Fonte / Giornalista
                </label>
                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-md text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition"
                >
                  {authors.map((a) => (
                    <option key={a} value={a}>
                      {a === "all" ? "Tutte le fonti" : a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ LISTA ARTICOLI ═══════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        {/* Conteggio risultati */}
        {!loading && anyFilterActive && (
          <div className="mb-6 text-sm text-text-secondary">
            <span className="text-text-primary font-bold tabular-nums">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "articolo trovato" : "articoli trovati"}
            {searchTerm && (
              <span className="text-text-muted">
                {" "}
                per <span className="text-accent font-semibold">"{searchTerm}"</span>
              </span>
            )}
          </div>
        )}

        {loading ? (
          /* Loading skeleton */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-bg-surface border border-border overflow-hidden"
              >
                <div
                  className="aspect-[16/10] bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface"
                  style={{
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s linear infinite",
                  }}
                />
                <div className="p-5 space-y-3">
                  <div
                    className="h-3 w-24 rounded bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface"
                    style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s linear infinite" }}
                  />
                  <div
                    className="h-5 w-full rounded bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface"
                    style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s linear infinite" }}
                  />
                  <div
                    className="h-5 w-3/4 rounded bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface"
                    style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s linear infinite" }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center text-center py-24">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/10 blur-2xl rounded-full" />
              <div className="relative w-20 h-20 rounded-2xl border border-border bg-bg-surface flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            <h3
              className="mt-6 text-3xl text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Nessun articolo trovato
            </h3>
            <p className="mt-2 text-text-secondary max-w-md">
              Prova ad allargare i filtri o a usare termini di ricerca diversi.
            </p>
            {anyFilterActive && (
              <button
                onClick={resetAll}
                className="mt-6 px-5 py-2.5 rounded-md border border-border hover:border-accent/40 hover:bg-accent/5 text-text-primary text-sm font-semibold transition-all duration-300"
              >
                Reset filtri
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {visibleArticles.map((a, i) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  mounted={mounted}
                  delay={i * 80}
                  searchTerm={searchTerm}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-12 flex flex-col items-center gap-3">
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="group relative px-7 py-3.5 rounded-md text-sm font-semibold text-text-primary bg-bg-surface border border-border hover:border-accent/50 hover:bg-accent/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_28px_-6px_rgba(56,189,248,0.4)]"
                >
                  <span className="inline-flex items-center gap-2">
                    Carica altri
                    <span className="text-accent">↓</span>
                  </span>
                </button>
                <div className="text-xs text-text-muted">
                  <span className="text-text-secondary font-semibold tabular-nums">
                    {visibleArticles.length}
                  </span>{" "}
                  di{" "}
                  <span className="text-text-secondary font-semibold tabular-nums">
                    {filtered.length}
                  </span>{" "}
                  articoli
                </div>
              </div>
            )}

            {!hasMore && filtered.length > PAGE_SIZE && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <span className="h-px w-16 bg-border" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-text-muted font-semibold">
                  Hai visto tutto
                </span>
                <span className="h-px w-16 bg-border" />
              </div>
            )}
          </>
        )}
      </section>

      <style>{`
        @keyframes advanced-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </main>
  );
}

/* ──────────────────────────────────────────────
   Card singola articolo — con highlight della ricerca
   ────────────────────────────────────────────── */
function ArticleCard({ article, mounted, delay, searchTerm }) {
  const dateStr = article.date?.toDate?.()?.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Highlight del termine di ricerca nel titolo (case-insensitive)
  const highlightTitle = (text) => {
    if (!searchTerm || !text) return text;
    const re = new RegExp(`(${escapeRegex(searchTerm.trim())})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) =>
      re.test(p) ? (
        <mark key={i} className="bg-accent/25 text-accent rounded px-0.5">
          {p}
        </mark>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      )
    );
  };

  return (
    /* WRAPPER: animazione d'entrata staggered, separata dall'hover
       così il delay non rende l'hover laggoso. */
    <div
      className={mounted ? "nf-card-in h-full" : "opacity-0 h-full"}
      style={{ animationDelay: `${delay}ms` }}
    >
    <Link
      to={`/news/${article.id}`}
      className="group relative isolate flex flex-col h-full rounded-xl bg-bg-surface border border-border hover:border-accent/40 overflow-hidden transform-gpu transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_32px_-8px_rgba(56,189,248,0.4)]"
    >
      <div
        className="relative aspect-[16/10] overflow-hidden bg-bg-surface"
        style={{
          // mask + transform GPU forza il compositing pulito del
          // border-radius del genitore: niente più subpixel "riga"
          // che lampeggia durante hover.
          maskImage: "linear-gradient(#000, #000)",
          WebkitMaskImage: "linear-gradient(#000, #000)",
          transform: "translateZ(0)",
        }}
      >
        <img
          src={
            article.imageUrl ||
            "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900&q=80"
          }
          alt={article.title}
          className="block w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-surface/80 via-transparent to-transparent" />

        <span className="absolute top-3 left-3 px-2 py-1 bg-bg-base/80 backdrop-blur-md border border-border text-[10px] font-bold uppercase tracking-[0.18em] text-text-primary rounded">
          {article.category || "News"}
        </span>

        {article.featured && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 bg-accent/90 backdrop-blur-md text-text-inverse text-[10px] font-bold uppercase tracking-[0.18em] rounded">
            ★ Top
          </span>
        )}
        {article.video?.url && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-bg-base/80 backdrop-blur-md border border-border text-text-primary text-[10px] font-bold uppercase tracking-[0.18em] rounded">
            ▶ Video
          </span>
        )}
        <div className="absolute bottom-3 right-3">
          <BookmarkButton article={article} variant="icon" />
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5 lg:p-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted mb-3">
          {dateStr}
        </div>

        <h3 className="text-lg lg:text-xl font-semibold text-text-primary group-hover:text-accent-hover transition-colors duration-300 leading-snug text-pretty">
          {highlightTitle(article.title)}
        </h3>

        {article.excerpt && (
          <p className="mt-3 text-sm text-text-secondary leading-relaxed line-clamp-3">
            {article.excerpt}
          </p>
        )}

        <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-xs border-t border-border-subtle">
          <div className="pt-4 flex items-center gap-1.5 min-w-0 text-text-muted">
            {article.journalist ? (
              <span className="truncate">
                via{" "}
                <span className="text-text-secondary font-medium">
                  {article.journalist}
                </span>
              </span>
            ) : (
              <>
                <img src="/logo.png" alt="" className="w-4 h-4 object-contain shrink-0" draggable="false" />
                <span className="text-text-secondary font-medium truncate">Netflaxt News</span>
              </>
            )}
          </div>
          <span className="pt-4 inline-flex items-center gap-1 text-accent font-bold uppercase tracking-[0.18em] text-[10px] opacity-70 group-hover:opacity-100 group-hover:gap-2 transition-all duration-300 shrink-0">
            Vedi dettagli <span>→</span>
          </span>
        </div>
      </div>
    </Link>
    </div>
  );
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
