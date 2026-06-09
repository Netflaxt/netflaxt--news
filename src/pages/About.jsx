import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function About() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <main className="bg-bg-base text-text-primary overflow-hidden">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative border-b border-border-subtle overflow-hidden">
        {/* Glow di sfondo */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-accent/12 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 -left-32 w-[400px] h-[400px] bg-accent-deep/8 rounded-full blur-[120px]" />
          {/* Grid sottilissima */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse at top, #000 30%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div
            className={`transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-secondary">
                Chi sono
              </span>
            </div>

            <h1
              className="mt-6 text-5xl sm:text-7xl text-text-primary leading-[0.95] text-balance"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.005em" }}
            >
              UN TIFOSO, <br />
              UN <span className="text-gradient-accent">SOGNO</span>, <br />
              UN SITO.
            </h1>

            <p className="mt-7 text-xl text-text-secondary max-w-2xl leading-relaxed text-pretty">
              Netflaxt News è nato da un sogno di un piccolo tifoso laziale, con un solo
              obiettivo: riunire tutti i tifosi della Lazio in un singolo posto.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ MATTIA ═══════════════════ */}
      <section className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div
          className={`grid md:grid-cols-3 gap-10 items-start transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          {/* Colonna avatar + tag */}
          <div className="md:col-span-1">
            <div className="relative">
              {/* Glow dietro avatar */}
              <div className="absolute -inset-3 bg-accent/15 rounded-3xl blur-2xl -z-10" />

              <div className="aspect-square rounded-2xl bg-gradient-to-br from-bg-elevated to-bg-surface flex items-center justify-center p-6 shadow-[0_0_50px_-8px_rgba(56,189,248,0.5)] ring-2 ring-accent/30 overflow-hidden">
                <img
                  src="/logo.png"
                  alt="Netflaxt News"
                  className="w-full h-full object-contain"
                  draggable="false"
                />
              </div>
              <div className="absolute -bottom-3 -right-3 px-3 py-1.5 bg-bg-surface border border-accent/40 text-accent text-[10px] font-bold uppercase tracking-[0.18em] rounded-md shadow-lg">
                Founder
              </div>
            </div>

            <div className="mt-7 space-y-2">
              <h2
                className="text-3xl text-text-primary"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.02em" }}
              >
                Mattia
              </h2>
              <div className="text-sm text-text-secondary">
                Tifoso · Sviluppatore · Social Media Manager
              </div>
              <div className="pt-3 flex flex-wrap gap-1.5">
                {["S.S. Lazio", "Tifoso", "Curva Nord"].map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] bg-accent/10 text-accent border border-accent/30 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Colonna biografia */}
          <div className="md:col-span-2 space-y-6 text-text-secondary leading-relaxed text-pretty">
            <p className="text-lg">
              <span
                className="float-left text-6xl leading-[0.85] font-black text-accent mr-2 mt-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                S
              </span>
              <span className="text-text-primary font-semibold">ono Mattia, laziale da sempre.</span>{" "}
              Sono cresciuto con le domeniche allo stadio e parlando e vivendo solo di Lazio
              e Lazialità. La Lazio per me non è solo calcio, è parte della mia vita ogni giorno.
            </p>

            <p>
              <span className="text-text-primary font-semibold">Netflaxt News nasce proprio da questo.</span>{" "}
              Volevo creare un posto fatto da un tifoso per i tifosi. Un posto dove leggere
              notizie sulla Lazio, parlare delle partite, confrontarsi e vivere tutto insieme,
              senza robe finte o titoli esagerati solo per fare click.
            </p>

            <p>
              <span className="text-text-primary font-semibold">Non faccio il giornalista.</span>{" "}
              Sono semplicemente un ragazzo con la passione per la Lazio e per i social, che
              ogni giorno prova a portare contenuti fatti bene, chiari e il più possibile veri.
              Qui trovi news, analisi, grafiche, opinioni e soprattutto una community dove
              tutti possono dire la loro.
            </p>

            <p>
              <span className="text-text-primary font-semibold">La parte più importante del sito? La chat live.</span>{" "}
              Perché alla fine il bello è proprio questo: commentare insieme una partita,
              esultare per un gol oppure lamentarsi dopo una sconfitta, come si farebbe tra amici.
            </p>

            <p>
              <span className="text-text-primary font-semibold">Il progetto cresce giorno dopo giorno.</span>{" "}
              Se hai idee, consigli o vuoi collaborare, scrivimi tranquillamente. Ogni aiuto
              da parte di un altro laziale vale tanto.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ IL PROGETTO — TIMELINE ═══════════════════ */}
      <section className="relative border-y border-border-subtle bg-bg-surface/30 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-accent/12 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] rounded-full bg-accent-deep/8 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
            <span className="h-px w-8 bg-accent" />
            Il progetto
          </div>

          <h2
            className="mt-3 text-4xl sm:text-5xl lg:text-6xl text-text-primary leading-[1.02] text-balance"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.005em" }}
          >
            DALLA <span className="text-gradient-accent">PRIMA IDEA</span> AD UNA PIATTAFORMA DIGITALE.
          </h2>

          <div className="mt-14 grid md:grid-cols-3 gap-8 lg:gap-10">
            {[
              {
                n: "01",
                t: "L'idea",
                d: "Un fan site indipendente, costruito da un tifoso per i tifosi. Niente sponsor invasivi, niente paywall.",
              },
              {
                n: "02",
                t: "La passione",
                d: "Quella che non muore mai, quella che ti spinge oltre il tuo limite, il bello di essere laziali.",
              },
              {
                n: "03",
                t: "La community",
                d: "Chat live aperta a tutti gli iscritti. Il salotto digitale dei tifosi biancocelesti.",
              },
            ].map((item, i) => (
              <div
                key={item.n}
                className={`relative pl-6 transition-all duration-700 ${
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${400 + i * 120}ms` }}
              >
                <span className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-accent via-accent/60 to-transparent" />
                <div
                  className="text-5xl text-accent leading-none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {item.n}
                </div>
                <h3 className="mt-3 text-xl font-bold text-text-primary">{item.t}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ DISCLAIMER + CTA ═══════════════════ */}
      <section className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="p-7 sm:p-9 rounded-2xl border border-border bg-bg-surface/60 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] font-bold text-warning mb-2">
                Avviso importante
              </div>
              <h3
                className="text-2xl text-text-primary mb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Disclaimer
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Netflaxt News è un fan site{" "}
                <span className="text-text-primary font-semibold">non affiliato</span> a
                S.S. Lazio S.p.A. Tutti i nomi, i marchi, i loghi e le immagini che dovessero
                apparire nei contenuti sono di proprietà dei rispettivi titolari. Diffidate
                dalle copie — questo è l'unico sito ufficiale Netflaxt.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/news"
            className="group relative inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-text-inverse font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5"
          >
            <span className="relative z-10 inline-flex items-center gap-2">
              Vai alle news
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </span>
            <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
          </Link>
        </div>
      </section>
    </main>
  );
}
