/* ─────────────────────────────────────────────────────────────
   src/utils/pagelle.js
   I voti dei tifosi ai giocatori, dopo ogni partita.

   COME SONO FATTI I DATI, e perché

     pagelle/{partita}
       giocatori[]  chi ha giocato davvero (lo scrive il servizio
                    automatico a fine gara, leggendo i minuti giocati)
       somme{}      somma dei voti ricevuti, giocatore per giocatore
       conteggi{}   quanti hanno votato quel giocatore
       senzaVoto{}  quanti hanno scelto "senza voto"

     pagelle/{partita}/voti/{tifoso}
       voti{}       i voti di una singola persona

   La media è `somme[g] / conteggi[g]`: una divisione fra due numeri già
   pronti. L'alternativa — rileggere tutti i voti per calcolarla — con
   cento tifosi non si nota, con mille sì, ed è il tipo di conto che
   cresce in silenzio finché non presenta il conto tutto insieme.

   Il "senza voto" NON entra nella media: un 6 di comodo e un "non
   giudicabile" sono due cose diverse, e mescolarle falserebbe proprio i
   giocatori entrati a fine partita.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  increment,
  serverTimestamp,
} from "firebase/firestore";

export const SENZA_VOTO = "sv";

/* Quanto restano in home dopo la partita.

   ⚠️ Si conta dall'orario della PARTITA, non da quando il documento è
   stato creato. Sono due cose diverse: se le pagelle vengono aperte in
   ritardo — perché il servizio partite non rispondeva, o perché le si
   riapre a mano — contare dalla creazione le terrebbe in home per un
   giorno intero a distanza di una settimana dalla gara. */
const ORE_IN_HOME = 24;

/**
 * Segue le pagelle più recenti, quelle che vanno mostrate in home.
 *
 * ⚠️ Legge dalla collection delle pagelle, NON dal calendario. La
 * lettura del calendario in home è limitata alle prossime partite e a
 * un'ora prima: una gara finita ieri sera ne è già fuori, e la scheda
 * non sarebbe mai comparsa.
 */
export function seguiUltimePagelle(cb, onErr) {
  const q = query(collection(db, "pagelle"), orderBy("aperteIl", "desc"), limit(1));
  return onSnapshot(
    q,
    (snap) => {
      const d = snap.docs[0];
      if (!d) return cb(null);
      const dati = { id: d.id, ...d.data() };

      // Chiuse a mano dal pannello: valgono più di qualsiasi scadenza
      if (dati.chiuse === true) return cb(null);

      /* Il ripiego su `aperteIl` serve solo alle pagelle aperte prima
         che salvassimo l'orario della partita. */
      const quando = dati.partitaIl?.toMillis?.() ?? dati.aperteIl?.toMillis?.() ?? 0;
      const scadute = quando && Date.now() - quando > ORE_IN_HOME * 60 * 60 * 1000;
      cb(scadute ? null : dati);
    },
    (e) => {
      console.warn("Pagelle non leggibili:", e?.message);
      onErr && onErr(e);
    }
  );
}

/** Segue le pagelle di una partita in tempo reale (medie comprese). */
export function seguiPagelle(matchId, cb, onErr) {
  if (!matchId) return () => {};
  return onSnapshot(
    doc(db, "pagelle", matchId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => {
      console.warn("Pagelle non leggibili:", e?.message);
      onErr && onErr(e);
    }
  );
}

/** I voti già dati da questa persona, o null se non ha ancora votato. */
export async function mieiVoti(matchId, uid) {
  if (!matchId || !uid) return null;
  try {
    const snap = await getDoc(doc(db, "pagelle", matchId, "voti", uid));
    return snap.exists() ? snap.data()?.voti || null : null;
  } catch (e) {
    console.warn("Voti personali non leggibili:", e?.message);
    return null;
  }
}

/**
 * Registra i voti di una persona e aggiorna i totali della partita.
 *
 * I due passaggi sono separati di proposito: prima il documento
 * personale (che vale come "ha votato"), poi i totali. Se il secondo
 * fallisce, il voto della persona resta salvato e non le viene chiesto
 * di rifarlo — mancherà solo dalla media, ed è il male minore.
 *
 * @param {Object} voti  { idGiocatore: 1..10 | "sv" }
 */
export async function inviaVoti(matchId, uid, voti) {
  if (!matchId || !uid || !voti) return { ok: false, motivo: "dati mancanti" };

  const gia = await mieiVoti(matchId, uid);
  if (gia) return { ok: false, motivo: "hai già votato questa partita" };

  await setDoc(doc(db, "pagelle", matchId, "voti", uid), {
    voti,
    creatoIl: serverTimestamp(),
  });

  /* I totali si aggiornano con degli incrementi, non riscrivendo il
     documento: due persone che votano nello stesso istante si sommano
     invece di sovrascriversi a vicenda. */
  const somme = {};
  const conteggi = {};
  const senzaVoto = {};
  for (const [idGiocatore, voto] of Object.entries(voti)) {
    if (voto === SENZA_VOTO) {
      senzaVoto[idGiocatore] = increment(1);
      continue;
    }
    const n = Number(voto);
    if (!Number.isFinite(n) || n < 1 || n > 10) continue;
    somme[idGiocatore] = increment(n);
    conteggi[idGiocatore] = increment(1);
  }

  try {
    await setDoc(doc(db, "pagelle", matchId), { somme, conteggi, senzaVoto }, { merge: true });
  } catch (e) {
    console.warn("Totali non aggiornati:", e?.message);
    return { ok: true, mediaAggiornata: false };
  }
  return { ok: true, mediaAggiornata: true };
}

/** Media di un giocatore, o null se non l'ha ancora votato nessuno. */
export function mediaDi(pagelle, idGiocatore) {
  const somma = Number(pagelle?.somme?.[idGiocatore] ?? 0);
  const quanti = Number(pagelle?.conteggi?.[idGiocatore] ?? 0);
  if (!quanti) return null;
  return somma / quanti;
}

/** Quante persone hanno votato in tutto (il massimo fra i giocatori). */
export function quantiHannoVotato(pagelle) {
  const conteggi = Object.values(pagelle?.conteggi || {}).map(Number);
  const senza = Object.values(pagelle?.senzaVoto || {}).map(Number);
  const tutti = [...conteggi, ...senza].filter(Number.isFinite);
  return tutti.length ? Math.max(...tutti) : 0;
}

/** Colore del voto: insufficiente, sufficiente, buono. */
export function coloreVoto(voto) {
  const n = Number(voto);
  if (!Number.isFinite(n)) return "var(--color-text-muted)";
  if (n < 6) return "var(--color-error)";
  if (n < 6.5) return "var(--color-warning)";
  return "var(--color-success)";
}
