import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function About() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <main className="bg-white text-slate-900 overflow-hidden">
      {/* HERO */}
      <section className="relative border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/50">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-0 -left-32 w-[400px] h-[400px] rounded-full bg-sky-300/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div
            className={`transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-sky-300 text-[11px] font-semibold tracking-[0.2em] uppercase">
              Chi sono
            </div>
            <h1
              className="mt-6 text-5xl sm:text-7xl text-slate-900 leading-[0.95] text-balance"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              UN TIFOSO, <br />
              UN <span className="text-sky-500">SOGNO</span>, <br />
              UN SITO.
            </h1>
            <p className="mt-6 text-xl text-slate-600 max-w-2xl leading-relaxed text-pretty">
              Netflaxt News è nato in una serata d'estate, davanti a una replica di Lazio–Roma e con
              la voglia di dare ai tifosi biancocelesti un posto loro su internet.
            </p>
          </div>
        </div>
      </section>

      {/* Mattia */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20">
        <div
          className={`grid md:grid-cols-3 gap-10 items-start transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="md:col-span-1">
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center text-7xl text-white font-black shadow-2xl shadow-sky-500/30 ring-4 ring-white">
                M
              </div>
              <div className="absolute -bottom-3 -right-3 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-md shadow-lg">
                Founder
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <h2
                className="text-3xl text-slate-900"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Mattia
              </h2>
              <div className="text-sm text-slate-500">Tifoso · Sviluppatore · Caporedattore</div>
              <div className="pt-3 flex flex-wrap gap-1.5">
                {["Lazio", "Olimpico", "Curva Nord", "Sarrismo"].map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-5 text-slate-700 leading-relaxed text-pretty">
            <p className="text-lg">
              <span className="float-left text-6xl leading-[0.85] font-black text-sky-500 mr-2 mt-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                S
              </span>
              ono Mattia, biancoceleste dalla nascita. Cresciuto a colpi di domeniche
              all'Olimpico, di trasferte in tasca e di mille discussioni in chat dopo ogni
              partita. Netflaxt News è il mio tentativo di mettere ordine in tutto questo:
              un posto unico dove leggere, commentare, vivere la Lazio insieme agli altri.
            </p>
            <p>
              Non sono un giornalista, sono un tifoso che scrive. Qui trovi le mie analisi,
              le notizie raccolte e verificate, e — soprattutto — una chat live dove ogni
              tifoso ha voce. Niente clickbait, niente algoritmi: solo la curva, in digitale.
            </p>
            <p>
              Il sito è in continua evoluzione. Se hai feedback, idee o vuoi scrivere
              insieme a me, scrivimi pure: ogni mano è bene accetta.
            </p>
          </div>
        </div>
      </section>

      {/* Il progetto — timeline */}
      <section className="bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-sky-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-[11px] uppercase tracking-[0.3em] text-sky-300 font-semibold">
            Il progetto
          </div>
          <h2
            className="mt-2 text-4xl sm:text-5xl text-balance"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            DAL <span className="text-sky-400">PRIMO COMMIT</span> ALLA CURVA DIGITALE.
          </h2>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              {
                n: "01",
                t: "L'idea",
                d: "Un fan site indipendente, costruito da un tifoso per i tifosi. Niente sponsor invasivi, niente paywall.",
              },
              {
                n: "02",
                t: "Lo stack",
                d: "React + Vite + Firebase per autenticazione, news in real-time e chat. Tecnologia moderna, leggera.",
              },
              {
                n: "03",
                t: "La community",
                d: "Chat live aperta a tutti gli iscritti. Il salotto digitale dei tifosi biancocelesti.",
              },
            ].map((item, i) => (
              <div
                key={item.n}
                className={`relative pl-6 border-l-2 border-sky-400/60 transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${400 + i * 120}ms` }}
              >
                <div
                  className="text-5xl text-sky-300/80 leading-none"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {item.n}
                </div>
                <h3 className="mt-3 text-xl font-bold text-white">{item.t}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="p-8 sm:p-10 rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3
                className="text-2xl text-slate-900 mb-2"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Avviso importante
              </h3>
              <p className="text-slate-700 leading-relaxed">
                Netflaxt News è un fan site <strong>non affiliato</strong> a S.S. Lazio S.p.A.
                Tutti i nomi, i marchi, i loghi e le immagini che dovessero apparire nei contenuti
                sono di proprietà dei rispettivi titolari. Diffidate dalle copie — questo è
                l'unico sito ufficiale Netflaxt.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/news"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-md hover:bg-sky-500 hover:text-slate-900 transition group"
          >
            Vai alle news
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}