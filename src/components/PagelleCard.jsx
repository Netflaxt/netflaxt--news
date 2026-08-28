/* ─────────────────────────────────────────────────────────────
   src/components/PagelleCard.jsx
   Le pagelle della partita, in home.

   Non è una pagina a parte: è una scheda che compare sotto la barra
   della prossima partita quando c'è qualcosa da votare, e sparisce
   quando hai finito.

   Il voto avviene un giocatore alla volta, a carte impilate: quindici
   giocatori sembrano tanti in un elenco, quasi nulla se li tocchi uno
   dopo l'altro. Finito il giro, si vede il proprio voto accanto a
   quello della curva — ed è quel confronto, non il voto in sé, il
   motivo per cui si torna il giorno dopo.
   ───────────────────────────────────────────────────────────── */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  seguiUltimePagelle,
  mieiVoti,
  inviaVoti,
  mediaDi,
  quantiHannoVotato,
  SENZA_VOTO,
} from "../utils/pagelle";
import { fotoDi, inizialiDi, cognomeDi } from "../utils/fotoGiocatori";

const RUOLI = { G: "Portiere", D: "Difensore", M: "Centrocampista", F: "Attaccante" };

/* Quando la scheda smette di comparire è deciso in utils/pagelle.js:
   le pagelle mostrate sono sempre le ultime aperte, e vengono
   sostituite da quelle della giornata successiva. */

function classeVoto(n) {
  if (n === SENZA_VOTO || !Number.isFinite(Number(n))) return "text-text-muted";
  const v = Number(n);
  if (v < 6) return "text-error";
  if (v < 6.5) return "text-warning";
  return "text-success";
}

function Faccia({ nome, grande }) {
  const [rotta, setRotta] = useState(false);
  const src = fotoDi(nome);
  const misura = grande ? "w-24 h-24 text-3xl" : "w-11 h-11 text-xs";

  if (src && !rotta) {
    return (
      <img
        src={src}
        alt={cognomeDi(nome)}
        loading="lazy"
        onError={() => setRotta(true)}
        className={`${misura} rounded-full object-cover object-top bg-bg-elevated border-2 border-border shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${misura} rounded-full shrink-0 flex items-center justify-center font-black text-text-inverse bg-gradient-to-br from-accent-hover to-accent-deep border-2 border-border`}
      aria-hidden="true"
    >
      {inizialiDi(nome)}
    </div>
  );
}

export default function PagelleCard() {
  const { user } = useAuth();
  const [pagelle, setPagelle] = useState(null);
  const [voti, setVoti] = useState({});
  const [indice, setIndice] = useState(0);
  const [inVia, setInVia] = useState(false);
  const [giaVotato, setGiaVotato] = useState(null); // null = non lo sappiamo ancora
  const [aperta, setAperta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");
  const bloccato = useRef(false);

  /* Le pagelle si trovano da sole: sono l'ultimo documento aperto dal
     servizio a fine partita. Non passano dal calendario, che in home è
     limitato alle gare imminenti. */
  useEffect(() => {
    const unsub = seguiUltimePagelle(setPagelle);
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    let annullato = false;
    if (!pagelle?.id || !user?.uid) {
      setGiaVotato(user ? null : false);
      return;
    }
    mieiVoti(pagelle.id, user.uid).then((v) => {
      if (!annullato) setGiaVotato(v || false);
    });
    return () => {
      annullato = true;
    };
  }, [pagelle?.id, user?.uid]);

  const giocatori = useMemo(() => pagelle?.giocatori || [], [pagelle]);
  const votanti = useMemo(() => quantiHannoVotato(pagelle), [pagelle]);

  const vota = useCallback(
    (valore) => {
      if (bloccato.current) return;
      bloccato.current = true;
      const g = giocatori[indice];
      if (!g) return;

      setVoti((v) => ({ ...v, [g.id]: valore }));
      setInVia(true);

      /* L'attesa serve a far vedere l'animazione della carta che se ne
         va. Senza, il passaggio è istantaneo e si perde il senso di
         "una fatta, avanti la prossima". */
      window.setTimeout(() => {
        setInVia(false);
        setIndice((i) => i + 1);
        bloccato.current = false;
      }, 260);
    },
    [giocatori, indice]
  );

  /* Finito il giro, si salva. Da qui in poi il tifoso vede il confronto
     fra i suoi voti e quelli della curva. */
  useEffect(() => {
    if (!aperta || salvando || giaVotato) return;
    if (!giocatori.length || indice < giocatori.length) return;
    if (!user?.uid || !pagelle?.id) return;

    setSalvando(true);
    inviaVoti(pagelle.id, user.uid, voti)
      .then((esito) => {
        if (!esito.ok && esito.motivo) setErrore(esito.motivo);
        setGiaVotato(voti);
      })
      .catch((e) => setErrore(e?.message || "Voti non salvati. Riprova."))
      .finally(() => setSalvando(false));
  }, [aperta, indice, giocatori.length, user?.uid, pagelle?.id, voti, salvando, giaVotato]);

  /* ─── Quando la scheda non deve comparire ─────────────────── */
  if (!pagelle || !giocatori.length) return null;

  const titoloPartita = pagelle.partita || "Ultima partita";
  const risultato = pagelle.risultato || "";

  /* ─── Non collegato: invito, senza mostrare le medie ───────── */
  if (!user) {
    return (
      <Cornice titolo={titoloPartita} risultato={risultato} votanti={votanti}>
        <div className="flex -space-x-3 mb-5">
          {giocatori.slice(0, 7).map((g) => (
            <Faccia key={g.id} nome={g.nome} />
          ))}
        </div>
        <p className="text-text-secondary text-sm mb-5">
          Dai il tuo voto a ogni biancoceleste sceso in campo, poi scopri cosa ne
          pensa il resto della curva.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full py-3 rounded-md bg-accent text-text-inverse font-bold uppercase tracking-wider text-sm transition-all hover:-translate-y-0.5"
        >
          Accedi per votare
        </Link>
      </Cornice>
    );
  }

  /* ─── Ha già votato: il confronto ──────────────────────────── */
  if (giaVotato) {
    return (
      <Cornice titolo={titoloPartita} risultato={risultato} votanti={votanti}>
        <Confronto giocatori={giocatori} miei={giaVotato} pagelle={pagelle} />
      </Cornice>
    );
  }

  /* ─── Scheda chiusa: invito a cominciare ───────────────────── */
  if (!aperta) {
    return (
      <Cornice titolo={titoloPartita} risultato={risultato} votanti={votanti}>
        <div className="flex -space-x-3 mb-5">
          {giocatori.slice(0, 7).map((g) => (
            <Faccia key={g.id} nome={g.nome} />
          ))}
          {giocatori.length > 7 && (
            <div className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-text-secondary bg-bg-elevated border-2 border-border">
              +{giocatori.length - 7}
            </div>
          )}
        </div>
        <p className="text-text-secondary text-sm mb-5">
          {giocatori.length} biancocelesti sono scesi in campo. Dagli un voto —
          ci metti meno di un minuto.
        </p>
        <button
          type="button"
          onClick={() => setAperta(true)}
          className="w-full py-3 rounded-md bg-accent text-text-inverse font-bold uppercase tracking-wider text-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_0_28px_-6px_rgba(56,189,248,0.6)]"
        >
          Vota le pagelle
        </button>
      </Cornice>
    );
  }

  /* ─── Il giro dei voti ─────────────────────────────────────── */
  const corrente = giocatori[indice];
  const fatti = indice;

  return (
    <Cornice titolo={titoloPartita} risultato={risultato} votanti={votanti}>
      {errore && (
        <p className="mb-3 text-sm text-error" role="alert">
          {errore}
        </p>
      )}

      <div className="relative h-[400px] sm:h-[380px]">
        {[2, 1, 0].map((posto) => {
          const g = giocatori[indice + posto];
          if (!g) return null;
          const davanti = posto === 0;
          const stile = davanti
            ? inVia
              ? "translate-y-[-46px] scale-[.86] -rotate-3 opacity-0 z-30"
              : "translate-y-0 scale-100 opacity-100 z-30"
            : posto === 1
            ? "translate-y-[10px] scale-[.955] opacity-60 z-20"
            : "translate-y-[20px] scale-[.91] opacity-30 z-10";

          return (
            <div
              key={g.id + "-" + posto}
              className={`absolute inset-0 rounded-2xl border border-border bg-bg-elevated p-5 flex flex-col items-center transition-all duration-[420ms] ease-[cubic-bezier(.22,1.2,.36,1)] motion-reduce:transition-none ${stile}`}
              aria-hidden={!davanti}
            >
              <Faccia nome={g.nome} grande />
              <div
                className="mt-3 text-2xl sm:text-3xl text-text-primary uppercase text-center leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cognomeDi(g.nome)}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {RUOLI[g.ruolo] || g.ruolo || "In campo"} ·{" "}
                {g.titolare ? `${g.minuti}'` : `entrato · ${g.minuti}'`}
              </div>

              {davanti && (
                <div className="mt-5 w-full grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => vota(v)}
                      className={`py-2.5 rounded-lg border border-border bg-bg-surface text-lg text-text-primary transition-all hover:-translate-y-0.5 hover:border-accent active:scale-90 ${classeVoto(
                        v
                      )}`}
                      style={{ fontFamily: "var(--font-display)" }}
                      aria-label={`Voto ${v} a ${cognomeDi(g.nome)}`}
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => vota(SENZA_VOTO)}
                    className="col-span-5 py-2 rounded-lg border border-border bg-bg-surface text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted transition-all hover:border-accent hover:text-text-secondary"
                  >
                    Senza voto
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 h-[3px] rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-[420ms] ease-[cubic-bezier(.22,1.2,.36,1)] motion-reduce:transition-none"
          style={{ width: `${(fatti / giocatori.length) * 100}%` }}
        />
      </div>
      <div className="mt-2 text-center text-[11px] tracking-[0.1em] text-text-muted tabular-nums">
        {salvando ? "Salvo i tuoi voti…" : `${Math.min(fatti + 1, giocatori.length)} di ${giocatori.length}`}
      </div>
    </Cornice>
  );
}

/* ── Cornice comune ─────────────────────────────────────────── */
function Cornice({ titolo, risultato, votanti, children }) {
  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6">
      <div className="rounded-2xl border border-border bg-bg-surface/70 backdrop-blur-sm p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">
            Pagelle della curva
          </span>
          {votanti > 0 && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted tabular-nums">
              {votanti} {votanti === 1 ? "voto" : "voti"}
            </span>
          )}
        </div>
        <h2
          className="text-2xl sm:text-3xl text-text-primary uppercase leading-none mb-5"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {titolo} {risultato && <span className="text-accent">{risultato}</span>}
        </h2>
        {children}
      </div>
    </section>
  );
}

/* ── Il confronto: il tuo voto accanto a quello della curva ─── */
function Confronto({ giocatori, miei, pagelle }) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 pb-2 mb-1 border-b-2 border-border-strong text-[9.5px] uppercase tracking-[0.14em] text-text-muted font-bold">
        <span>Giocatore</span>
        <span className="text-right w-10">Tu</span>
        <span className="text-right w-12">Curva</span>
      </div>

      {giocatori.map((g, i) => {
        const mio = miei?.[g.id];
        const media = mediaDi(pagelle, g.id);
        const senza = Number(pagelle?.senzaVoto?.[g.id] ?? 0);
        return (
          <div
            key={g.id}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2 border-b border-border last:border-b-0 animate-fade-up motion-reduce:animate-none"
            style={{ animationDelay: `${Math.min(i * 60, 600)}ms` }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Faccia nome={g.nome} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-primary truncate">
                  {cognomeDi(g.nome)}
                </div>
                <div className="text-[10px] text-text-muted">
                  {g.titolare ? `${g.minuti}'` : `entrato · ${g.minuti}'`}
                  {senza > 0 && ` · ${senza} SV`}
                </div>
              </div>
            </div>
            <div
              className={`text-lg text-right w-10 tabular-nums ${classeVoto(mio)}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {mio === SENZA_VOTO ? "SV" : mio ?? "—"}
            </div>
            <div
              className={`text-lg text-right w-12 tabular-nums ${classeVoto(media)}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {media == null ? "—" : media.toFixed(1).replace(".", ",")}
            </div>
          </div>
        );
      })}

      <p className="mt-4 text-xs text-text-muted">
        Le medie cambiano man mano che votano gli altri. Torna a vedere come
        finisce.
      </p>
    </div>
  );
}
