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

  /* Token e indirizzi non stanno più nel profilo: erano leggibili da
     chiunque. Si leggono dalle rispettive collection riservate — con lo
     STESSO ripiego usato dall'invio vero, altrimenti questa diagnostica
     direbbe "nessun dispositivo" mentre le notifiche partono regolarmente
     dal vecchio percorso: un numero falso è peggio di nessun numero. */
  const { elenchi: elenchiToken, campoData } = await leggiElenchiToken(auth, runQuery);
  const contatti = await runQuery(auth, {
    from: [{ collectionId: "contattiUtenti" }],
    limit: 2000,
  });

  const perTipo = {};
  const dettagli = [];
  let conToken = 0;
  let tokenTotali = 0;
  /* Senza un indirizzo salvato, l'email di conferma accesso non saprebbe
     a chi essere spedita. Gli account che non hanno ancora fatto un
     accesso da quando è cambiato lo spostano al primo collegamento. */
  const senzaEmail = Math.max(0, utenti.length - contatti.length);
  const limite = Date.now() - GIORNI_ATTIVITA * 24 * 60 * 60 * 1000;
  let attiviRecenti = 0;

  for (const u of elenchiToken) {
    const arr = u.fields.pushTokens?.arrayValue?.values;
    if (!Array.isArray(arr) || !arr.length) continue;
    conToken++;
    const recente = (fval(u.fields[campoData]) || 0) >= limite;
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
      dettagli.push({
        tipo,
        registratoIl: (f.createdAt?.stringValue || "").slice(0, 16).replace("T", " "),
        // utile per capire se il dispositivo ha aperto l'app installata
        // (su iPhone le notifiche funzionano solo da app in schermata Home)
        browser: /CriOS/i.test(ua) ? "Chrome iOS" : /Safari/i.test(ua) ? "Safari/PWA" : "altro",
      });
    }
  }

  return {
    utentiTotali: utenti.length,
    utentiSenzaIndirizzoEmail: senzaEmail,
    utentiConNotificheAttive: conToken,
    diCuiAttiviUltimi30gg: attiviRecenti,
    dispositiviRegistrati: tokenTotali,
    perTipoDispositivo: perTipo,
    dettagli,
  };
}

/* Quanto tenere in archivio le notifiche già spedite. Servono a vedere lo
   storico nel pannello, ma oltre un certo punto sono solo peso inutile. */
const GIORNI_ARCHIVIO = 14;

/**
 * Svuota la coda dalle notifiche vecchie già spedite.
 * Senza, la collection cresce all'infinito: ogni gol, ogni notizia e ogni
 * partita lasciano un documento, e nel giro di una stagione diventano
 * migliaia — con letture più lente e spazio sprecato.
 */
async function pulisciArchivio(auth, helpers) {
  const { runQuery, eliminaDoc } = helpers;
  if (!eliminaDoc) return 0;

  const limite = Date.now() - GIORNI_ARCHIVIO * 24 * 60 * 60 * 1000;

  /* Una sola condizione nella ricerca (lo stato), la data la
     controlliamo qui sotto. Combinare due condizioni obbligherebbe a
     creare un indice apposta su Firestore: senza, l'intera lettura
     fallisce e con essa TUTTE le notifiche (successo il 24/08/2026). */
  const spedite = await runQuery(auth, {
    from: [{ collectionId: "pushQueue" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "status" },
        op: "EQUAL",
        value: { stringValue: "sent" },
      },
    },
    limit: 40,
  });

  let tolte = 0;
  for (const m of spedite) {
    const quando = helpers.fval(m.fields.createdAt);
    if (!quando || quando >= limite) continue; // ancora recente: si tiene
    if (await eliminaDoc(auth, `pushQueue/${m.id}`)) tolte++;
    if (tolte >= 20) break; // poche per volta: il lavoro vero è la partita
  }
  return tolte;
}

export async function processPushQueue(env, auth, helpers) {
  const { runQuery, patchDoc, fval } = helpers;

  const perStato = (stato) =>
    runQuery(auth, {
      from: [{ collectionId: "pushQueue" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "status" },
          op: "EQUAL",
          value: { stringValue: stato },
        },
      },
      limit: MAX_MESSAGGI_PER_GIRO,
    });

  // Messaggi da spedire + eventuali rimasti appesi in "sending" (se il
  // Worker si è interrotto a metà invio), recuperati dopo 15 minuti.
  const nuovi = await perStato("queued");
  const appesi = (await perStato("sending")).filter((m) => {
    const da = fval(m.fields.sendingAt);
    return !da || Date.now() - da > 15 * 60 * 1000;
  });
  const inCoda = [...nuovi, ...appesi].slice(0, MAX_MESSAGGI_PER_GIRO);

  if (!inCoda.length) {
    // Nessuna notifica da spedire: è il momento buono per fare pulizia
    const tolte = await pulisciArchivio(auth, helpers);
    return tolte ? { push: "coda vuota", archiviateRimosse: tolte } : { push: "coda vuota" };
  }

  const esiti = [];
  for (const msg of inCoda) {
    // Prendiamo in carico il messaggio PRIMA di spedirlo: se per qualsiasi
    // motivo il Worker parte due volte ravvicinate, la seconda esecuzione
    // non lo trova più fra i "queued" e non lo rispedisce.
    try {
      await patchDoc(auth, `pushQueue/${msg.id}`, {
        status: "sending",
        sendingAt: new Date(),
      });
    } catch {
      continue; // preso in carico da un'altra esecuzione: lo saltiamo
    }
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
  let ultimoErrore = null;
  let ripuliti = 0;
  for (const { token, uid } of blocco) {
    // Stesso tag per tutti i dispositivi dello stesso messaggio, diverso
    // fra un messaggio e l'altro (usiamo l'id del documento in coda).
    const esito = await inviaFcm(auth, token, { titolo, testo, url, tag: msg.id });
    if (esito.ok) ok++;
    else {
      ko++;
      ultimoErrore = esito.dettaglio || `HTTP ${esito.stato}`;
      // 404 = il dispositivo non esiste più: togliamolo dall'elenco,
      // così non ci riproviamo a ogni invio.
      if (esito.stato === 404) {
        await rimuoviTokenMorto(auth, uid, token, helpers);
        ripuliti++;
      }
    }
  }

  const totaleInviati = giaInviati + blocco.length;
  const finito = totaleInviati >= destinatari.length;

  // 3) Segna l'esito: se restano destinatari, il messaggio resta in coda
  //    e riparte al ciclo successivo dal punto giusto.
  await patchDoc(auth, `pushQueue/${msg.id}`, {
    status: finito ? "sent" : "queued",
    sentCount: totaleInviati,
    failedCount: ko,
    ...(ultimoErrore ? { error: String(ultimoErrore).slice(0, 300) } : {}),
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

/* Da dove si leggono i dispositivi collegati alle notifiche.

   Stavano nel profilo, che è pubblico: dall'elenco si capiva quanti
   dispositivi ha una persona e di che tipo. Ora vivono in
   `tokenDispositivi`, non leggibile da fuori.
   Il ripiego sul vecchio percorso serve finché tutti non hanno riaperto
   l'app almeno una volta: senza, chi non l'ha ancora fatto smetterebbe
   di ricevere notifiche senza che nessuno se ne accorga. */
async function leggiElenchiToken(auth, runQuery) {
  const nuovi = await runQuery(auth, {
    from: [{ collectionId: "tokenDispositivi" }],
    limit: 2000,
  });
  if (nuovi.length) return { elenchi: nuovi, campoData: "ultimoAccesso" };
  const vecchi = await runQuery(auth, { from: [{ collectionId: "users" }], limit: 2000 });
  return { elenchi: vecchi, campoData: "lastSeenAt" };
}

async function raccogliToken(auth, runQuery, fval, audience) {
  const { elenchi, campoData } = await leggiElenchiToken(auth, runQuery);

  const limite = Date.now() - GIORNI_ATTIVITA * 24 * 60 * 60 * 1000;
  // Teniamo anche a chi appartiene ogni token: serve per poterlo
  // cancellare quando il dispositivo non esiste più.
  const visti = new Map(); // token -> uid

  for (const u of elenchi) {
    if (audience === "subscribed-only") {
      const ultimoAccesso = fval(u.fields[campoData]);
      if (!ultimoAccesso || ultimoAccesso < limite) continue;
    }
    const arr = u.fields.pushTokens?.arrayValue?.values;
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      const t = v?.mapValue?.fields?.token?.stringValue || v?.stringValue;
      if (t && !visti.has(t)) visti.set(t, u.id);
    }
  }
  return [...visti.entries()].map(([token, uid]) => ({ token, uid }));
}

/* Elimina dal profilo dell'utente un dispositivo che non esiste più
   (app disinstallata, notifiche revocate, sottoscrizione scaduta).
   Senza questa pulizia i collegamenti morti si accumulano e ogni invio
   spreca chiamate verso destinatari inesistenti. */
async function rimuoviTokenMorto(auth, uid, tokenMorto, helpers) {
  if (!uid || !tokenMorto) return;
  const { leggiDoc, patchDoc } = helpers;
  try {
    const doc = await leggiDoc(auth, `tokenDispositivi/${uid}`);
    const arr = doc?.fields?.pushTokens?.arrayValue?.values;
    if (!Array.isArray(arr)) return;

    // Togliamo il token morto e, già che ci siamo, eventuali doppioni
    const tenuti = [];
    const giaVisti = new Set();
    for (const v of arr) {
      const f = v?.mapValue?.fields || {};
      const t = f.token?.stringValue || v?.stringValue;
      if (!t || t === tokenMorto || giaVisti.has(t)) continue;
      giaVisti.add(t);
      tenuti.push({
        token: t,
        ua: f.ua?.stringValue || "",
        createdAt: f.createdAt?.stringValue || "",
      });
    }
    if (tenuti.length === arr.length) return; // niente da cambiare

    await patchDoc(auth, `tokenDispositivi/${uid}`, { pushTokens: tenuti });
  } catch (e) {
    console.error("pulizia token fallita:", e.message);
  }
}

/* Invio singolo tramite FCM HTTP v1. Ritorna { ok, stato, dettaglio }.

   IMPORTANTE — il messaggio contiene il campo `notification`, quindi è il
   browser stesso a mostrarla. Il service worker NON deve mostrarne un'altra
   (vedi firebase-messaging-sw.js), altrimenti se ne vedono due.
   Non usiamo messaggi di soli dati perché su iPhone non sono affidabili:
   iOS pretende che a ogni push corrisponda una notifica visibile. */
async function inviaFcm(auth, token, { titolo, testo, url, tag }) {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`;
  const link = assolutizza(url);
  const body = {
    message: {
      token,
      notification: { title: titolo, body: testo },
      data: { url: link },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title: titolo,
          body: testo,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          // tag diverso per messaggio: due notifiche di seguito restano
          // entrambe visibili invece di sostituirsi a vicenda
          tag: tag || `netflaxt-${Date.now()}`,
        },
        fcm_options: { link },
      },
    },
  };

  /* Un tentativo in più sugli errori PASSEGGERI (server occupato, limite
     di frequenza, rete). Senza, un intoppo momentaneo di Firebase faceva
     perdere la notifica per sempre su quel dispositivo.
     Non si riprova sugli errori definitivi (404 = dispositivo inesistente,
     403 = permessi): sarebbe solo tempo sprecato. */
  const passeggero = (stato) => stato === 429 || (stato >= 500 && stato <= 599);

  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true };

      // Teniamo il motivo: senza, un invio fallito è invisibile e diventa
      // impossibile capire perché le notifiche non arrivano.
      const dettaglio = (await res.text()).slice(0, 300);
      if (passeggero(res.status) && tentativo === 1) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      console.error(`FCM ${res.status}: ${dettaglio}`);
      return { ok: false, stato: res.status, dettaglio };
    } catch (e) {
      if (tentativo === 1) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return { ok: false, dettaglio: e.message };
    }
  }
  return { ok: false, dettaglio: "invio non riuscito" };
}

/* Invio di prova verso tutti i dispositivi registrati, con esito
   dettagliato. Serve per capire cosa risponde davvero FCM. */
export async function inviaProva(auth, helpers, testo) {
  const { runQuery, fval } = helpers;
  const destinatari = await raccogliToken(auth, runQuery, fval, "all");
  if (!destinatari.length) return { errore: "nessun dispositivo registrato" };

  const esiti = [];
  let ripuliti = 0;
  for (const { token, uid } of destinatari) {
    const r = await inviaFcm(auth, token, {
      titolo: "🦅 Prova Netflaxt",
      testo: testo || "Se leggi questo, le notifiche funzionano!",
      url: "/",
      tag: `prova-${Date.now()}`,
    });
    // Dispositivo non più esistente: lo togliamo dall'elenco
    if (!r.ok && r.stato === 404 && helpers.leggiDoc) {
      await rimuoviTokenMorto(auth, uid, token, helpers);
      ripuliti++;
    }
    esiti.push({
      dispositivo: token.slice(0, 12) + "…",
      inviata: r.ok,
      ...(r.ok ? {} : { stato: r.stato, rimosso: r.stato === 404 }),
    });
  }
  return { destinatari: destinatari.length, esiti, dispositiviRimossi: ripuliti };
}

/* Il link della notifica deve essere assoluto, altrimenti il click non apre nulla */
function assolutizza(url) {
  if (/^https?:\/\//i.test(url)) return url;
  const base = "https://netflaxt-news.web.app";
  return base + (url.startsWith("/") ? url : `/${url}`);
}
