/* ─────────────────────────────────────────────────────────────
   src/pages/Controllo.jsx
   Pagina di controllo riservata all'amministratore.

   Il 24/08/2026 tre gruppi di dati sono usciti dal profilo pubblico
   (indirizzo email, stato di moderazione, dispositivi collegati alle
   notifiche) perché chiunque poteva leggerli. Lo spostamento avviene
   da solo al primo accesso di ciascuno, quindi non c'è un momento in
   cui "è finito": va guardato.

   Questa pagina lo mostra a colpo d'occhio, leggendo SOLO i documenti
   dell'utente collegato. Serve anche in futuro, ogni volta che si
   sposta qualcosa e bisogna verificare che sia arrivato a destinazione,
   senza dover ricorrere agli strumenti da sviluppatore.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { setSEO, resetSEO } from "../utils/seo";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

/* Campi che NON devono più comparire nel profilo pubblico. */
const FUORI_DAL_PROFILO = {
  email: "Indirizzo email",
  pushTokens: "Dispositivi delle notifiche",
  banCount: "Numero di sanzioni",
  suspendedUntil: "Sospensione fino a",
  suspensionReason: "Motivo della sospensione",
  suspensionStartAt: "Inizio sospensione",
  suspensionViolationType: "Tipo di violazione",
  flaggedMessages: "Messaggi segnalati",
  lastViolationAt: "Ultima violazione",
  accountDisabled: "Account disabilitato",
  accountDisabledAt: "Data disabilitazione",
};

export default function Controllo() {
  const { user, loading } = useAuth();
  const [esito, setEsito] = useState(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    setSEO({ title: "Controllo", description: "Pagina di servizio.", type: "website" });
    return () => resetSEO();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    let annullato = false;

    (async () => {
      try {
        const leggi = async (percorso) => {
          try {
            const s = await getDoc(doc(db, ...percorso));
            return { esiste: s.exists(), dati: s.exists() ? s.data() : null };
          } catch (e) {
            return { esiste: false, errore: e?.code || e?.message };
          }
        };

        const [profilo, contatto, moderazione, dispositivi, classifica] = await Promise.all([
          leggi(["users", user.uid]),
          leggi(["contattiUtenti", user.uid]),
          leggi(["moderazione", user.uid]),
          leggi(["tokenDispositivi", user.uid]),
          leggi(["classifica", user.uid]),
        ]);

        const campiProfilo = profilo.dati ? Object.keys(profilo.dati) : [];
        const rimasti = campiProfilo.filter((c) => FUORI_DAL_PROFILO[c]);

        if (!annullato) {
          setEsito({ campiProfilo, rimasti, contatto, moderazione, dispositivi, classifica });
        }
      } catch (e) {
        if (!annullato) setErrore(e?.message || "Controllo non riuscito");
      }
    })();

    return () => {
      annullato = true;
    };
  }, [user?.uid]);

  if (loading) return <Schermo>Un attimo…</Schermo>;

  if (!user) {
    return (
      <Schermo>
        Devi accedere per vedere questa pagina.{" "}
        <Link to="/login" className="text-accent hover:underline">Vai all'accesso</Link>
      </Schermo>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <Schermo>
        Questa pagina è riservata.{" "}
        <Link to="/" className="text-accent hover:underline">Torna alla home</Link>
      </Schermo>
    );
  }

  if (errore) return <Schermo>{errore}</Schermo>;
  if (!esito) return <Schermo>Sto controllando…</Schermo>;

  const tuttoPulito = esito.rimasti.length === 0;

  return (
    <main className="bg-bg-base text-text-primary min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1
          className="text-4xl text-text-primary leading-none mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          CONTROLLO DATI
        </h1>
        <p className="text-text-secondary text-sm mb-10">
          Legge solo i documenti del tuo account, per verificare che gli
          spostamenti siano andati a buon fine.
        </p>

        <Riquadro
          buono={tuttoPulito}
          titolo={
            tuttoPulito
              ? "Il profilo pubblico è pulito"
              : `${esito.rimasti.length} dato/i ancora nel profilo pubblico`
          }
        >
          {tuttoPulito ? (
            <p>
              Nessun dato riservato è rimasto nel documento leggibile da tutti.
            </p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {esito.rimasti.map((c) => (
                <li key={c}>{FUORI_DAL_PROFILO[c]}</li>
              ))}
            </ul>
          )}
        </Riquadro>

        <div className="mt-8 space-y-3">
          <Voce
            nome="Indirizzo email al riparo"
            stato={esito.contatto.esiste}
            dettaglio={esito.contatto.esiste ? "salvato fuori dal profilo" : "non ancora spostato"}
          />
          <Voce
            nome="Voce di classifica"
            stato={esito.classifica.esiste}
            dettaglio={
              esito.classifica.esiste
                ? `punti quiz: ${esito.classifica.dati?.puntiQuiz ?? 0}`
                : "non ancora creata"
            }
          />
          <Voce
            nome="Dispositivi delle notifiche"
            stato={esito.dispositivi.esiste}
            dettaglio={
              esito.dispositivi.esiste
                ? `${(esito.dispositivi.dati?.pushTokens || []).length} registrati`
                : "nessuno su questo account (normale se non hai attivato le notifiche)"
            }
            facoltativo
          />
          <Voce
            nome="Stato di moderazione"
            stato={esito.moderazione.esiste}
            dettaglio={
              esito.moderazione.esiste
                ? `sanzioni: ${esito.moderazione.dati?.banCount ?? 0}`
                : "nessuna sanzione registrata"
            }
            facoltativo
          />
        </div>

        <details className="mt-10">
          <summary className="cursor-pointer text-sm text-text-muted hover:text-text-secondary">
            Campi presenti nel profilo pubblico ({esito.campiProfilo.length})
          </summary>
          <p className="mt-3 text-xs text-text-muted font-mono break-words leading-relaxed">
            {esito.campiProfilo.join(" · ")}
          </p>
        </details>

        <div className="mt-12">
          <Link to="/admin" className="text-accent hover:underline text-sm">
            ← Torna al pannello
          </Link>
        </div>
      </div>
    </main>
  );
}

function Schermo({ children }) {
  return (
    <main className="bg-bg-base text-text-primary min-h-screen flex items-center justify-center px-6">
      <p className="text-text-secondary text-center">{children}</p>
    </main>
  );
}

function Riquadro({ buono, titolo, children }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        buono ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"
      }`}
    >
      <h2 className={`font-bold mb-2 ${buono ? "text-success" : "text-warning"}`}>{titolo}</h2>
      <div className="text-sm text-text-secondary">{children}</div>
    </div>
  );
}

function Voce({ nome, stato, dettaglio, facoltativo }) {
  const colore = stato ? "text-success" : facoltativo ? "text-text-muted" : "text-warning";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-surface/50 px-4 py-3">
      <span className={`font-bold ${colore}`}>{stato ? "✓" : facoltativo ? "–" : "!"}</span>
      <span>
        <span className="block text-sm font-semibold text-text-primary">{nome}</span>
        <span className="block text-xs text-text-muted">{dettaglio}</span>
      </span>
    </div>
  );
}
