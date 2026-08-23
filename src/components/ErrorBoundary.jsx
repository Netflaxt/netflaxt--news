/* ─────────────────────────────────────────────────────────────
   src/components/ErrorBoundary.jsx
   Rete di sicurezza: se una pagina va in errore durante il render,
   React smonta tutto l'albero e l'utente resta davanti a una
   schermata bianca muta. Questo boundary intercetta l'errore e
   mostra invece un messaggio in tema, con le vie d'uscita.

   Avvolge le route (vedi App.jsx): un crash in una pagina non
   porta giù navbar/footer, e "Riprova" rimonta solo la route.
   ───────────────────────────────────────────────────────────── */
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In produzione resta nei log del browser: utile se un tifoso
    // segnala "mi si è bloccato" e serve capire cosa è successo.
    console.error("Errore non gestito nella pagina:", error, info?.componentStack);
  }

  // Cambiando route si riprova: azzera l'errore quando cambia la key
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-accent font-bold">
            Qualcosa è andato storto
          </div>
          <h1
            className="mt-3 text-4xl sm:text-5xl text-text-primary leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            PALLA FUORI.
          </h1>
          <p className="mt-4 text-text-secondary text-sm">
            Questa pagina ha avuto un problema imprevisto. Non è colpa tua:
            riprova, oppure torna alla home.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="px-5 py-2.5 rounded-md bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-hover transition"
            >
              Riprova
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-md bg-bg-elevated border border-border text-text-primary text-xs font-bold uppercase tracking-wider hover:border-accent/40 transition"
            >
              Torna alla home
            </a>
          </div>

          <p className="mt-6 text-[11px] text-text-muted">
            Se ricapita, scrivimi e lo sistemo.
          </p>
        </div>
      </main>
    );
  }
}
