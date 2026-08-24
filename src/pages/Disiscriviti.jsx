/* ─────────────────────────────────────────────────────────────
   src/pages/Disiscriviti.jsx
   Pagina raggiunta dal link in fondo alle email della newsletter.

   La cancellazione è un obbligo di legge e deve funzionare senza
   dover fare l'accesso: chi riceve un'email potrebbe non avere
   nemmeno un account. Il codice personale nel link identifica
   l'iscrizione, così nessuno può cancellare quella di un altro.

   La rimozione avviene tramite il servizio automatico: l'elenco
   degli iscritti non è leggibile né modificabile dal sito, per non
   esporre gli indirizzi di terzi.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailIcon } from "../components/icons";
import { setSEO, resetSEO } from "../utils/seo";

const SERVIZIO = "https://netflaxt-live-poller.netflaxt.workers.dev";

export default function Disiscriviti() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const [stato, setStato] = useState("attesa"); // attesa | corso | fatto | errore
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setSEO({ title: "Cancella iscrizione", type: "website" });
    return () => resetSEO();
  }, []);

  const cancella = async () => {
    setStato("corso");
    try {
      const res = await fetch(
        `${SERVIZIO}/?disiscrivi=${encodeURIComponent(token)}`
      );
      const dati = await res.json().catch(() => ({}));
      if (res.ok && dati.ok) setStato("fatto");
      else {
        setMotivo(dati.motivo || "Iscrizione non trovata");
        setStato("errore");
      }
    } catch {
      setMotivo("Non è stato possibile contattare il servizio");
      setStato("errore");
    }
  };

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-xl bg-accent/10 border border-accent/30 items-center justify-center mb-5">
          <MailIcon className="w-6 h-6 text-accent" />
        </div>

        {!token ? (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              LINK NON VALIDO
            </h1>
            <p className="mt-4 text-text-secondary text-sm">
              Questo indirizzo non contiene il codice necessario. Usa il link
              "Cancella l'iscrizione" che trovi in fondo a una nostra email.
            </p>
          </>
        ) : stato === "fatto" ? (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ISCRIZIONE ANNULLATA
            </h1>
            <p className="mt-4 text-text-secondary text-sm">
              Non riceverai più la newsletter. Ci dispiace vederti andare via —
              il sito resta sempre aperto, e puoi iscriverti di nuovo quando
              vuoi dalla home.
            </p>
          </>
        ) : stato === "errore" ? (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              QUALCOSA NON VA
            </h1>
            <p className="mt-4 text-text-secondary text-sm">{motivo}.</p>
            <p className="mt-2 text-text-muted text-xs">
              Può darsi che l'iscrizione fosse già stata annullata. Se il
              problema resta,{" "}
              <a
                href="https://www.instagram.com/netflaxt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                scrivimi su Instagram
              </a>{" "}
              e la tolgo a mano.
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-4xl text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CANCELLARE L'ISCRIZIONE?
            </h1>
            <p className="mt-4 text-text-secondary text-sm">
              Non riceverai più le email con le notizie sulla Lazio. Puoi sempre
              iscriverti di nuovo in un secondo momento.
            </p>
            <button
              onClick={cancella}
              disabled={stato === "corso"}
              className="mt-7 px-6 py-3 rounded-md bg-error text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition disabled:opacity-60"
            >
              {stato === "corso" ? "Attendere…" : "Sì, cancella l'iscrizione"}
            </button>
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
