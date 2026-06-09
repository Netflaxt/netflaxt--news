/* ─────────────────────────────────────────────────────────────
   src/components/InstallAppCard.jsx
   Card promozionale Home: invita a installare l'app PWA.
   - Su DESKTOP (Windows/Mac/Linux Chrome/Edge): bottone "Scarica App"
     che fa partire il prompt nativo del browser
   - Su MOBILE (iOS o Android): guida visiva passo-passo con tab
     selezionabili (iPhone / Android)
   - Si nasconde se l'app è già installata
   ───────────────────────────────────────────────────────────── */
import React, { useState, useEffect } from "react";
import usePwaInstall from "../hooks/usePwaInstall";
import InstallAppButton from "./InstallAppButton";

function detectOS() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua) && !window.MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const BENEFITS = [
  {
    title: "Avvio dalla home",
    desc: "Icona Netflaxt sul tuo dispositivo, come un'app vera.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    ),
  },
  {
    title: "Schermo intero",
    desc: "Niente barre del browser. Solo Lazio, a tutto schermo.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    ),
  },
  {
    title: "Veloce e leggera",
    desc: "Caricamenti istantanei e accesso rapido alla chat.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
  },
];

const STEPS_IOS = [
  {
    n: 1,
    title: "Apri il menu del browser",
    desc: "Tocca il pulsante con i tre puntini \"…\" in basso a destra (come su iPhone).",
    icon: <DotsHorizontalIcon />,
  },
  {
    n: 2,
    title: "Tocca \"Condividi\"",
    desc: "Nel menu che si apre, tocca la voce Condividi con l'icona della freccia verso l'alto.",
    icon: <ShareIosIcon />,
  },
  {
    n: 3,
    title: "Scorri e tocca \"Aggiungi alla schermata Home\"",
    desc: "Trovi l'opzione fra le voci del menu (icona con un + dentro).",
    icon: <PlusBoxIcon />,
  },
  {
    n: 4,
    title: "Conferma con \"Aggiungi\"",
    desc: "L'icona di Netflaxt apparirà sulla tua schermata Home come una vera app.",
    icon: <CheckIcon />,
  },
];

const STEPS_ANDROID = [
  {
    n: 1,
    title: "Tocca il menu ⋮ in alto a destra",
    desc: "I tre puntini in verticale accanto alla barra degli indirizzi di Chrome.",
    icon: <MenuDotsIcon />,
  },
  {
    n: 2,
    title: "Scegli \"Installa app\" o \"Aggiungi a schermata Home\"",
    desc: "A seconda della versione di Chrome la voce può chiamarsi in uno dei due modi.",
    icon: <DownloadIcon />,
  },
  {
    n: 3,
    title: "Conferma con \"Installa\"",
    desc: "Si aprirà una finestra: tocca Installa e l'app sarà nella schermata Home.",
    icon: <CheckIcon />,
  },
];

export default function InstallAppCard() {
  const { platform } = usePwaInstall();
  const [os, setOs] = useState("desktop");
  const [tab, setTab] = useState("ios"); // tab attiva per la guida mobile

  useEffect(() => {
    const detected = detectOS();
    setOs(detected);
    if (detected === "android") setTab("android");
    else if (detected === "ios") setTab("ios");
  }, []);

  // Nascondi se l'app è già installata
  if (platform === "installed") return null;

  const isMobile = os === "ios" || os === "android";

  return (
    <div className="relative">
      {/* Glow biancoceleste di sfondo */}
      <div className="absolute -inset-4 bg-accent/15 rounded-3xl blur-3xl pointer-events-none nf-app-card-glow" />

      <div className="relative rounded-2xl bg-bg-surface border border-accent/30 overflow-hidden shadow-[0_0_50px_-12px_rgba(56,189,248,0.4)]">
        {/* Texture grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse at center, #000 30%, transparent 80%)",
          }}
        />

        <div className="relative p-8 sm:p-10">
          {/* Header */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
              App Netflaxt
            </span>
          </div>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-text-primary leading-none text-balance mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            INSTALLA L'APP{" "}
            <span className="text-gradient-accent">NETFLAXT</span>
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-6 max-w-md">
            Un click e Netflaxt è sul tuo dispositivo, come un'app vera. Pochi
            megabyte, niente store, partenza al volo.
          </p>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Colonna sinistra: bottone desktop OPPURE guida mobile */}
            <div className="lg:col-span-7">
              {isMobile ? (
                <MobileGuide tab={tab} setTab={setTab} />
              ) : (
                <DesktopInstall platform={platform} />
              )}
            </div>

            {/* Colonna destra: 3 benefit con icona */}
            <div className="lg:col-span-5 grid sm:grid-cols-1 gap-3">
              {BENEFITS.map((b, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-bg-elevated border border-border hover:border-accent/40 transition"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-accent"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      {b.icon}
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text-primary">
                      {b.title}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                      {b.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes nf-app-card-glow-kf {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.02); }
        }
        .nf-app-card-glow { animation: nf-app-card-glow-kf 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   DESKTOP — Bottone "Scarica App" che fa partire prompt nativo
   ───────────────────────────────────────────────────────────── */
function DesktopInstall({ platform }) {
  return (
    <div>
      <InstallAppButton size="lg" />
      <p className="mt-3 text-xs text-text-muted leading-relaxed max-w-md">
        {platform === "native"
          ? "Cliccando \"Scarica App\" si aprirà il dialogo di installazione del browser."
          : platform === "ios"
          ? "Sui dispositivi Apple desktop, apri Safari sul tuo Mac per installare."
          : "Funziona al meglio su Google Chrome o Microsoft Edge."}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MOBILE — Guida visiva passo-passo con tab iPhone / Android
   ───────────────────────────────────────────────────────────── */
function MobileGuide({ tab, setTab }) {
  const steps = tab === "ios" ? STEPS_IOS : STEPS_ANDROID;
  return (
    <div>
      {/* Tab switcher */}
      <div className="inline-flex rounded-lg border border-border bg-bg-elevated p-1 mb-5">
        <button
          type="button"
          onClick={() => setTab("ios")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition inline-flex items-center gap-2 ${
            tab === "ios"
              ? "bg-accent text-text-inverse shadow-[0_0_18px_-4px_rgba(56,189,248,0.5)]"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <AppleIcon className="w-3.5 h-3.5" />
          iPhone / iPad
        </button>
        <button
          type="button"
          onClick={() => setTab("android")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition inline-flex items-center gap-2 ${
            tab === "android"
              ? "bg-accent text-text-inverse shadow-[0_0_18px_-4px_rgba(56,189,248,0.5)]"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <AndroidIcon className="w-3.5 h-3.5" />
          Android
        </button>
      </div>

      {/* Steps */}
      <ol className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-3 p-3 rounded-xl bg-bg-elevated border border-border"
          >
            <span className="shrink-0 w-7 h-7 rounded-full bg-accent text-text-inverse flex items-center justify-center text-xs font-black">
              {s.n}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-text-primary flex items-center gap-2">
                {s.title}
                <span className="inline-flex w-5 h-5 items-center justify-center text-accent">
                  {s.icon}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                {s.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[11px] text-text-muted">
        {tab === "ios"
          ? "Su iPhone l'installazione PWA funziona solo da Safari, non da Chrome o Firefox."
          : "Su Android funziona al meglio da Google Chrome. Su altri browser potresti non vedere l'opzione."}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ICONS
   ───────────────────────────────────────────────────────────── */
function ShareIosIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
function DotsHorizontalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
function PlusBoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function MenuDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function AppleIcon({ className = "w-4 h-4" }) {
  // Logo Apple ufficiale (mela + foglia)
  return (
    <svg viewBox="0 0 384 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM254.6 100.8c30.9-36.7 28.1-70.1 27.2-82.1-27.3 1.6-58.9 18.6-76.9 39.5-19.8 22.4-31.4 50.1-28.9 81.5 29.5 2.3 56.4-12.8 78.6-38.9z"/>
    </svg>
  );
}
function AndroidIcon({ className = "w-4 h-4" }) {
  // Logo Android ufficiale (robot)
  return (
    <svg viewBox="0 0 576 512" fill="currentColor" className={className} aria-hidden="true">
      <path d="M420.6 301.9a24 24 0 1 1 24-24 24 24 0 0 1 -24 24m-265.1 0a24 24 0 1 1 24-24 24 24 0 0 1 -24 24m273.7-144.5 47.9-83a10 10 0 1 0 -17.3-10l-48.5 84.1a301.3 301.3 0 0 0 -246.6 0L116.2 64.5a10 10 0 1 0 -17.3 10l47.9 83C64.5 202.2 8.2 285.6 0 384H576c-8.2-98.4-64.5-181.8-146.9-226.6"/>
    </svg>
  );
}
