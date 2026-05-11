import React from "react";

/**
 * Home — Netflaxt News
 * Hero asimmetrico, preview articoli, CTA chat live.
 */
export default function Home() {
  const previews = [
    {
      tag: "Calciomercato",
      title: "Lazio, l'obiettivo per il centrocampo si sblocca: contatti avanzati",
      date: "11 Mag 2026",
      img: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80",
    },
    {
      tag: "Serie A",
      title: "Sarri prepara la sfida: 4-3-3 confermato, ballottaggio in attacco",
      date: "10 Mag 2026",
      img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
    },
    {
      tag: "Coppa Italia",
      title: "Verso la finale: i precedenti che parlano biancoceleste",
      date: "09 Mag 2026",
      img: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80",
    },
  ];

  return (
    <main className="bg-white text-slate-900">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200">
        {/* sfondo grafico */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-sky-300/40 blur-3xl" />
          <div className="absolute bottom-0 -left-32 w-[400px] h-[400px] rounded-full bg-sky-400/30 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #0f172a 0, #0f172a 1px, transparent 1px, transparent 14px)",
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-sky-300 text-xs font-semibold tracking-widest uppercase">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live · 1.247 utenti connessi
              </div>

              <h1
                className="mt-6 text-5xl sm:text-6xl lg:text-7xl leading-[0.95] text-slate-900"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.01em" }}
              >
                LA CASA DEI <br />
                <span className="text-sky-500">TIFOSI</span> BIANCOCELESTI.
              </h1>

              <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
                News in tempo reale, analisi tattiche, calciomercato e una chat live per
                commentare ogni partita con il resto della curva. Solo S.S. Lazio.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#news"
                  className="px-6 py-3 bg-slate-900 text-white font-semibold rounded-md hover:bg-sky-500 hover:text-slate-900 transition"
                >
                  Leggi le ultime
                </a>
                <a
                  href="#chat"
                  className="px-6 py-3 border-2 border-slate-900 text-slate-900 font-semibold rounded-md hover:bg-slate-900 hover:text-white transition"
                >
                  Entra in Chat →
                </a>
              </div>

              {/* stats */}
              <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
                {[
                  { n: "12k+", l: "Utenti" },
                  { n: "340", l: "Articoli/mese" },
                  { n: "24/7", l: "Chat live" },
                ].map((s) => (
                  <div key={s.l} className="border-l-2 border-sky-400 pl-3">
                    <div
                      className="text-3xl text-slate-900"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                    >
                      {s.n}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* card editoriale a destra, asimmetrica */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-lg overflow-hidden ring-1 ring-slate-200 shadow-2xl shadow-sky-500/20 rotate-1 hover:rotate-0 transition-transform duration-500">
                <img
                  src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900&q=80"
                  alt="Stadio"
                  className="w-full h-[440px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="inline-block px-2 py-1 bg-sky-400 text-slate-900 text-[10px] font-bold uppercase tracking-widest">
                    In primo piano
                  </span>
                  <h2
                    className="mt-3 text-white text-3xl leading-tight"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    Olimpico sold out: il dato che racconta una stagione
                  </h2>
                  <p className="mt-2 text-slate-300 text-sm">Editoriale · 5 min di lettura</p>
                </div>
              </div>
              {/* decorazione */}
              <div className="absolute -top-4 -left-4 w-20 h-20 border-4 border-sky-400 -z-10" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-slate-900 -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ULTIMI ARTICOLI — preview */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-10 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
              Ultime notizie
            </div>
            <h2
              className="mt-2 text-4xl text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Dalla redazione
            </h2>
          </div>
          <a href="#news" className="text-sm font-semibold text-slate-700 hover:text-sky-600">
            Tutte le news →
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {previews.map((p, i) => (
            <article key={i} className="group cursor-pointer">
              <div className="relative overflow-hidden rounded-md aspect-[4/3] mb-4">
                <img
                  src={p.img}
                  alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-2 py-1 bg-white text-slate-900 text-[10px] font-bold uppercase tracking-widest">
                  {p.tag}
                </span>
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{p.date}</div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-600 transition leading-snug">
                {p.title}
              </h3>
            </article>
          ))}
        </div>
      </section>

      {/* CTA finale */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2
              className="text-5xl"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              ENTRA NELLA <span className="text-sky-400">CURVA NORD</span> DIGITALE.
            </h2>
            <p className="mt-4 text-slate-300 max-w-lg">
              Registrati gratis e accedi alla chat live, ai pronostici della community e ai
              contenuti riservati ai soci.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button className="px-6 py-3 bg-sky-400 text-slate-900 font-bold rounded-md hover:bg-sky-300 transition">
              Registrati gratis
            </button>
            <button className="px-6 py-3 border-2 border-white text-white font-bold rounded-md hover:bg-white hover:text-slate-900 transition">
              Ho già un account
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}