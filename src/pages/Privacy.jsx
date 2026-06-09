/* ─────────────────────────────────────────────────────────────
   src/pages/Privacy.jsx
   Pagina Privacy policy + Cookie policy.
   Testo italiano standard adattato alla situazione del sito
   (Firebase Auth, Cloudinary upload, chat, analytics opzionale).
   ───────────────────────────────────────────────────────────── */
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { setSEO, resetSEO } from "../utils/seo";

export default function Privacy() {
  useEffect(() => {
    setSEO({
      title: "Privacy policy",
      description:
        "Informativa privacy e cookie di Netflaxt News. Come trattiamo i tuoi dati.",
    });
    window.scrollTo(0, 0);
    return () => resetSEO();
  }, []);

  return (
    <main className="bg-bg-base text-text-primary">
      {/* Hero */}
      <section className="relative border-b border-border-subtle">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/8 rounded-full blur-[140px]" />
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface border border-border">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-secondary">
              Documento legale
            </span>
          </div>
          <h1
            className="mt-6 text-5xl sm:text-6xl text-text-primary leading-[0.95]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            PRIVACY <span className="text-gradient-accent">POLICY</span>
          </h1>
          <p className="mt-4 text-text-secondary">
            Ultimo aggiornamento: <span className="font-semibold text-text-primary">19 maggio 2026</span>
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-[15px] leading-relaxed">
        <Block title="1. Chi siamo">
          <p>
            Netflaxt News è un sito amatoriale gestito da un singolo individuo
            per i tifosi della S.S. Lazio. Non è affiliato
            ufficialmente alla società Lazio. Per qualsiasi richiesta puoi
            contattarmi su Instagram <a className="text-accent hover:underline" href="https://www.instagram.com/netflaxt/" target="_blank" rel="noopener noreferrer">@netflaxt</a>.
          </p>
        </Block>

        <Block title="2. Dati personali trattati">
          <p>Quando ti registri e usi il sito, raccogliamo:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-text-secondary">
            <li><b className="text-text-primary">Email</b> e <b className="text-text-primary">nome utente</b> per autenticazione</li>
            <li><b className="text-text-primary">Foto profilo</b> se la carichi</li>
            <li><b className="text-text-primary">Messaggi chat</b> che invii pubblicamente</li>
            <li><b className="text-text-primary">Indirizzo IP</b> (temporaneamente, per sicurezza)</li>
            <li><b className="text-text-primary">Statistiche anonime di navigazione</b> (solo se accetti i cookie analitici)</li>
          </ul>
        </Block>

        <Block title="3. Come usiamo i tuoi dati">
          <ul className="list-disc pl-5 space-y-1 text-text-secondary">
            <li>Per farti usare le funzioni del sito (login, chat, profilo)</li>
            <li>Per moderare la community (filtri anti-bestemmie, ban progressivi)</li>
            <li>Per migliorare il sito tramite statistiche anonime aggregate</li>
            <li><b className="text-text-primary">NON</b> vendiamo i tuoi dati a terzi. <b className="text-text-primary">NON</b> facciamo pubblicità mirata.</li>
          </ul>
        </Block>

        <Block title="4. Cookie utilizzati">
          <h3 className="font-bold text-text-primary mt-2 mb-1">Cookie essenziali (sempre attivi)</h3>
          <p className="text-text-secondary">
            Necessari per far funzionare il login e la chat. Senza questi il sito non
            può funzionare.
          </p>

          <h3 className="font-bold text-text-primary mt-4 mb-1">Cookie analitici (opzionali)</h3>
          <p className="text-text-secondary">
            Se accetti, usiamo statistiche di traffico anonime e aggregate per
            capire quali articoli funzionano. Nessun dato personale viene tracciato.
            Puoi sempre revocare il consenso cancellando i dati del sito dal browser.
          </p>
        </Block>

        <Block title="6. I tuoi diritti (GDPR)">
          <p>
            Hai sempre il diritto di:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-text-secondary">
            <li>Accedere ai tuoi dati</li>
            <li>Richiedere la cancellazione del tuo account e di tutti i tuoi messaggi</li>
            <li>Esportare i tuoi dati in formato leggibile</li>
            <li>Revocare il consenso al trattamento</li>
          </ul>
          <p className="mt-3">
            Per esercitare questi diritti scrivi su Instagram{" "}
            <a className="text-accent hover:underline" href="https://www.instagram.com/netflaxt/" target="_blank" rel="noopener noreferrer">@netflaxt</a>.
            Risposta entro 30 giorni.
          </p>
        </Block>

        <Block title="7. Sicurezza">
          <p>
            I dati sono protetti da regole di accesso Firestore. Le password non sono
            mai memorizzate in chiaro.
            La chat usa moderazione automatica per bestemmie e insulti.
          </p>
        </Block>

        <Block title="8. Minori">
          <p>
            Il sito è destinato a utenti maggiori di 14 anni. Se sei minorenne,
            chiedi il consenso ai tuoi genitori prima di registrarti.
          </p>
        </Block>

        <Block title="9. Modifiche a questa policy">
          <p>
            Potremmo aggiornare questo documento. Quando lo faremo, ti chiederemo
            di nuovo il consenso ai cookie. La data di "ultimo aggiornamento" in
            cima cambia di conseguenza.
          </p>
        </Block>

        <div className="pt-8 border-t border-border-subtle">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-text-secondary hover:text-accent transition"
          >
            <span className="inline-block transition-transform group-hover:-translate-x-1">←</span>
            Torna alla home
          </Link>
        </div>
      </section>
    </main>
  );
}

function Block({ title, children }) {
  return (
    <div>
      <h2
        className="text-2xl text-text-primary mb-3"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div className="text-text-secondary space-y-2">{children}</div>
    </div>
  );
}
