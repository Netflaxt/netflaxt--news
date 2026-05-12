import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-slate-950 text-slate-300 overflow-hidden border-t border-slate-800">
      <div className="absolute -top-40 -left-32 w-[400px] h-[400px] rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-32 w-[400px] h-[400px] rounded-full bg-sky-400/5 blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-300">
                <img src="/logo.png" alt="Netflaxt News" className="w-full h-full object-contain" />
            </div>
              <div>
                <div
                  className="text-2xl text-white tracking-wide"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}
                >
                  NETFLAXT <span className="text-sky-400">NEWS</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  Fan site · Biancoceleste
                </div>
              </div>
            </Link>
            <p className="mt-5 text-sm text-slate-400 leading-relaxed max-w-md">
              La casa digitale dei tifosi biancocelesti. News, analisi e chat live —
              indipendente, gratis, fatto da un tifoso per i tifosi.
            </p>
          </div>

          {/* Navigazione */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-sky-400 mb-4">
              Naviga
            </h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ["Home", "/"],
                ["News", "/news"],
                ["Chat live", "/chat"],
                ["Chi sono", "/about"],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="group inline-flex items-center gap-2 text-slate-400 hover:text-white transition"
                  >
                    <span className="w-0 h-px bg-sky-400 group-hover:w-3 transition-all duration-300" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contatti & Social */}
          <div className="md:col-span-4">
            <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-sky-400 mb-4">
              Contatti
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span className="text-slate-500 italic">in arrivo</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-slate-500 italic">Roma, Italia</span>
              </li>
            </ul>

            <h4 className="text-[11px] uppercase tracking-[0.25em] font-bold text-sky-400 mt-6 mb-3">
              Social
            </h4>
            <div className="flex gap-2">
              {["IG", "X", "TG", "YT"].map((s) => (
                <a
                  key={s}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  aria-label={s}
                  className="w-9 h-9 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center justify-center text-xs font-bold text-slate-400 hover:text-white hover:border-sky-400 hover:bg-sky-500/10 hover:-translate-y-0.5 transition-all duration-200"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <span className="font-bold text-sky-400 uppercase tracking-wider text-[10px]">
              Disclaimer ·{" "}
            </span>
            Netflaxt News è un fan site non affiliato a S.S. Lazio S.p.A. Diffidate dalle copie —
            questo è l'unico sito ufficiale Netflaxt. Tutti i marchi, i loghi e le immagini
            eventualmente presenti sono di proprietà dei rispettivi titolari.
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              © {year} Netflaxt News · Tutti i diritti riservati.
            </div>
            <div className="flex items-center gap-1.5">
              Fatto con <span className="text-sky-400">♥</span> da un tifoso biancoceleste.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}