/* ─────────────────────────────────────────────────────────────
   src/utils/classifica.js
   La voce pubblica di ogni tifoso in classifica.

   PERCHÉ ESISTE QUESTA COLLECTION
   La classifica è una pagina pubblica e prima si costruiva scorrendo
   l'intero elenco degli iscritti. Per funzionare, quell'elenco doveva
   essere leggibile da chiunque — e insieme ai punti veniva fuori tutto
   il resto: indirizzi email, nome e cognome, storico delle sanzioni,
   identificativi dei dispositivi. Verificato in produzione il
   24/08/2026: bastava una richiesta, senza alcun accesso.

   Ora l'elenco degli iscritti è chiuso e la classifica legge di qui,
   dove c'è soltanto ciò che la classifica mostra davvero: un nome, una
   foto e i punti del quiz. Ogni tifoso scrive solo la propria voce.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/** Aggiorna (o crea) la voce di classifica di un tifoso. */
export async function aggiornaVoceClassifica(uid, { nome, foto, puntiQuiz } = {}) {
  if (!uid) return;
  const dati = { aggiornatoIl: serverTimestamp() };
  if (nome !== undefined) dati.nome = nome || null;
  if (foto !== undefined) dati.foto = foto || null;
  if (puntiQuiz !== undefined) dati.puntiQuiz = Number(puntiQuiz) || 0;
  try {
    await setDoc(doc(db, "classifica", uid), dati, { merge: true });
  } catch (e) {
    // Non deve mai bloccare quello che l'utente stava facendo:
    // al massimo la classifica si allinea al passaggio successivo.
    console.warn("Voce di classifica non aggiornata:", e?.message);
  }
}

/**
 * Riallinea la voce leggendo il profilo dell'interessato.
 * Viene richiamata a ogni accesso: così le voci restano aggiornate se
 * uno cambia nome o foto, e quelle dei profili creati prima di questa
 * collection si formano da sole senza migrazioni manuali.
 */
export async function sincronizzaVoceClassifica(uid) {
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const u = snap.data();
    await aggiornaVoceClassifica(uid, {
      nome: u.username || u.displayName || null,
      foto: u.photoURL || null,
      puntiQuiz: u.quizPoints || 0,
    });
  } catch (e) {
    console.warn("Classifica non sincronizzata:", e?.message);
  }
}
