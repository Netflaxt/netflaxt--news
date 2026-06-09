import React from "react";
import { Link } from "react-router-dom";
import useSiteStatus from "../hooks/useSiteStatus";
import { statusMeta } from "../utils/siteStatus";
import { useAuth } from "../context/AuthContext";

export default function Footer() {
  const year = new Date().getFullYear();
  const { status } = useSiteStatus();
  const sm = statusMeta(status);
  const { user } = useAuth();

  const navLinks = [
    ["Home",        "/"],
    ["News",        "/news"],
    ["Calendario",  "/calendario"],
    ["Pronostici",  "/pronostici"],
    ["Classifica",  "/classifica"],
    ["Chat live",   "/chat"],
    ["Chi sono",    "/about"],
    ["Privacy",     "/privacy"],
  ];

  return (
    <footer className="relative bg-bg-base border-t border-border overflow-hidden">
      {/* Glow decorativi */}
      <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] rounded-full bg-accent/8 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-accent-deep/8 blur-[120px] pointer-events-none" />

      {/* Hairline neon in cima */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-10">

        {/* CTA strip — opzionale ma cattura attenzione */}
        <div className="mb-16 grid lg:grid-cols-12 gap-6 items-center pb-16 border-b border-border">
          <div className="lg:col-span-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold mb-3">
              La curva digitale
            </div>
            <h2
              className="text-4xl sm:text-5xl text-text-primary leading-[0.95] text-balance"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.01em" }}
            >
              FATTO DA UN TIFOSO. <br />
              <span className="text-gradient-accent">PER I TIFOSI.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 flex flex-col sm:flex-row gap-3 lg:justify-end">
            <Link
              to="/chat"
              className="px-5 py-3 rounded-md text-sm font-semibold text-text-primary border border-border hover:border-border-strong hover:bg-bg-surface transition-all duration-300 text-center"
            >
              Entra in chat
            </Link>
            {!user && (
              <Link
                to="/login"
                className="group relative px-5 py-3 rounded-md text-sm font-bold text-text-inverse bg-accent overflow-hidden transition-all duration-300 hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] text-center"
              >
                <span className="relative z-10">Registrati gratis →</span>
                <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
              </Link>
            )}
          </div>
        </div>

        {/* Grid principale */}
        <div className="grid md:grid-cols-12 gap-10 lg:gap-8">

          {/* Brand */}
          <div className="md:col-span-5">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="relative">
                <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-bg-elevated to-bg-surface flex items-center justify-center ring-1 ring-accent/30 shadow-[0_0_24px_-6px_rgba(56,189,248,0.5)] group-hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.8)] group-hover:ring-accent/60 group-hover:scale-105 transition-all duration-300 overflow-hidden">
                  <img
                    src="/logo.png"
                    alt="Netflaxt News"
                    className="h-8 w-8 object-contain"
                    draggable="false"
                  />
                </div>
              </div>
              <div>
                <div
                  className="text-2xl text-text-primary tracking-wide"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
                >
                  NETFLAXT <span className="text-accent">NEWS</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-text-muted mt-0.5">
                  Fan site · Biancoceleste
                </div>
              </div>
            </Link>

            <p className="mt-6 text-sm text-text-secondary leading-relaxed max-w-md">
              La casa digitale dei tifosi biancocelesti. News, analisi e chat live —
              indipendente, gratis, costruito da chi vive la Lazio ogni giorno.
            </p>

            {/* Status pill — riflette lo stato reale del sito */}
            <div
              className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border"
              style={{ borderColor: `${sm.color}59` }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                  style={{ backgroundColor: sm.color }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: sm.color }}
                />
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: sm.color }}
              >
                {sm.label}
              </span>
            </div>
          </div>

          {/* Naviga */}
          <div className="md:col-span-3">
            <h4 className="text-[11px] uppercase tracking-[0.28em] font-bold text-accent mb-5">
              Naviga
            </h4>
            <ul className="space-y-3 text-sm">
              {navLinks.map(([label, href]) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="group inline-flex items-center gap-2.5 text-text-secondary hover:text-text-primary transition-colors duration-300"
                  >
                    <span className="w-0 h-px bg-accent group-hover:w-4 transition-all duration-300" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contatti + Social */}
          <div className="md:col-span-4">
            <h4 className="text-[11px] uppercase tracking-[0.28em] font-bold text-accent mb-5">
              Contatti
            </h4>
            <ul className="space-y-3 text-sm text-text-secondary">
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a
                  href="mailto:cretellamattia36@gmail.com"
                  aria-label="Scrivimi a cretellamattia36@gmail.com"
                  className="break-all hover:text-accent transition-colors duration-300"
                >
                  cretellamattia36@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>Roma, Italia</span>
              </li>
            </ul>

            <h4 className="text-[11px] uppercase tracking-[0.28em] font-bold text-accent mt-8 mb-4">
              Seguici
            </h4>
            <div className="flex gap-2">
              <a
                href="https://www.instagram.com/netflaxt"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguimi su Instagram @netflaxt"
                title="Instagram @netflaxt"
                className="group relative w-10 h-10 rounded-lg border border-border bg-bg-surface/50 flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent/50 hover:bg-accent/5 hover:-translate-y-0.5 transition-all duration-300"
              >
                {/* Icona Instagram ufficiale (SVG inline) */}
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 relative z-10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <span className="absolute inset-0 rounded-lg bg-accent/0 group-hover:bg-accent/10 group-hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.4)] transition-all duration-300" />
              </a>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-16 p-5 sm:p-6 rounded-xl bg-bg-surface/60 border border-border backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex shrink-0 w-9 h-9 rounded-lg bg-warning/10 border border-warning/30 items-center justify-center">
              <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="text-xs text-text-secondary leading-relaxed">
              <span className="font-bold text-warning uppercase tracking-[0.2em] text-[10px] mr-2">
                Disclaimer ·
              </span>
              Netflaxt News è un fan site <span className="text-text-primary font-semibold">non affiliato</span> a S.S. Lazio S.p.A.
              Diffidate dalle copie — questo è l'unico sito ufficiale Netflaxt. Tutti i marchi,
              i loghi e le immagini eventualmente presenti sono di proprietà dei rispettivi titolari.
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-text-muted">
            © {year} <span className="text-text-secondary font-medium">Netflaxt News</span> · Tutti i diritti riservati.
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            Fatto con <span className="text-accent animate-pulse">♥</span> da un tifoso biancoceleste.
          </div>
        </div>
      </div>
    </footer>
  );
}
