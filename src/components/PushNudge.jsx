/* ─────────────────────────────────────────────────────────────
   src/components/PushNudge.jsx
   Invito discreto ad attivare le notifiche: molti tifosi non sanno
   che esistono e si perdono gol e notizie.

   Regole di educazione (per non risultare invadenti):
     • solo a chi ha fatto l'accesso
     • solo se il browser le supporta e l'utente non ha ancora deciso
       (se ha già detto sì o no al browser, non lo disturbiamo)
     • non subito: compare dopo qualche secondo di permanenza
     • "Non ora" = silenzio per 21 giorni
     • una volta attivate, non ricompare mai più

   Su iPhone le notifiche web funzionano solo con l'app installata
   sulla schermata Home: in quel caso invitiamo a installarla.
   ───────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isPushSupported, currentPermission, enablePush } from "../utils/push";
import { BellIcon } from "./icons";

const RINVIO_KEY = "netflaxt:pushNudgeRinviato";
const GIORNI_SILENZIO = 21;
const ATTESA_MS = 12000; // lascia prima guardare il sito

function rinviatoDiRecente() {
  try {
    const t = Number(localStorage.getItem(RINVIO_KEY) || 0);
    return t && Date.now() - t < GIORNI_SILENZIO * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// iPhone/iPad fuori dall'app installata: le push non sono disponibili
function iosNonInstallato() {
  if (typeof window === "undefined") return false;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installato =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  return iOS && !installato;
}

export default function PushNudge() {
  const { user } = useAuth();
  const [visibile, setVisibile] = useState(false);
  const [attivando, setAttivando] = useState(false);
  const [errore, setErrore] = useState("");
  const soloIstruzioniIos = iosNonInstallato();

  useEffect(() => {
    if (!user) return;
    if (rinviatoDiRecente()) return;
    // Se il browser non le supporta proprio, l'unico caso utile è
    // l'iPhone senza app installata: lì spieghiamo come fare.
    if (!isPushSupported() && !soloIstruzioniIos) return;
    if (isPushSupported() && currentPermission() !== "default") return;

    const t = setTimeout(() => setVisibile(true), ATTESA_MS);
    return () => clearTimeout(t);
  }, [user, soloIstruzioniIos]);

  const rinvia = () => {
    try {
      localStorage.setItem(RINVIO_KEY, String(Date.now()));
    } catch {
      /* localStorage non disponibile: pazienza, riproverà */
    }
    setVisibile(false);
  };

  const attiva = async () => {
    setAttivando(true);
    setErrore("");
    try {
      await enablePush(user.uid);
      setVisibile(false);
    } catch (e) {
      setErrore(e?.message || "Non è stato possibile attivarle");
    } finally {
      setAttivando(false);
    }
  };

  if (!visibile) return null;

  return (
    <div data-no-twemoji className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] px-2 w-[94vw] max-w-md nf-pwa-toast-in">
      <div className="rounded-xl bg-bg-surface border border-accent/40 shadow-[0_16px_44px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 grid place-items-center">
              <BellIcon className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text-primary">
                Non perderti nemmeno un gol
              </h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                {soloIstruzioniIos
                  ? "Per ricevere le notifiche su iPhone devi aggiungere Netflaxt alla schermata Home: tocca Condividi e poi «Aggiungi a schermata Home»."
                  : "Attiva le notifiche e ti avvisiamo quando la Lazio segna e quando esce una notizia."}
              </p>
              {errore && (
                <p className="mt-2 text-xs text-error font-semibold">{errore}</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={rinvia}
              className="px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary transition"
            >
              Non ora
            </button>
            {!soloIstruzioniIos && (
              <button
                onClick={attiva}
                disabled={attivando}
                className="px-4 py-2 rounded-md bg-accent text-white text-[11px] font-bold uppercase tracking-wider hover:bg-accent-hover transition disabled:opacity-60"
              >
                {attivando ? "Attivo…" : "Attiva"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
