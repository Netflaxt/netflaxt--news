/* ─────────────────────────────────────────────────────────────
   Netflaxt — Invio notifiche push
   Il pannello admin mette i messaggi in coda su Firestore
   (`pushQueue`), ma finché nessuno la svuota le notifiche non
   partono mai. Questo modulo è il pezzo mancante: legge la coda,
   spedisce tramite Firebase Cloud Messaging e segna l'esito.

   Gira dentro il Worker del live poller (stesso cron da 2 minuti,
   stesso service account), così non serve un secondo deploy.

   Struttura di un messaggio in coda:
     { title, body, url, audience: "all" | "subscribed-only",
       status: "queued" | "sent" | "failed", createdAt }
   ───────────────────────────────────────────────────────────── */

// Cloudflare (piano gratuito) consente un numero limitato di chiamate
// esterne per esecuzione: restiamo prudenti e, se i destinatari sono
// tanti, proseguiamo al giro successivo invece di essere interrotti.
const MAX_INVII_PER_GIRO = 35;
const MAX_MESSAGGI_PER_GIRO = 3;

/**
 * Svuota la coda delle notifiche.
 * @param helpers funzioni Firestore condivise col poller
 *        (passate come argomento per non creare import circolari)
 */
/**
 * Diagnostica: quali dispositivi riceverebbero davvero una notifica.
 * Restituisce solo conteggi aggregati per tipo di dispositivo — nessun
 * dato personale, perché l'indirizzo del Worker è pubblico.
 */
export async function diagnosticaPush(auth, helpers) {
  const { runQuery, fval } = helpers;
  const utenti = await runQuery(auth, { from: [{ collectionId: "users" }], limit: 2000 });

  const perTipo = {};
  let conToken = 0;
  let tokenTotali = 0;
  const limite = Date.now() - GIORNI_ATTIVITA * 24 * 60 * 60 * 1000;
  let attiviRecenti = 0;

  for (const u of utenti) {
    const arr = u.fields.pushTokens?.arrayValue?.values;
    if (!Array.isArray(arr) || !arr.length) continue;
    conToken++;
    const recente = (fval(u.fields.lastSeenAt) || 0) >= limite;
    if (recente) attiviRecenti++;
    for (const v of arr) {
      const f = v?.mapValue?.fields || {};
      if (!f.token?.stringValue) continue;
      tokenTotali++;
      const ua = f.ua?.stringValue || "";
      const tipo = /iPhone|iPad|iPod/i.test(ua)
        ? "iPhone/iPad"
        : /Android/i.test(ua)
        ? "Android"
        : /Windows/i.test(ua)
        ? "Windows"
        : /Mac/i.test(ua)
        ? "Mac"
        : "altro";
      perTipo[tipo] = (perTipo[tipo] || 0) + 1;
    }
  }

  return {
    utentiTotali: utenti.length,
    utentiConNotificheAttive: conToken,
    diCuiAttiviUltimi30gg: attiviRecenti,
    dispositiviRegistrati: tokenTotali,
    perTipoDispositivo: perTipo,
  };
}

export async function processPushQueue(env, auth, helpers) {
  const { runQuery, patchDoc, fval } = helpers;

  const inCoda = await runQuery(auth, {
    from: [{ collectionId: "pushQueue" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "status" },
        op: "EQUAL",
        value: { stringValue: "queued" },
      },
    },
    limit: MAX_MESSAGGI_PER_GIRO,
  });

  if (!inCoda.length) return { push: "coda vuota" };

  const esiti = [];
  for (const msg of inCoda) {
    esiti.push(await inviaMessaggio(env, auth, helpers, msg, { patchDoc, fval }));
  }
  return { push: esiti };
}

async function inviaMessaggio(env, auth, helpers, msg, { patchDoc, fval }) {
  const { runQuery } = helpers;
  const titolo = fval(msg.fields.title) || "Netflaxt News";
  const testo = fval(msg.fields.body) || "";
  const url = fval(msg.fields.url) || "/";
  const audience = fval(msg.fields.audience) || "all";
  // Se il messaggio era già partito in parte, riprendiamo da dove eravamo
  const giaInviati = Number(fval(msg.fields.sentCount) ?? 0);

  // 1) Raccogli i destinatari (token dei dispositivi registrati)
  let destinatari;
  try {
    destinatari = await raccogliToken(auth, runQuery, fval, audience);
  } catch (e) {
    await patchDoc(auth, `pushQueue/${msg.id}`, {
      status: "failed",
      error: `lettura destinatari: ${e.message}`.slice(0, 300),
      sentAt: new Date(),
    });
    return { id: msg.id, errore: e.message };
  }

  if (!destinatari.length) {
    await patchDoc(auth, `pushQueue/${msg.id}`, {
      status: "sent",
      sentCount: 0,
      failedCount: 0,
      sentAt: new Date(),
      note: "nessun dispositivo registrato",
    });
    return { id: msg.id, destinatari: 0 };
  }

  // 2) Spedisci, un blocco alla volta
  const blocco = destinatari.slice(giaInviati, giaInviati + MAX_INVII_PER_GIRO);
  let ok = 0;
  let ko = 0;
  for (const token of blocco) {
    const esito = await inviaFcm(auth, token, { titolo, testo, url });
    if (esito) ok++;
    else ko++;
  }

  const totaleInviati = giaInviati + blocco.length;
  const finito = totaleInviati >= destinatari.length;

  // 3) Segna l'esito: se restano destinatari, il messaggio resta in coda
  //    e riparte al ciclo successivo dal punto giusto.
  await patchDoc(auth, `pushQueue/${msg.id}`, {
    status: finito ? "sent" : "queued",
    sentCount: totaleInviati,
    failedCount: ko,
    ...(finito ? { sentAt: new Date() } : {}),
  });

  return { id: msg.id, destinatari: destinatari.length, inviati: ok, falliti: ko, completato: finito };
}

/* Raccoglie i token dei dispositivi dagli utenti.
   "subscribed-only" nel pannello admin significa "solo chi è attivo da
   meno di 30 giorni", quindi filtriamo su lastSeenAt.

   NB: su Firestore `pushTokens` è un elenco di OGGETTI
   { token, ua, createdAt }, non di semplici stringhe: il token vero sta
   dentro il campo `token`. */
const GIORNI_ATTIVITA = 30;

async function raccogliToken(auth, runQuery, fval, audience) {
  const utenti = await runQuery(auth, {
    from: [{ collectionId: "users" }],
    limit: 2000,
  });

  const limite = Date.now() - GIORNI_ATTIVITA * 24 * 60 * 60 * 1000;
  const token = new Set();

  for (const u of utenti) {
    if (audience === "subscribed-only") {
      const ultimoAccesso = fval(u.fields.lastSeenAt);
      if (!ultimoAccesso || ultimoAccesso < limite) continue;
    }
    const arr = u.fields.pushTokens?.arrayValue?.values;
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      const t = v?.mapValue?.fields?.token?.stringValue || v?.stringValue;
      if (t) token.add(t);
    }
  }
  return [...token];
}

/* Invio singolo tramite FCM HTTP v1. Ritorna true se accettato. */
async function inviaFcm(auth, token, { titolo, testo, url }) {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`;
  const body = {
    message: {
      token,
      notification: { title: titolo, body: testo },
      webpush: {
        notification: {
          title: titolo,
          body: testo,
          icon: "/icon-192.png",
          badge: "/favicon-32.png",
        },
        fcm_options: { link: assolutizza(url) },
      },
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return true;
    // 404/403 = token non più valido (app disinstallata, permesso revocato):
    // non è un errore da segnalare, semplicemente quel dispositivo non c'è più.
    return false;
  } catch {
    return false;
  }
}

/* Il link della notifica deve essere assoluto, altrimenti il click non apre nulla */
function assolutizza(url) {
  if (/^https?:\/\//i.test(url)) return url;
  const base = "https://netflaxt-news.web.app";
  return base + (url.startsWith("/") ? url : `/${url}`);
}
