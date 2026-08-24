/* ─────────────────────────────────────────────────────────────
   src/utils/datiPrivati.js
   Dati dell'account che NON devono stare nel profilo pubblico.

   Il documento in `users` alimenta profili, chat e commenti: per
   funzionare deve restare leggibile. L'indirizzo email salvato lì
   dentro era quindi alla portata di chiunque — verificato il
   24/08/2026 sul sito in produzione: senza nemmeno essere registrati
   si otteneva l'elenco completo degli iscritti con i loro indirizzi.

   Qui invece leggono solo l'interessato e l'amministratore. Il
   servizio automatico che spedisce le email di conferma accesso usa
   credenziali proprie e non passa dalle regole, quindi continua a
   leggerlo senza problemi.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  doc,
  setDoc,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Salva l'indirizzo dell'account al riparo dalla lettura pubblica.
 * Va chiamata quando l'utente è collegato: l'indirizzo arriva da
 * Firebase, non da quello che qualcuno ha digitato.
 */
export async function salvaIndirizzoAccount(uid, email) {
  if (!uid || !email) return;
  try {
    await setDoc(
      doc(db, "contattiUtenti", uid),
      { email, aggiornatoIl: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.warn("Indirizzo account non salvato:", e?.message);
    return;
  }

  /* Toglie la copia rimasta nel profilo pubblico da quando veniva
     salvata lì. Senza questo passaggio i profili già esistenti
     resterebbero esposti per sempre: si ripuliscono da soli al primo
     accesso di ciascuno. */
  try {
    await updateDoc(doc(db, "users", uid), { email: deleteField() });
  } catch {
    /* il profilo non esiste ancora, oppure era già pulito */
  }
}
