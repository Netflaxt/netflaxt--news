/* ─────────────────────────────────────────────────────────────
   src/pages/admin/AdminNewsletterTab.jsx
   Scrittura e invio della newsletter agli iscritti.

   Il messaggio non parte da qui: viene messo in coda e spedito dal
   servizio automatico entro pochi minuti, come per le notifiche.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  accodaNewsletter,
  contaIscritti,
  storicoNewsletter,
} from "../../utils/newsletter";
import { MailIcon } from "../../components/icons";

export default function AdminNewsletterTab({ onToast }) {
  const [oggetto, setOggetto] = useState("");
  const [testo, setTesto] = useState("");
  const [link, setLink] = useState("https://netflaxt.it");
  const [iscritti, setIscritti] = useState(null);
  const [storico, setStorico] = useState([]);
  const [invio, setInvio] = useState(false);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [n, s] = await Promise.all([contaIscritti(), storicoNewsletter()]);
        setIscritti(n);
        setStorico(s);
      } catch (e) {
        console.error("Newsletter:", e);
        setIscritti(0);
      } finally {
        setCaricamento(false);
      }
    })();
  }, []);

  const invia = async (e) => {
    e.preventDefault();
    if (invio) return;

    // Una newsletter arriva nella posta di tutti: un invio per sbaglio
    // non si può richiamare indietro, quindi si conferma sempre.
    const conferma = window.confirm(
      `Stai per inviare "${oggetto.trim()}" a ${iscritti} ${
        iscritti === 1 ? "iscritto" : "iscritti"
      }.\n\nUna volta partita non si può annullare. Procedere?`
    );
    if (!conferma) return;

    setInvio(true);
    try {
      await accodaNewsletter({ subject: oggetto, body: testo, url: link });
      onToast?.("Newsletter in coda: partirà entro pochi minuti", "success");
      setOggetto("");
      setTesto("");
      setStorico(await storicoNewsletter());
    } catch (err) {
      onToast?.(err.message || "Errore durante l'invio", "danger");
    } finally {
      setInvio(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intestazione con numero iscritti */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
              Newsletter
            </div>
            <h2
              className="text-2xl text-text-primary mt-1"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Scrivi ai tifosi
            </h2>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent">
              {caricamento ? "…" : iscritti}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
              {iscritti === 1 ? "iscritto" : "iscritti"}
            </div>
          </div>
        </div>

        {!caricamento && iscritti === 0 && (
          <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs">
            Non c'è ancora nessun iscritto. Il modulo di iscrizione è in fondo
            alla home: finché nessuno si iscrive, non c'è nessuno a cui scrivere.
          </div>
        )}

        <form onSubmit={invia} className="mt-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
              Oggetto *
            </label>
            <input
              value={oggetto}
              onChange={(e) => setOggetto(e.target.value)}
              required
              maxLength={90}
              placeholder="Es. Bologna-Lazio 1-2: le pagelle"
              className="adminInput"
            />
            <p className="mt-1 text-[11px] text-text-muted">
              È la riga che si legge nella posta: chiara e breve funziona meglio.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
              Messaggio *
            </label>
            <textarea
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              required
              rows={8}
              placeholder={"Ciao tifoso,\n\nieri all'Olimpico…\n\nLascia una riga vuota per separare i paragrafi."}
              className="adminInput resize-y"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
              Link del pulsante
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://netflaxt.it/news/..."
              className="adminInput"
            />
            <p className="mt-1 text-[11px] text-text-muted">
              Dove porta il pulsante "Leggi su Netflaxt". Di norma l'articolo.
            </p>
          </div>

          <button
            type="submit"
            disabled={invio || iscritti === 0}
            className="w-full py-3 bg-accent text-white font-bold rounded-md hover:shadow-[0_0_28px_-4px_rgba(56,189,248,0.7)] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <MailIcon className="w-4 h-4" />
            {invio ? "Invio in corso…" : `Invia a ${iscritti ?? "…"} iscritti`}
          </button>
        </form>
      </div>

      {/* Storico invii */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-4">
          Invii precedenti
        </h3>
        {storico.length === 0 ? (
          <p className="text-sm text-text-secondary">Nessun invio finora.</p>
        ) : (
          <div className="space-y-2">
            {storico.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-lg bg-bg-elevated border border-border flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary truncate">
                    {m.subject}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    {m.createdAt?.toDate?.()?.toLocaleString?.("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) || "—"}
                  </div>
                </div>
                <StatoInvio messaggio={m} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatoInvio({ messaggio }) {
  const { status, sentCount, failedCount, error } = messaggio;
  const stili = {
    sent: "bg-success/10 border-success/30 text-success",
    queued: "bg-accent/10 border-accent/30 text-accent",
    sending: "bg-accent/10 border-accent/30 text-accent",
    failed: "bg-error/10 border-error/30 text-error",
  };
  const etichette = {
    sent: "Inviata",
    queued: "In partenza",
    sending: "Invio in corso",
    failed: "Non riuscita",
  };
  return (
    <div className="text-right">
      <span
        className={`inline-block px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-wider font-bold ${
          stili[status] || stili.queued
        }`}
      >
        {etichette[status] || status}
      </span>
      {sentCount > 0 && (
        <div className="mt-1 text-[11px] text-text-muted">
          {sentCount} {sentCount === 1 ? "consegnata" : "consegnate"}
          {failedCount > 0 && ` · ${failedCount} non riuscite`}
        </div>
      )}
      {error && (
        <div className="mt-1 text-[11px] text-error max-w-[220px] truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  );
}
