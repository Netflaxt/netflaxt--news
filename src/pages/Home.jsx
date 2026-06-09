import NewsletterCTA from "../components/NewsletterCTA";
import InstallAppCard from "../components/InstallAppCard";
import PronosticiCTA from "../components/PronosticiCTA";
import { SkeletonArticleCard } from "../components/Skeleton";
import BookmarkButton from "../components/BookmarkButton";
import PollWidget from "../components/PollWidget";
import FlyEagleButton from "../components/FlyEagleButton";
import QuizCard from "../components/QuizCard";
import { preloadEagleCry } from "../utils/eagleSound";
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

/* ───────────────────────────────────────────────────────────────
   Titolone — segmenti per effetto typewriter
   "LA CASA / DEI TIFOSI / LAZIALI"  (TIFOSI è in gradient accent)
   ─────────────────────────────────────────────────────────────── */
const SEG_A = "LA CASA";         // 7  chars  (positions 0-6)
const SEG_B = "DEI ";            // 4  chars  (positions 7-10)
const SEG_B_ACCENT = "TIFOSI";   // 6  chars  (positions 11-16)
const SEG_C = "LAZIALI";         // 7  chars  (positions 17-23)
const TITLE_TOTAL =
  SEG_A.length + SEG_B.length + SEG_B_ACCENT.length + SEG_C.length;
const BR1_AT = SEG_A.length;                          // 7
const BR2_AT = SEG_A.length + SEG_B.length + SEG_B_ACCENT.length; // 17

export default function Home() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);

  // Typewriter state
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    // Preload asset aquila (audio + immagine) per partenza istantanea
    preloadEagleCry();
    const img = new Image();
    img.src = "/eagle.png";
    return () => cancelAnimationFrame(t);
  }, []);

  // Avanza il typewriter un carattere alla volta
  useEffect(() => {
    if (typed >= TITLE_TOTAL) return;
    // Piccola pausa extra in corrispondenza dei <br />
    const delay = typed === BR1_AT || typed === BR2_AT ? 220 : 70;
    const t = setTimeout(() => setTyped((c) => c + 1), delay);
    return () => clearTimeout(t);
  }, [typed]);

  /* ✨ REAL-TIME: nuovi articoli pubblicati dall'admin appaiono
     subito nella home senza bisogno di refresh. */
  useEffect(() => {
    const q = query(
      collection(db, "articles"),
      orderBy("date", "desc"),
      limit(3)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLatest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error("Errore listener home articoli:", e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Pre-calcoli per il render del titolo typewriter
  const typedA = SEG_A.slice(0, Math.min(typed, SEG_A.length));
  const typedB = SEG_B.slice(0, Math.max(0, Math.min(typed - SEG_A.length, SEG_B.length)));
  const typedBAccent = SEG_B_ACCENT.slice(
    0,
    Math.max(0, Math.min(typed - SEG_A.length - SEG_B.length, SEG_B_ACCENT.length))
  );
  const typedC = SEG_C.slice(
    0,
    Math.max(0, Math.min(typed - SEG_A.length - SEG_B.length - SEG_B_ACCENT.length, SEG_C.length))
  );
  const typingDone = typed >= TITLE_TOTAL;

  return (
    <main className="bg-bg-base text-text-primary overflow-hidden">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative border-b border-border-subtle">
        {/* Glow di sfondo */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-accent/12 blur-[140px]" />
          <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-accent-deep/10 blur-[120px]" />
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

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 lg:pt-28 pb-16 lg:pb-24">
          <div className="grid lg:grid-cols-12 gap-12 items-center">

            {/* Colonna SX */}
            <div
              className={`lg:col-span-7 transition-all duration-700 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              {/* Pill stagione */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border">
                <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-secondary">
                  Una passione immortale
                </span>
              </div>

              {/* Titolone con effetto typewriter */}
              <h1
                className="mt-7 text-6xl sm:text-7xl lg:text-[5.5rem] leading-[0.92] text-text-primary min-h-[3em]"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.005em" }}
                aria-label="LA CASA DEI TIFOSI LAZIALI"
              >
                <span aria-hidden="true">
                  {typedA}
                  {typed >= BR1_AT && <br />}
                  {typedB}
                  <span className="text-gradient-accent">{typedBAccent}</span>
                  {typed >= BR2_AT && <br />}
                  {typedC}
                  {/* Cursore visibile SOLO durante la digitazione, poi sparisce */}
                  {!typingDone && (
                    <span
                      className="inline-block align-baseline ml-1 w-[0.08em] h-[0.85em] bg-accent translate-y-[0.05em]"
                      style={{ boxShadow: "0 0 12px rgba(56,189,248,0.7)" }}
                    />
                  )}
                </span>
              </h1>

              <p className="mt-7 text-lg lg:text-xl text-text-secondary max-w-xl leading-relaxed text-pretty">
                Tutte le notizie sul mondo Lazio in tempo reale, analisi tattiche,
                calciomercato e una chat live per commentare ogni partita ed evento con
                il resto dei tifosi.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to="/news"
                  className="group relative px-6 py-3.5 bg-accent text-text-inverse font-semibold rounded-md overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Leggi le ultime
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                </Link>
                <Link
                  to="/chat"
                  className="group px-6 py-3.5 border border-border hover:border-accent/60 hover:bg-accent/5 text-text-primary font-semibold rounded-md transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2"
                >
                  Entra in chat
                  <span className="inline-block transition-transform duration-300 group-hover:translate-x-1 text-accent">
                    →
                  </span>
                </Link>
              </div>
            </div>

            {/* Colonna DX — Instagram CTA cliccabile */}
            <div
              className={`lg:col-span-5 relative transition-all duration-1000 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              {/* Glow dietro la card */}
              <div className="absolute -inset-4 bg-accent/15 rounded-3xl blur-3xl -z-10 ig-cta-glow" />

              <a
                href="https://www.instagram.com/netflaxt/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguimi su Instagram @netflaxt"
                className="group block relative isolate rounded-xl overflow-hidden border border-border bg-bg-surface hover:border-accent/60 transform-gpu transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_0_48px_-4px_rgba(56,189,248,0.55)] focus:outline-none focus:ring-2 focus:ring-accent/60"
              >
                <div
                  className="relative aspect-square overflow-hidden"
                  style={{
                    maskImage: "linear-gradient(#000, #000)",
                    WebkitMaskImage: "linear-gradient(#000, #000)",
                    transform: "translateZ(0)",
                  }}
                >
                  <img
                    src="/instagram-cta.PNG"
                    alt="Seguimi su Instagram @netflaxt"
                    className="block w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                    loading="eager"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const fb = el.nextElementSibling;
                      if (fb) fb.style.display = "flex";
                    }}
                  />
                  <div
                    className="absolute inset-0 hidden items-center justify-center bg-bg-surface text-text-secondary text-sm p-6 text-center"
                    aria-hidden="true"
                  >
                    Carica <code className="mx-1 px-1 py-0.5 bg-bg-base rounded text-accent">/public/instagram-cta.PNG</code> per vedere il CTA Instagram
                  </div>
                </div>

                <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-accent/0 group-hover:ring-accent/40 transition-all duration-500" />
              </a>

              <div className="absolute -top-3 -left-3 w-16 h-16 border-l border-t border-accent/40 pointer-events-none" />
              <div className="absolute -bottom-3 -right-3 w-16 h-16 border-r border-b border-accent/40 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ ULTIMI ARTICOLI ═══════════════════ */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        {/* Header sezione */}
        <div
          className={`flex items-end justify-between mb-12 pb-6 border-b border-border-subtle transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
              <span className="h-px w-8 bg-accent" />
              Dalla redazione
            </div>
            <h2
              className="mt-3 text-5xl lg:text-6xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ultime notizie
            </h2>
          </div>
          <Link
            to="/news"
            className="group hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-accent transition-colors duration-300"
          >
            Tutte le news
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        {/* Grid card */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonArticleCard key={i} />
            ))}
          </div>
        ) : latest.length === 0 ? (
          /* ✨ Empty state quando non ci sono articoli pubblicati */
          <div className="flex flex-col items-center text-center py-24">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/10 blur-2xl rounded-full" />
              <div className="relative w-20 h-20 rounded-2xl border border-border bg-bg-surface flex items-center justify-center">
                <svg
                  className="w-9 h-9 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H12m3 0h.008v.008H15v-.008zM4.5 21.75h15a2.25 2.25 0 002.25-2.25V8.25a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 8.25v11.25c0 1.243 1.007 2.25 2.25 2.25z"
                  />
                </svg>
              </div>
            </div>
            <h3
              className="mt-6 text-3xl text-text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Nessun articolo ancora
            </h3>
            <p className="mt-2 text-text-secondary max-w-md">
              La redazione sta lavorando ai primi pezzi. Torna presto 🦅
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
            {latest.map((p, i) => (
              /* WRAPPER: gestisce SOLO l'animazione d'entrata (staggered).
                 Separato dalla Link così il delay d'entrata non si applica
                 anche all'hover (era questo a far sembrare l'hover laggoso). */
              <div
                key={p.id}
                className={mounted ? "nf-card-in" : "opacity-0"}
                style={{ animationDelay: `${400 + i * 100}ms` }}
              >
              <Link
                to={`/news/${p.id}`}
                className="group relative isolate flex flex-col h-full rounded-xl bg-bg-surface border border-border hover:border-accent/40 overflow-hidden transform-gpu transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_32px_-8px_rgba(56,189,248,0.4)]"
              >
                {/* Image */}
                <div
                  className="relative aspect-[16/10] overflow-hidden bg-bg-surface"
                  style={{
                    maskImage: "linear-gradient(#000, #000)",
                    WebkitMaskImage: "linear-gradient(#000, #000)",
                    transform: "translateZ(0)",
                  }}
                >
                  <img
                    src={p.imageUrl || "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900&q=80"}
                    alt={p.title}
                    className="block w-full h-full object-cover transform-gpu transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-surface/80 via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 px-2 py-1 bg-bg-base/80 backdrop-blur-md border border-border text-[10px] font-bold uppercase tracking-[0.18em] text-text-primary rounded">
                    {p.category}
                  </span>
                  {p.featured && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 bg-accent/90 backdrop-blur-md text-text-inverse text-[10px] font-bold uppercase tracking-[0.18em] rounded">
                      ★ Top
                    </span>
                  )}
                  {p.video?.url && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-bg-base/80 backdrop-blur-md border border-border text-text-primary text-[10px] font-bold uppercase tracking-[0.18em] rounded">
                      ▶ Video
                    </span>
                  )}
                  {/* Bookmark icon overlay */}
                  <div className="absolute bottom-3 right-3">
                    <BookmarkButton article={p} variant="icon" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-5 lg:p-6">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted mb-3">
                    {p.date?.toDate?.()?.toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }) || ""}
                  </div>
                  <h3 className="text-lg lg:text-xl font-semibold text-text-primary group-hover:text-accent-hover transition-colors duration-300 leading-snug text-pretty">
                    {p.title}
                  </h3>
                  {p.excerpt && (
                    <p className="mt-3 text-sm text-text-secondary leading-relaxed line-clamp-2">
                      {p.excerpt}
                    </p>
                  )}
                  <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0 text-text-muted">
                      {p.journalist ? (
                        <span className="truncate">
                          via <span className="text-text-secondary font-medium">{p.journalist}</span>
                        </span>
                      ) : (
                        <>
                          <img src="/logo.png" alt="" className="w-4 h-4 object-contain shrink-0" draggable="false" />
                          <span className="text-text-secondary font-medium truncate">Netflaxt News</span>
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 text-accent font-bold uppercase tracking-[0.18em] text-[10px] opacity-60 group-hover:opacity-100 group-hover:gap-2 transition-all duration-300 shrink-0">
                      Leggi →
                    </span>
                  </div>
                </div>
              </Link>
              </div>
            ))}
          </div>
        )}

        {/* Link "Tutte" mobile */}
        <div className="mt-10 sm:hidden">
          <Link
            to="/news"
            className="block w-full text-center py-3.5 border border-border hover:border-accent/40 hover:bg-bg-surface rounded-md text-sm font-semibold text-text-primary transition-all duration-300"
          >
            Vedi tutte le news →
          </Link>
        </div>
      </section>

      {/* ═══════════════════ QUIZ LAZIO DEL GIORNO ═══════════════════ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <QuizCard />
      </section>

      {/* ═══════════════════ SONDAGGIO ATTIVO ═══════════════════ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <PollWidget />
      </section>

      {/* ═══════════════════ PRONOSTICI ═══════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <PronosticiCTA />
      </section>

      {/* ═══════════════════ INSTALLA APP (PWA) ═══════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <InstallAppCard />
      </section>

      {/* ═══════════════════ EASTER EGG AQUILA ═══════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <FlyEagleButton />
      </section>

      {/* ═══════════════════ NEWSLETTER ═══════════════════ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <NewsletterCTA variant="card" />
      </section>

      {/* ═══════════════════ MANIFESTO ═══════════════════ */}
      <section className="relative border-y border-border-subtle bg-bg-surface/30 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/8 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="text-[11px] uppercase tracking-[0.32em] text-accent font-semibold mb-5">
            Il nostro manifesto
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl text-text-primary leading-[1.05] text-balance"
            style={{ fontFamily: "var(--font-display)" }}
          >
            NON UN GIORNALE. <br />
            <span className="text-gradient-accent">UNA CURVA CHE SCRIVE.</span>
          </h2>
          <p className="mt-7 text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto text-pretty">
            Niente clickbait, niente algoritmi che decidono cosa leggi. Solo Lazio,
            raccontata da chi la vive ogni domenica all'Olimpico. Indipendente.
            Gratis. Per i tifosi.
          </p>

          {/* Mini-grid valori */}
          <div className="mt-14 grid sm:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {[
              {
                t: "Indipendenza",
                d: "Nessuno sponsor decide cosa pubblichiamo. Solo passione.",
              },
              {
                t: "Tempestività",
                d: "News aggiornate in tempo reale, direttamente dalla redazione.",
              },
              {
                t: "Community",
                d: "Chat live aperta a tutti. Il salotto digitale dei biancocelesti.",
              },
            ].map((v) => (
              <div key={v.t} className="p-7 bg-bg-base text-left hover:bg-bg-surface transition-colors duration-300 group">
                <div className="flex items-center gap-2 text-accent">
                  <span className="h-1 w-6 bg-accent rounded-full group-hover:w-10 transition-all duration-300" />
                  <span className="text-[10px] uppercase tracking-[0.22em] font-bold">
                    {v.t}
                  </span>
                </div>
                <p className="mt-4 text-sm text-text-secondary leading-relaxed">
                  {v.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA FINALE (solo per utenti non loggati) ═══════════════════ */}
      {!user && (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[140px]" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-deep/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7">
                <div className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold mb-5">
                  Unisciti alla community
                </div>
                <h2
                  className="text-5xl lg:text-7xl text-text-primary leading-[0.95] text-balance"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  ENTRA NELLA <br />
                  <span className="text-gradient-accent">CURVA DIGITALE.</span>
                </h2>
                <p className="mt-7 text-lg text-text-secondary max-w-lg leading-relaxed">
                  Registrati gratis per supportarmi e accedi alla chat live e a tutte le
                  altre funzioni esclusive.
                </p>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="group relative px-6 py-4 bg-accent text-text-inverse font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5 text-center"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    Registrati gratis
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-4 border border-border hover:border-border-strong hover:bg-bg-surface text-text-primary font-semibold rounded-md transition-all duration-300 text-center"
                >
                  Ho già un account
                </Link>

                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-text-muted">
                  <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Gratis · Nessuna carta richiesta · Cancellabile in 1 click
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
