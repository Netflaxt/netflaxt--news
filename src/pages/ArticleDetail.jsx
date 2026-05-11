import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "articles", id));
        if (snap.exists()) {
          setArticle({ id: snap.id, ...snap.data() });
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error("Errore caricamento articolo:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (notFound || !article) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div
            className="text-8xl text-slate-200"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            404
          </div>
          <h1
            className="mt-2 text-3xl text-slate-900"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Articolo non trovato
          </h1>
          <p className="mt-3 text-slate-600">
            L'articolo che cerchi è stato rimosso o non è mai esistito.
          </p>
          <Link
            to="/news"
            className="inline-block mt-6 px-6 py-3 bg-slate-900 text-white font-semibold rounded-md hover:bg-sky-500 hover:text-slate-900 transition"
          >
            Torna alle news
          </Link>
        </div>
      </main>
    );
  }

  const dateStr =
    article.date?.toDate?.()?.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }) || "";

  // Render contenuto: se è HTML (da Quill) lo iniettiamo con prose; altrimenti plain text
  const isHtml = typeof article.content === "string" && /<[a-z][\s\S]*>/i.test(article.content);

  return (
    <main className="bg-white text-slate-900">
      {/* Hero image */}
      <section
        className={`relative h-[55vh] min-h-[400px] max-h-[600px] overflow-hidden bg-slate-900 transition-all duration-1000 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          src={
            article.imageUrl ||
            "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1600&q=80"
          }
          alt={article.title}
          className={`w-full h-full object-cover transition-transform duration-[2000ms] ${
            mounted ? "scale-100" : "scale-110"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-slate-900/20" />

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-10">
          <div
            className={`transition-all duration-1000 delay-300 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <button
              onClick={() => navigate(-1)}
              className="group inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-5 transition"
            >
              <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">
                ←
              </span>
              Indietro
            </button>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-2.5 py-1 bg-sky-400 text-slate-900 text-[11px] font-bold uppercase tracking-widest rounded">
                {article.category}
              </span>
              <span className="text-xs text-slate-300 uppercase tracking-wider">{dateStr}</span>
              {article.featured && (
                <span className="px-2.5 py-1 bg-white/10 backdrop-blur border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest rounded">
                  ★ In evidenza
                </span>
              )}
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-6xl text-white leading-[1.05] text-balance"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {article.title}
            </h1>
          </div>
        </div>
      </section>

      {/* Body */}
      <section
        className={`mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 transition-all duration-1000 delay-500 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Meta autore */}
        <div className="flex flex-wrap items-center gap-4 pb-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center text-white font-black text-sm ring-2 ring-white shadow">
              {(article.author || "NN").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Autore</div>
              <div className="text-sm font-bold text-slate-900">{article.author || "Redazione"}</div>
            </div>
          </div>
          {article.journalist && (
            <div className="pl-4 border-l border-slate-200">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Giornalista / Testata</div>
              <div className="text-sm font-semibold text-slate-700">{article.journalist}</div>
            </div>
          )}
        </div>

        {/* Excerpt (sommario) */}
        {article.excerpt && (
          <p className="mt-8 text-xl text-slate-700 leading-relaxed font-medium text-pretty border-l-2 border-sky-400 pl-5">
            {article.excerpt}
          </p>
        )}

        {/* Contenuto */}
        <div className="mt-8 text-slate-800 leading-relaxed text-lg">
          {article.content ? (
            isHtml ? (
              <div
                className="prose-article"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              article.content.split("\n").map((para, idx) =>
                para.trim() ? (
                  <p key={idx} className="mb-5 text-pretty">
                    {para}
                  </p>
                ) : null
              )
            )
          ) : (
            <p className="text-slate-500 italic">
              Contenuto in arrivo. L'articolo verrà aggiornato a breve.
            </p>
          )}
        </div>

        {/* Stili minimi inline per il contenuto Quill — solo via Tailwind classes su <style> non si può,
            quindi qui sotto inietto SOLO classi Tailwind via JSX dove possibile.
            Il contenuto Quill (h2, p, ul, strong) eredita comunque da Tailwind reset; resta leggibile. */}

        {/* Fonte */}
        {(article.source || article.sourceUrl) && (
          <div className="mt-12 p-5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[11px] uppercase tracking-[0.25em] font-bold text-sky-600 mb-2">
              Fonte
            </div>
            {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-slate-900 font-semibold hover:text-sky-600 transition"
              >
                {article.source || article.sourceUrl}
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  ↗
                </span>
              </a>
            ) : (
              <div className="text-slate-700 font-semibold">{article.source}</div>
            )}
          </div>
        )}

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link
            to="/news"
            className="group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 hover:text-sky-600 transition"
          >
            <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            Torna a tutte le news
          </Link>
        </div>
      </section>
    </main>
  );
}