/* ─────────────────────────────────────────────────────────────
   src/pages/Approva.jsx
   Pagina aperta dal link nell'email quando si accede da un
   dispositivo mai visto.

   Non richiede l'accesso: chi arriva qui sta appunto cercando di
   entrare. Il codice contenuto nel link è la prova che ha accesso alla
   casella di posta dell'account, ed è quello che rende sicuro il tutto.

   La conferma passa dal servizio: il sito non può modificare da solo lo
   stato di un dispositivo senza essere autenticato.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldIcon } from "../components/icons";
import { setSEO, resetSEO } from "../utils/seo";

const SERVIZIO = "https://netflaxt-live-poller.netflaxt.workers.dev";

export default function Approva() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const uid = params.get("u");
  const [stato, setStato] = useState(token ? "corso" : "senzaCodice");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setSEO({ title: "Conferma accesso", type: "website" });
    return () => resetSEO();
  }, []);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(
          `${SERVIZIO}/?confermaAccesso=${encodeURIComponent(token)}&u=${encodeURIComponent(uid || "")}`
        );
        const dati = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (res.ok && dati.ok) setStato("fatto");
        else {
          setMotivo(dati.motivo || "Richiesta non valida");
          setStato("errore");
        }
      } catch {
        if (!vivo) return;
        setMotivo("Non è stato possibile contattare il servizio");
        setStato("errore");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div
          className={`inline-flex w-14 h-14 rounded-xl items-center justify-center mb-5 border ${
            stato === "fatto"
              ? "bg-success/10 border-success/30"
              : stato === "errore"
              ? "bg-error/10 border-error/30"
              : "bg-accent/10 border-accent/30"
          }`}
        >
          <ShieldIcon
            className={`w-6 h-6 ${
              stato === "fatto"
                ? "text-success"
                : stato === "errore"
                ? "text-error"
                : "text-accent"
            }`}
          />
        </div>

        {stato === "corso" && (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CONFERMA IN CORSO…
            </h1>
            <p className="mt-4 text-text-secondary text-sm">Un attimo solo.</p>
          </>
        )}

        {stato === "fatto" && (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ACCESSO CONFERMATO
            </h1>
            <p className="mt-4 text-text-secondary text-sm">
              Il dispositivo è stato autorizzato. Torna alla pagina dove stavi
              accedendo: entrerai automaticamente entro pochi secondi. Se non
              succede, accedi di nuovo.
            </p>
            <Link
              to="/login"
              className="inline-block mt-7 px-6 py-3 rounded-md bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-hover transition"
            >
              Vai all'accesso
            </Link>
          </>
        )}

        {stato === "errore" && (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CONFERMA NON RIUSCITA
            </h1>
            <p className="mt-4 text-text-secondary text-sm">{motivo}.</p>
            <p className="mt-2 text-text-muted text-xs">
              Può darsi che il dispositivo fosse già stato confermato: in tal
              caso puoi semplicemente accedere. Ogni link vale una volta sola.
            </p>
            <Link
              to="/login"
              className="inline-block mt-7 px-6 py-3 rounded-md bg-bg-elevated border border-border text-text-primary text-xs font-bold uppercase tracking-wider hover:border-accent/40 transition"
            >
              Vai all'accesso
            </Link>
          </>
        )}

        {stato === "senzaCodice" && (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              LINK NON VALIDO
            </h1>
            <p className="mt-4 text-text-secondary text-sm">
              Questo indirizzo non contiene il codice di conferma. Apri il link
              che trovi nell'email che ti abbiamo inviato.
            </p>
          </>
        )}

        <div className="mt-8">
          <Link
            to="/"
            className="text-xs uppercase tracking-wider text-text-muted hover:text-accent transition"
          >
            ← Torna a Netflaxt News
          </Link>
        </div>
      </div>
    </main>
  );
}
