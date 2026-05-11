import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default function News() {
  const categories = ["Tutto", "Calciomercato", "Serie A", "Coppa Italia", "Europa", "Editoriali"];
  const [active, setActive] = useState("Tutto");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const q = query(collection(db, "articles"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setArticles(data);
      } catch (error) {
        console.error("Errore caricamento articoli:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const filtered = active === "Tutto"
    ? articles
    : articles.filter((a) => a.category === active);

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* Header */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
            Archivio
          </div>
          <h1
            className="mt-2 text-5xl sm:text-6xl text-slate-900"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Tutte le <span className="text-sky-500">News</span>
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl">
            Cronaca, analisi e approfondimenti dal mondo S.S. Lazio. Aggiornato ogni giorno.
          </p>
        </div>
      </section>

      {/* Filtri */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition border ${
                active === c
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-sky-400 hover:text-sky-600"
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
            <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            Nessun articolo trovato in questa categoria.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((a) => (
              <article key={a.id} className="group cursor-pointer flex flex-col">
                <div className="relative overflow-hidden rounded-md aspect-[4/3] mb-4">
                  <img
                    src={a.imageUrl || "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80"}
                    alt={a.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 px-2 py-1 bg-sky-400 text-slate-900 text-[10px] font-bold uppercase tracking-widest">
                    {a.category}
                  </span>
                  {a.featured && (
                    <span className="absolute top-3 right-3 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest">
                      In evidenza
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {a.date?.toDate?.()?.toLocaleDateString("it-IT") || ""}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-600 transition leading-snug">
                  {a.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a.excerpt}</p>
                <div className="mt-3 text-xs text-slate-500">
                  di <span className="font-semibold text-slate-700">{a.author}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}