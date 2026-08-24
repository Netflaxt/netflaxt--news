/* ─────────────────────────────────────────────────────────────
   src/pages/ArticleDetail.jsx
   Redesign completo dark + share + tempo di lettura + tag + correlati.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import CategoryTag from "../components/CategoryTag";
import ReadingTime, { computeReadingTime } from "../components/ReadingTime";
import ShareButtons from "../components/ShareButtons";
import ArticleComments from "../components/ArticleComments";
import ArticleReactions from "../components/ArticleReactions";
import ArticleVideo from "../components/ArticleVideo";
import BookmarkButton from "../components/BookmarkButton";
import NotFound from "./NotFound";
import { setSEO, resetSEO } from "../utils/seo";
import { ripulisciTesto } from "../utils/testoArticolo";
import { SkeletonArticleDetail } from "../components/Skeleton";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1600&q=80";

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ── mount animation ──
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // ── fetch articolo + correlati ──
  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setMounted(false);
    requestAnimationFrame(() => setMounted(true));

    (async () => {
      try {
        const snap = await getDoc(doc(db, "articles", id));
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setArticle(data);

        // ✨ SEO dinamico per articolo
        setSEO({
          title: data.title,
          description: data.excerpt || data.title,
          image: data.imageUrl,
          type: "article",
          author: data.author || "Mattia",
          publishedTime: data.date?.toDate?.()?.toISOString?.(),
          category: data.category,
        });

        // Correlati: stessa categoria, esclusi l'attuale, max 3
        // (ordinamento in memoria per evitare un indice composito Firestore)
        try {
          const q = query(
            collection(db, "articles"),
            where("category", "==", data.category || ""),
            limit(12)
          );
          const rel = await getDocs(q);
          const toMillis = (v) =>
            v?.toMillis?.() ?? (v ? new Date(v).getTime() : 0);
          setRelated(
            rel.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((a) => a.id !== data.id)
              .sort((a, b) => toMillis(b.date) - toMillis(a.date))
              .slice(0, 3)
          );
        } catch (e) {
          console.warn("Correlati non disponibili:", e);
          setRelated([]);
        }
      } catch (e) {
        console.error("Errore caricamento articolo:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();

    window.scrollTo(0, 0);

    // Cleanup: ripristina SEO default quando esci dall'articolo
    return () => resetSEO();
  }, [id]);

  /* ─────────── Loading ─────────── */
  if (loading) {
    return (
      <main className="min-h-screen bg-bg-base">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-10 pb-16">
          <SkeletonArticleDetail />
        </div>
      </main>
    );
  }

  /* ─────────── Not found ─────────── */
  if (notFound || !article) {
    return <NotFound variant="article" />;
  }

  /* ─────────── Data + computazioni ─────────── */
  const dateStr =
    article.date?.toDate?.()?.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }) || "";

  const isHtml =
    typeof article.content === "string" && /<[a-z][\s\S]*>/i.test(article.content);

  const { words, minutes } = computeReadingTime(
    [article.excerpt, article.content].filter(Boolean).join(" ")
  );

  return (
    <main className="bg-bg-base text-text-primary">
      {/* ═══════════════════ HERO ═══════════════════ */}
      <section
        className={`relative h-[65vh] min-h-[460px] max-h-[680px] overflow-hidden bg-bg-surface transition-all duration-1000 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          src={article.imageUrl || FALLBACK_IMG}
          alt={article.title}
          className={`w-full h-full object-cover transition-transform duration-[2000ms] ${
            mounted ? "scale-100" : "scale-110"
          }`}
        />
        {/* Overlay scuro graduale */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/70 to-bg-base/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-base/60 via-transparent to-transparent" />

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-10 lg:pb-14">
          <div
            className={`transition-all duration-1000 delay-200 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {/* Back */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="group inline-flex items-center gap-2 px-3.5 py-2 mb-5 rounded-full bg-bg-base/60 hover:bg-bg-base/90 border border-border hover:border-accent/40 backdrop-blur text-text-secondary hover:text-text-primary text-sm font-semibold transition-all duration-200 ease-out cursor-pointer active:scale-95"
              aria-label="Torna indietro"
            >
              <span className="inline-block transform-gpu transition-transform duration-200 ease-out group-hover:-translate-x-1">
                ←
              </span>
              Indietro
            </button>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {article.category && <CategoryTag category={article.category} size="lg" />}
              {article.featured && (
                <span className="px-2.5 py-1 bg-white/5 backdrop-blur border border-white/10 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full">
                  ★ In evidenza
                </span>
              )}
              {dateStr && (
                <span className="text-[11px] uppercase tracking-[0.22em] text-text-muted font-semibold">
                  {dateStr}
                </span>
              )}
            </div>

            {/* Titolo */}
            <h1
              className="text-4xl sm:text-5xl lg:text-7xl text-text-primary leading-[0.95] text-balance"
              style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)", letterSpacing: "0.005em" }}
            >
              {article.title}
            </h1>
          </div>
        </div>
      </section>

      {/* ═══════════════════ BODY ═══════════════════ */}
      <section
        className={`mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-10 pb-16 transition-all duration-1000 delay-400 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Meta bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-7 border-b border-border-subtle">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-bg-elevated to-bg-surface ring-1 ring-accent/30 shadow-[0_0_20px_-4px_rgba(56,189,248,0.4)] flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src="/logo.png"
                  alt="Netflaxt News"
                  className="h-8 w-8 object-contain"
                  draggable="false"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-semibold">
                  Pubblicato da
                </div>
                <div
                  className="text-base text-text-primary leading-none mt-0.5"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
                >
                  NETFLAXT <span className="text-accent">NEWS</span>
                </div>
              </div>
            </div>
            {article.journalist && (
              <div className="pl-4 border-l border-border">
                <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-semibold">
                  Fonte
                </div>
                <div className="text-sm font-semibold text-text-secondary mt-0.5">
                  {article.journalist}
                </div>
              </div>
            )}
          </div>

          {minutes > 0 && (
            <ReadingTime words={words} minutes={minutes} />
          )}
        </div>

        {/* Excerpt */}
        {article.excerpt && (
          <div className="mt-8 relative pl-6 border-l-2 border-accent">
            <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_rgba(56,189,248,0.7)]" />
            <p className="text-lg lg:text-xl text-text-primary/90 leading-relaxed font-medium text-pretty">
              {article.excerpt}
            </p>
          </div>
        )}

        {/* Bookmark inline (top) — il blocco condividi è in fondo all'articolo */}
        <div className="mt-8 flex items-center gap-3">
          <BookmarkButton article={article} variant="inline" />
        </div>

        {/* Video dell'articolo (se presente) */}
        {article.video?.url && <ArticleVideo video={article.video} />}

        {/* Body content */}
        <div className="mt-10 text-text-secondary leading-[1.85] text-lg prose-article">
          {article.content ? (
            isHtml ? (
              <div
                className="prose-article-html"
                dangerouslySetInnerHTML={{ __html: ripulisciTesto(article.content) }}
              />
            ) : (
              ripulisciTesto(article.content)
                .split("\n")
                .map((para, idx) =>
                  para.trim() ? (
                    <p key={idx} className="mb-5 text-pretty">
                      {para}
                    </p>
                  ) : null
                )
            )
          ) : (
            <p className="text-text-muted italic">
              Contenuto in arrivo. L'articolo verrà aggiornato a breve.
            </p>
          )}
        </div>

        {/* Tags */}
        {Array.isArray(article.tags) && article.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border-subtle">
            <div className="text-[10px] uppercase tracking-[0.3em] text-text-muted font-semibold mb-3">
              Tag
            </div>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1.5 rounded-full bg-bg-surface border border-border hover:border-accent/40 text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-all"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Seconda foto — chiude l'articolo, prima della fonte.

            Proporzioni libere: a differenza della copertina non deve
            stare in un formato fisso, quindi si adatta all'immagine
            invece di ritagliarla. `loading="lazy"` perché sta in fondo:
            si scarica solo quando il lettore ci arriva davvero. */}
        {article.imageUrl2 && (
          <figure className="mt-10">
            <img
              src={article.imageUrl2}
              alt={article.title ? `Immagine dell'articolo: ${article.title}` : "Immagine dell'articolo"}
              loading="lazy"
              className="w-full h-auto rounded-lg border border-border bg-bg-surface"
            />
          </figure>
        )}

        {/* Fonte */}
        {(article.source || article.sourceUrl) && (
          <div className="mt-8 p-5 rounded-lg bg-bg-surface border border-border">
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-2">
              Fonte
            </div>
            {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                /* `break-all` e `min-w-0` servono perché qui finisce un
                   indirizzo web: non avendo spazi non si spezza da solo
                   e spinge la freccia fuori dallo schermo, allargando
                   l'intera pagina (visto su telefono il 24/08/2026 con
                   un link lungo di sslazio.it). */
                className="group inline-flex items-start gap-2 text-text-primary font-semibold hover:text-accent transition max-w-full min-w-0 break-all"
              >
                {article.source || article.sourceUrl}
                <span className="inline-block shrink-0 transition-transform group-hover:translate-x-1">
                  ↗
                </span>
              </a>
            ) : (
              <div className="text-text-primary font-semibold">{article.source}</div>
            )}
          </div>
        )}

        {/* ═══════════════════ REAZIONI ═══════════════════ */}
        <ArticleReactions articleId={article.id} />

        {/* Share bar bottom (call to action) */}
        <div className="mt-12 p-6 rounded-xl bg-gradient-to-br from-bg-surface to-bg-base border border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div
                className="text-3xl text-text-primary leading-none"
                style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)" }}
              >
                CONDIVIDI
              </div>
              <div className="mt-1 text-xs text-text-secondary">
                Fai girare la notizia sulla curva
              </div>
            </div>
            <ShareButtons title={article.title} />
          </div>
        </div>

        {/* Back to news */}
        <div className="mt-12 pt-8 border-t border-border-subtle">
          <Link
            to="/news"
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border hover:border-accent/40 hover:bg-accent/5 text-sm font-bold uppercase tracking-wider text-text-secondary hover:text-accent transition-all duration-200 ease-out active:scale-95"
          >
            <span className="inline-block transform-gpu transition-transform duration-200 ease-out group-hover:-translate-x-1">
              ←
            </span>
            Torna a tutte le news
          </Link>
        </div>
      </section>

      {/* ═══════════════════ COMMENTI ═══════════════════ */}
      <ArticleComments articleId={article.id} />

      {/* ═══════════════════ ARTICOLI CORRELATI ═══════════════════ */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-1.5">
                Continua a leggere
              </div>
              <h2
                className="text-4xl text-text-primary leading-none"
                style={{ fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)" }}
              >
                ARTICOLI CORRELATI
              </h2>
            </div>
            <Link
              to="/news"
              className="text-xs uppercase tracking-[0.2em] font-bold text-text-secondary hover:text-text-primary transition"
            >
              Tutte le news →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {related.map((a) => {
              const rd = a.date?.toDate?.()?.toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              return (
                <Link
                  key={a.id}
                  to={`/news/${a.id}`}
                  className="group rounded-xl bg-bg-surface border border-border hover:border-accent/40 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_0_32px_-8px_rgba(56,189,248,0.4)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-bg-elevated">
                    <img
                      src={a.imageUrl || FALLBACK_IMG}
                      loading="lazy"
                      alt={a.title}
                      loading="lazy"
                      className="w-full h-full object-cover transform-gpu will-change-transform transition-transform duration-500 ease-out group-hover:scale-[1.04] [backface-visibility:hidden] [transform-style:preserve-3d]"
                    />
                    <span className="absolute top-3 left-3">
                      {a.category && <CategoryTag category={a.category} />}
                    </span>
                  </div>
                  <div className="p-5">
                    {rd && (
                      <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted mb-2">
                        {rd}
                      </div>
                    )}
                    <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-hover leading-snug text-pretty">
                      {a.title}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
