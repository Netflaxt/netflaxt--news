import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default function News() {
  const categories = ["Tutto", "Calciomercato", "Serie A", "Coppa Italia", "Europa", "Editoriali"];
  const [active, setActive] = useState("Tutto");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const q = query(collection(db, "articles"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        setArticles(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Errore caricamento articoli:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const filtered =
    active === "Tutto" ? articles : articles.filter((a) => a.category === active);

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* Header */}
      <section className="relative border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/50 overflow-hidden">
        <div className="absolute -top-32 -right-20 w-[400px] h-[400px] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div
            className={`transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
              Archivio
            </div>
            <h1
              className="mt-2 text-5xl sm:text-6xl text-slate-900 leading-none"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Tutte le <span className="text-sky-500">News</span>
            </h1>
            <p className="mt-3 text-slate-600 max-w-2xl text-pretty">
              Cronaca, analisi e approfondimenti. Aggiornato ogni giorno dalla redazione Netflaxt.
            </p>
          </div>
        </div>
      </section>

      {/* Filtri */}
      <div className="sticky top-16 z-20 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`relative px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 border ${
                active === c
                  ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20"
                  : "bg-white text-slate-700 border-slate-200 hover:border-sky-400 hover:text-sky-600 hover:-translate-y-0.5"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Lista articoli */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Nessun articolo trovato in questa categoria.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((a, i) => (
              <article
                key={a.id}
                className={`group flex flex-col transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Link to={`/news/${a.id}`} className="block">
                  <div className="relative overflow-hidden rounded-lg aspect-[4/3] mb-4 ring-1 ring-slate-200">
                    <img
                      src={
                        a.imageUrl ||
                        "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80"
                      }
                      alt={a.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="absolute top-3 left-3 px-2 py-1 bg-sky-400 text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded">
                      {a.category}
                    </span>
                    {a.featured && (
                      <span className="absolute top-3 right-3 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded">
                        ★ Top
                      </span>
                    )}
                  </div>
                </Link>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {a.date?.toDate?.()?.toLocaleDateString("it-IT") || ""}
                </div>
                <Link to={`/news/${a.id}`}>
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-600 transition-colors duration-300 leading-snug text-pretty">
                    {a.title}
                  </h3>
                </Link>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {a.excerpt}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    di <span className="font-semibold text-slate-700">{a.author}</span>
                  </div>
                  <Link
                    to={`/news/${a.id}`}
                    className="group/btn inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700 transition"
                  >
                    Vedi dettagli
                    <span className="inline-block transition-transform duration-300 group-hover/btn:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}