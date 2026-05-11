import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "articles"), orderBy("date", "desc"), limit(3));
        const snap = await getDocs(q);
        setLatest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Errore caricamento home articoli:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // fallback se non ci sono ancora articoli
  const previewFallback = [
    {
      id: "demo-1",
      category: "Calciomercato",
      title: "Lazio, l'obiettivo per il centrocampo si sblocca: contatti avanzati",
      date: { toDate: () => new Date(2026, 4, 11) },
      imageUrl: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80",
    },
    {
      id: "demo-2",
      category: "Serie A",
      title: "Sarri prepara la sfida: 4-3-3 confermato, ballottaggio in attacco",
      date: { toDate: () => new Date(2026, 4, 10) },
      imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
    },
    {
      id: "demo-3",
      category: "Coppa Italia",
      title: "Verso la finale: i precedenti che parlano biancoceleste",
      date: { toDate: () => new Date(2026, 4, 9) },
      imageUrl: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80",
    },
  ];

  const cards = latest.length > 0 ? latest : previewFallback;

  return (
    <main className="bg-white text-slate-900 overflow-hidden">
      {/* HERO */}
      <section className="relative border-b border-slate-200">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-sky-300/40 blur-3xl" />
          <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-sky-400/25 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #0f172a 0, #0f172a 1px, transparent 1px, transparent 14px)",
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Colonna SX */}
            <div
              className={`lg:col-span-7 transition-all duration-700 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 backdrop-blur text-sky-300 text-[11px] font-semibold tracking-[0.2em] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                Stagione 2025/26
              </div>

              <h1
                className="mt-6 text-5xl sm:text-6xl lg:text-7xl leading-[0.92] text-slate-900"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.005em" }}
              >
                LA CASA DEI <br />
                <span className="relative inline-block">
                  <span className="relative z-10 text-sky-500">TIFOSI</span>
                  <span className="absolute left-0 right-0 bottom-1 h-3 bg-sky-100 -z-0" />
                </span>{" "}
                BIANCOCELESTI.
              </h1>

              <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed text-pretty">
                News in tempo reale, analisi tattiche, calciomercato e una chat live per
                commentare ogni partita con il resto della curva.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/news"
                  className="group relative px-6 py-3 bg-slate-900 text-white font-semibold rounded-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5"
                >
                  <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                    Leggi le ultime
                  </span>
                  <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </Link>
                <Link
                  to="/chat"
                  className="group px-6 py-3 border-2 border-slate-900 text-slate-900 font-semibold rounded-md hover:bg-slate-900 hover:text-white transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2"
                >
                  Entra in chat
                  <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>

              {/* stats */}
              <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
                {[
                  { n: "12k+", l: "Utenti" },
                  { n: "340", l: "Articoli/mese" },
                  { n: "24/7", l: "Chat live" },
                ].map((s, i) => (
                  <div
                    key={s.l}
                    className={`border-l-2 border-sky-400 pl-3 transition-all duration-700 ${
                      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                    }`}
                    style={{ transitionDelay: `${300 + i * 100}ms` }}
                  >
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

            {/* Card editoriale a destra */}
            <div
              className={`lg:col-span-5 relative transition-all duration-1000 ${
                mounted ? "opacity-100 translate-y-0 rotate-1" : "opacity-0 translate-y-8 rotate-3"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="relative rounded-xl overflow-hidden ring-1 ring-slate-200 shadow-2xl shadow-sky-500/20 hover:rotate-0 hover:scale-[1.02] transition-all duration-500">
                <img
                  src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900&q=80"
                  alt="Stadio"
                  className="w-full h-[440px] object-cover scale-105 hover:scale-110 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold uppercase tracking-widest rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Editoriale
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="inline-block px-2 py-1 bg-sky-400 text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded">
                    In primo piano
                  </span>
                  <h2
                    className="mt-3 text-white text-3xl leading-tight text-balance"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    Olimpico sold out: il dato che racconta una stagione
                  </h2>
                  <p className="mt-2 text-slate-300 text-sm">5 min di lettura</p>
                </div>
              </div>
              <div className="absolute -top-4 -left-4 w-20 h-20 border-4 border-sky-400 rounded-tl-xl -z-10" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-slate-900 rounded-br-xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ULTIMI ARTICOLI */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
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
          <Link
            to="/news"
            className="group text-sm font-semibold text-slate-700 hover:text-sky-600 transition flex items-center gap-1.5"
          >
            Tutte le news
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {cards.map((p, i) => (
              <Link
                key={p.id}
                to={p.id.startsWith("demo-") ? "/news" : `/news/${p.id}`}
                className={`group block transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${400 + i * 120}ms` }}
              >
                <div className="relative overflow-hidden rounded-lg aspect-[4/3] mb-4 ring-1 ring-slate-200">
                  <img
                    src={
                      p.imageUrl ||
                      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80"
                    }
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="absolute top-3 left-3 px-2 py-1 bg-white/95 backdrop-blur text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded">
                    {p.category}
                  </span>
                  <span className="absolute bottom-3 right-3 px-3 py-1.5 bg-sky-400 text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    Leggi →
                  </span>
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {p.date?.toDate?.()?.toLocaleDateString("it-IT") || ""}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-600 transition-colors duration-300 leading-snug text-pretty">
                  {p.title}
                </h3>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA finale */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-sky-500/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full bg-sky-400/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-300 font-semibold mb-4">
              Unisciti alla community
            </div>
            <h2
              className="text-5xl lg:text-6xl leading-[0.95] text-balance"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              ENTRA NELLA <br />
              <span className="text-sky-400">CURVA DIGITALE.</span>
            </h2>
            <p className="mt-5 text-slate-300 max-w-lg leading-relaxed">
              Registrati gratis e accedi alla chat live, ai pronostici della community e ai
              contenuti riservati ai soci.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              to="/login"
              className="group relative px-6 py-3 bg-sky-400 text-slate-900 font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-sky-400/30 hover:-translate-y-0.5"
            >
              <span className="relative z-10">Registrati gratis</span>
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 border-2 border-white/30 text-white font-bold rounded-md hover:border-white hover:bg-white hover:text-slate-900 transition-all duration-300 hover:-translate-y-0.5"
            >
              Ho già un account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}