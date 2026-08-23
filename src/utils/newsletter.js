/* ─────────────────────────────────────────────────────────────
   src/utils/newsletter.js
   Gestione newsletter lato pannello admin.

   L'invio vero avviene nel Worker (scripts/live-poller/newsletter.js):
   qui il messaggio viene solo messo in coda su `newsletterQueue`, e il
   Worker lo spedisce entro pochi minuti tramite Resend.
   Stessa impostazione delle notifiche push.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

/** Quanti tifosi riceverebbero la newsletter adesso */
export async function contaIscritti() {
  const snap = await getDocs(collection(db, "newsletter"));
  return snap.size;
}

/** Mette la newsletter in coda: il Worker la spedirà entro pochi minuti */
export async function accodaNewsletter({ subject, body, url }) {
  if (!subject?.trim()) throw new Error("Serve un oggetto");
  if (!body?.trim()) throw new Error("Serve il testo del messaggio");

  return await addDoc(collection(db, "newsletterQueue"), {
    subject: subject.trim(),
    body: body.trim(),
    url: url?.trim() || "https://netflaxt.it",
    status: "queued",
    sentCount: 0,
    failedCount: 0,
    createdAt: serverTimestamp(),
  });
}

/** Storico degli invii, per vedere cos'è partito e com'è andato */
export async function storicoNewsletter(quante = 10) {
  const q = query(
    collection(db, "newsletterQueue"),
    orderBy("createdAt", "desc"),
    limit(quante)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Elenco degli iscritti (solo admin può leggerlo) */
export async function elencoIscritti() {
  const snap = await getDocs(collection(db, "newsletter"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}
