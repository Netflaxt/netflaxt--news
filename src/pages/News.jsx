import React, { useState } from "react";

/**
 * News — Netflaxt News
 * Lista articoli con filtri categoria, card editoriali, paginazione.
 */
export default function News() {
  const categories = ["Tutto", "Calciomercato", "Serie A", "Coppa Italia", "Europa", "Editoriali"];
  const [active, setActive] = useState("Tutto");

  const articles = [
    {
      id: 1,
      category: "Calciomercato",
      title: "Lazio, l'obiettivo per il centrocampo si sblocca: contatti avanzati",
      excerpt:
        "Lotito accelera per il regista. Le ultime indiscrezioni dal mercato e le cifre dell'operazione.",
      date: "11 Mag 2026",
      author: "Marco Rossi",
      readTime: "4 min",
      img: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80",
      featured: true,
    },
    {
      id: 2,
      category: "Serie A",
      title: "Sarri prepara la sfida: 4-3-3 confermato, ballottaggio in attacco",
      excerpt: "Le scelte tecniche del Comandante in vista del prossimo turno di campionato.",
      date: "10 Mag 2026",
      author: "Giulia Bianchi",
      readTime: "3 min",
      img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
    },
    {
      id: 3,
      category: "Coppa Italia",
      title: "Verso la finale: i precedenti che parlano biancoceleste",
      excerpt: "Statistiche, episodi e protagonisti delle ultime sfide negli scontri diretti.",
      date: "09 Mag 2026",
      author: "Andrea Conti",
      readTime: "6 min",
      img: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80",
    },
    {
      id: 4,
      category: "Editoriali",
      title: "Olimpico sold out: il dato che racconta una stagione",
      excerpt:
        "L'analisi del fenomeno tifo: numeri, abbonamenti e l'effetto della squadra di Sarri sulla piazza.",
      date: "08 Mag 2026",
      author: "Francesca De Luca",
      readTime: "7 min",
      img: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80",
    },
    {
      id: 5,
      category: "Europa",
      title: "Sorteggio europeo: tutti gli scenari possibili",
      excerpt: "Fasce, avversarie e cammino: cosa aspettarsi dalla prossima fase a gironi.",
      date: "07 Mag 2026",
      author: "Luca Ferri",
      readTime: "5 min",
      img: "https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?w=800&q=80",
    },
    {
      id: 6,
      category: "Serie A",
      title: "Difesa biancoceleste: i numeri di una crescita silenziosa",
      excerpt: "Clean sheet, recuperi e linea alta: il lavoro del reparto arretrato sotto la lente.",
      date: "06 Mag 2026",
      author: "Marco Rossi",
      readTime: "4 min",
      img: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=800&q=80",
    },
  ];

  const filtered = active === "Tutto" ? articles : articles.filter((a) => a.category === active);

  return (
    <main className="bg-white text-slate-900 min-h-screen">
      {/* Header pagina */}
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

      {/* Lista */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((a) => (
            <article
              key={a.id}
              className={`group cursor-pointer flex flex-col ${
                a.featured ? "md:col-span-2 lg:col-span-2 lg:row-span-2" : ""
              }`}
            >
              <div
                className={`relative overflow-hidden rounded-md mb-4 ${
                  a.featured ? "aspect-[16/10]" : "aspect-[4/3]"
                }`}
              >
                <img
                  src={a.img}
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
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider mb-2">
                <span>{a.date}</span>
                <span className="h-1 w-1 rounded-full bg-slate-400" />
                <span>{a.readTime}</span>
              </div>
              <h3
                className={`font-semibold text-slate-900 group-hover:text-sky-600 transition leading-snug ${
                  a.featured ? "text-2xl lg:text-3xl" : "text-lg"
                }`}
                style={a.featured ? { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.01em" } : {}}
              >
                {a.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a.excerpt}</p>
              <div className="mt-3 text-xs text-slate-500">
                di <span className="font-semibold text-slate-700">{a.author}</span>
              </div>
            </article>
          ))}
        </div>

        {/* Paginazione */}
        <div className="mt-16 flex items-center justify-center gap-2">
          <button className="px-4 py-2 border border-slate-200 rounded-md text-sm font-semibold text-slate-500 hover:border-sky-400 hover:text-sky-600">
            ← Precedente
          </button>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`w-10 h-10 rounded-md text-sm font-semibold ${
                n === 1
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-700 hover:border-sky-400"
              }`}
            >
              {n}
            </button>
          ))}
          <button className="px-4 py-2 border border-slate-200 rounded-md text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-600">
            Successivo →
          </button>
        </div>
      </section>
    </main>
  );
}