/* ─────────────────────────────────────────────────────────────
   src/utils/deviceApproval.js
   Approvazione dell'accesso da un dispositivo mai visto.

   Come funziona: al momento dell'accesso si guarda se questo
   dispositivo è già stato usato da questo account. Se è nuovo, l'accesso
   viene sospeso e all'indirizzo email dell'account arriva un messaggio
   con un link di conferma. Così, anche se qualcuno rubasse la password,
   non potrebbe entrare da casa sua senza avere accesso alla posta.

   ⚠️ DUE PROTEZIONI IMPORTANTI, da non rimuovere:

   1. Chi era già registrato PRIMA di questa funzione ha dispositivi
      salvati senza il campo `approved`. Vengono considerati approvati:
      diversamente, all'attivazione, tutti gli iscritti si sarebbero
      trovati chiusi fuori dal proprio account senza preavviso.

   2. Il PRIMO dispositivo di un account viene approvato da solo. Chi si
      registra adesso non ha ancora nessun dispositivo di fiducia da cui
      confermare: chiedergli l'approvazione lo bloccherebbe per sempre.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { getDeviceId } from "./devices";

const SERVIZIO = "https://netflaxt-live-poller.netflaxt.workers.dev";

/** Esito del controllo: "ok" | "attesa" | "errore" */
export async function verificaDispositivo(user) {
  if (!user?.uid) return { esito: "ok" };

  const deviceId = getDeviceId();
  const ref = doc(db, "users", user.uid, "devices", deviceId);
  const snap = await getDoc(ref);

  // Dispositivo già noto e non in attesa → si entra
  if (snap.exists() && snap.data()?.approved !== false) {
    return { esito: "ok" };
  }

  // In attesa di conferma. Due casi: un tentativo precedente non ancora
  // confermato, oppure un dispositivo disconnesso che prova a rientrare
  // (in quel caso il codice è stato azzerato e va rigenerato, altrimenti
  // l'email di conferma non potrebbe nemmeno partire).
  if (snap.exists() && snap.data()?.approved === false) {
    let token = snap.data()?.approvalToken;
    if (!token) {
      token = crypto.randomUUID();
      await setDoc(
        ref,
        { approvalToken: token, revoked: false, richiestoIl: serverTimestamp() },
        { merge: true }
      );
      await inviaEmailApprovazione(user.uid, deviceId);
    }
    return { esito: "attesa", token };
  }

  // Primo dispositivo in assoluto → approvato d'ufficio (vedi nota 2)
  const tutti = await getDocs(collection(db, "users", user.uid, "devices"));
  if (tutti.empty) {
    await setDoc(ref, { approved: true, approvedAt: serverTimestamp() }, { merge: true });
    return { esito: "ok" };
  }

  // Dispositivo nuovo su un account che ne ha già altri → serve conferma
  const token = crypto.randomUUID();
  await setDoc(
    ref,
    {
      approved: false,
      approvalToken: token,
      richiestoIl: serverTimestamp(),
    },
    { merge: true }
  );

  await inviaEmailApprovazione(user.uid, deviceId);
  return { esito: "attesa", token };
}

/** Chiede al servizio di spedire (o rispedire) l'email di conferma */
export async function inviaEmailApprovazione(uid, deviceId = getDeviceId()) {
  try {
    const res = await fetch(
      `${SERVIZIO}/?richiediApprovazione=${encodeURIComponent(uid)}&device=${encodeURIComponent(deviceId)}`
    );
    const dati = await res.json().catch(() => ({}));
    return !!dati.ok;
  } catch {
    return false;
  }
}

/** Il dispositivo è stato confermato nel frattempo? (per lo sblocco automatico) */
export async function dispositivoApprovato(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid, "devices", getDeviceId()));
    return snap.exists() && snap.data()?.approved !== false;
  } catch {
    return false;
  }
}
