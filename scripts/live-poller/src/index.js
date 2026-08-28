/* ─────────────────────────────────────────────────────────────
   Netflaxt — Live poller (Cloudflare Worker)
   Ogni 2 minuti: se c'è una partita della Lazio in corso, legge da
   API-Football (minuto, recupero, stato, risultato) e scrive i campi
   live su Firestore. Il sito mostra il ticker in tempo reale (con
   interpolazione client-side per ticchettare ogni minuto).

   Economia chiamate: legge PRIMA da Firestore (gratis) se siamo nella
   finestra di una partita; SOLO in quel caso chiama API-Football
   (piano free 100/giorno) → ~75 chiamate per partita.

   Secret/vars (impostati con `wrangler secret put` / wrangler.toml):
     FIREBASE_SERVICE_ACCOUNT  (secret JSON)
     APIFOOTBALL_KEY           (secret)
     TEAM_ID                   (var, default 487 = SS Lazio)
   ───────────────────────────────────────────────────────────── */

import { processPushQueue, diagnosticaPush, inviaProva } from "./push.js";
import { processNewsletter, disiscrivi } from "./newsletter.js";
import {
  richiediApprovazione,
  confermaDispositivo,
  statoDispositivo,
} from "./accessi.js";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(eseguiTutto(env).catch((e) => console.error("errore:", e.message)));
  },
  /* Endpoint HTTP di servizio (diagnostica e prove manuali).

     PROTETTO DA CHIAVE. Senza, chiunque indovinasse questo indirizzo
     potrebbe mandare notifiche a tutti gli iscritti o esaurire la quota
     giornaliera di API-Football chiamandolo di continuo.
     Il funzionamento normale non passa di qui: avviene ogni 2 minuti
     tramite il cron, che non richiede alcuna chiave. */
  async fetch(req, env) {
    try {
      const q = new URL(req.url).searchParams;

      /* Cancellazione dalla newsletter: DEVE restare accessibile senza
         chiave, è il link in fondo alle email. Il codice personale
         contenuto nel link fa da lasciapassare. */
      if (q.get("disiscrivi")) {
        const auth = await getAccessToken(env);
        const esito = await disiscrivi(auth, { runQuery, eliminaDoc }, q.get("disiscrivi"));
        return json(esito, esito.ok ? 200 : 404, req);
      }

      /* Accesso da un dispositivo nuovo. Anche questi due senza chiave:
         il primo lo chiama il sito appena dopo il tentativo di accesso,
         il secondo è il link dentro l'email.
         Non sono aperti a chiunque: entrambi funzionano solo se esiste
         davvero una richiesta in attesa con il codice corrispondente. */
      if (q.get("richiediApprovazione")) {
        const auth = await getAccessToken(env);
        const esito = await richiediApprovazione(
          env,
          auth,
          { leggiDoc, fval, patchDoc },
          q.get("richiediApprovazione"),
          q.get("device")
        );
        return json(esito, esito.ok ? 200 : 400, req);
      }
      // La schermata di attesa chiede periodicamente se il dispositivo
      // e stato confermato, per sbloccarsi da sola.
      if (q.get("statoDispositivo")) {
        const auth = await getAccessToken(env);
        const esito = await statoDispositivo(
          auth,
          { leggiDoc, fval },
          q.get("statoDispositivo"),
          q.get("device")
        );
        return json(esito, 200, req);
      }
      if (q.get("confermaAccesso")) {
        const auth = await getAccessToken(env);
        const esito = await confermaDispositivo(
          auth,
          { runQuery, patchDoc },
          q.get("confermaAccesso"),
          q.get("u")
        );
        return json(esito, esito.ok ? 200 : 404, req);
      }

      const chiave = env.ADMIN_KEY;
      if (!chiave || q.get("key") !== chiave) {
        return json({ error: "accesso non autorizzato" }, 401);
      }
      /* Esito degli ultimi invii dell'email di conferma accesso. */
      if (q.get("diag") === "accessi") {
        const auth = await getAccessToken(env);
        const d = await leggiDoc(auth, "sistema/accessi");
        const righe = (d?.fields?.ultimi?.arrayValue?.values || [])
          .map((v) => v.stringValue)
          .filter(Boolean);
        return json({ ultimiInvii: righe.length ? righe : ["nessuna richiesta registrata"] });
      }
      /* Stato di un singolo account: serve a capire perché una persona
         non riesce a entrare, senza chiederle di fare prove alla cieca.
         Mostra i dispositivi registrati e se sono approvati — è lì che
         nascono i giri infiniti di conferma. */
      if (q.get("diag") === "utente" && q.get("email")) {
        const auth = await getAccessToken(env);
        const cercati = await runQuery(auth, {
          from: [{ collectionId: "contattiUtenti" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "email" },
              op: "EQUAL",
              value: { stringValue: q.get("email") },
            },
          },
          limit: 1,
        });
        if (!cercati.length) return json({ trovato: false, motivo: "nessun account con questo indirizzo" });

        const uid = cercati[0].id;
        const profilo = await leggiDoc(auth, `users/${uid}`);
        const dispositivi = await runQuery(auth, { from: [{ collectionId: "devices" }] }, `users/${uid}`);
        return json({
          trovato: true,
          nome: fval(profilo?.fields?.displayName) || "(senza nome)",
          iscrittoIl: (profilo?.fields?.createdAt?.timestampValue || "").slice(0, 16).replace("T", " "),
          quantiDispositivi: dispositivi.length,
          dispositivi: dispositivi.map((d) => ({
            descrizione: fval(d.fields.label) || "?",
            approvato: fval(d.fields.approved),
            revocato: fval(d.fields.revoked) === true,
            haCodiceInAttesa: !!fval(d.fields.approvalToken),
            richiestoIl: (d.fields.richiestoIl?.timestampValue || "").slice(0, 16).replace("T", " "),
            vistoIl: (d.fields.lastSeen?.timestampValue || "").slice(0, 16).replace("T", " "),
          })),
        });
      }

      /* Verifica quali dati sui giocatori il piano gratuito di
         API-Football ci lascia davvero leggere. Serve a progettare le
         pagelle su ciò che esiste, invece che su ciò che si spera.
         Consuma richieste: usare solo quando serve. */
      if (q.get("diag") === "giocatori" && q.get("fixture")) {
        const fid = q.get("fixture");
        const prova = async (percorso) => {
          try {
            const res = await fetch(`https://v3.football.api-sports.io/${percorso}`, {
              headers: { "x-apisports-key": env.APIFOOTBALL_KEY },
            });
            const d = await res.json();
            const err = d?.errors;
            const haErrori = err && (Array.isArray(err) ? err.length : Object.keys(err).length);
            return {
              stato: res.status,
              errori: haErrori ? err : null,
              risultati: Array.isArray(d.response) ? d.response.length : 0,
              assaggio: JSON.stringify(d.response?.[0] || null).slice(0, 700),
            };
          } catch (e) {
            return { errore: e.message };
          }
        };
        const quale = q.get('quale') || 'lineups';
        if (quale === 'players') return json({ giocatoriConMinuti: await prova(`fixtures/players?fixture=${fid}`) });
        return json({ formazioni: await prova(`fixtures/lineups?fixture=${fid}`) });
      }

      /* Toglie le pagelle dalla home prima della loro scadenza
         naturale. Non cancella nulla: i voti restano, smettono solo di
         comparire. */
      if (q.get("chiudiPagelle")) {
        const auth = await getAccessToken(env);
        await patchDoc(auth, `pagelle/${q.get("chiudiPagelle")}`, { chiuse: true });
        return json({ chiuse: q.get("chiudiPagelle") });
      }

      /* Apre le pagelle di una partita già finita. Serve per la prima
         volta e come rimedio se, a fine gara, la raccolta dei giocatori
         non fosse riuscita. */
      if (q.get("apriPagelle")) {
        const auth = await getAccessToken(env);
        const id = q.get("apriPagelle");
        const m = await leggiDoc(auth, `matches/${id}`);
        if (!m?.fields) return json({ errore: "partita non trovata" }, 404);
        const fixture = fval(m.fields.liveFixtureId);
        if (!fixture) return json({ errore: "questa partita non ha un collegamento al servizio" }, 400);
        const esito = await apriPagelle(
          auth,
          env,
          id,
          fixture,
          { casa: fval(m.fields.homeTeam), ospite: fval(m.fields.awayTeam), kickoff: fval(m.fields.kickoff) },
          `${fval(m.fields.homeScore) ?? ""} - ${fval(m.fields.awayScore) ?? ""}`
        );
        return json({ partita: id, ...esito });
      }

      if (q.get("diag") === "push") {
        const auth = await getAccessToken(env);
        return json(await diagnosticaPush(auth, { runQuery, fval }));
      }

      /* Stato della coda e ultimo giro del servizio: serve a capire se i
         messaggi restano fermi (cron bloccato) o se partono e basta. */
      if (q.get("diag") === "coda") {
        const auth = await getAccessToken(env);
        const messaggi = await runQuery(auth, {
          from: [{ collectionId: "pushQueue" }],
          orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
          limit: 15,
        });
        const battito = await leggiDoc(auth, "sistema/livePoller");
        const ultima = battito?.fields?.ultimaEsecuzione?.timestampValue;
        const oggiStr = new Date().toISOString().slice(0, 10);
        const apiData = battito?.fields?.apiData?.stringValue;
        const apiOggi = Number(battito?.fields?.apiOggi?.integerValue ?? 0);
        return json({
          ultimoGiroDelServizio: ultima || "mai",
          minutiDallUltimoGiro: ultima
            ? Math.round((Date.now() - new Date(ultima).getTime()) / 60000)
            : null,
          // Quante richieste sono state fatte al servizio delle partite:
          // il piano gratuito ne consente 100 al giorno.
          chiamateApiOggi: apiData === oggiStr ? apiOggi : 0,
          limiteGiornaliero: 100,
          messaggi: messaggi.map((m) => ({
            titolo: fval(m.fields.title),
            stato: fval(m.fields.status),
            inviate: fval(m.fields.sentCount),
            fallite: fval(m.fields.failedCount),
            errore: fval(m.fields.error),
            creato: (m.fields.createdAt?.timestampValue || "").slice(0, 16).replace("T", " "),
          })),
        });
      }
      // Invio di prova con esito dettagliato: ?prova=push
      if (q.get("prova") === "push") {
        const auth = await getAccessToken(env);
        return json(await inviaProva(auth, { runQuery, patchDoc, leggiDoc, fval }, q.get("testo")));
      }

      /* Prova dell'intera catena: accoda un messaggio e lo spedisce,
         esattamente come avviene per un gol o per una notizia appena
         pubblicata. Serve a verificare il percorso completo, non solo
         l'ultimo passaggio. */
      if (q.get("prova") === "coda") {
        const auth = await getAccessToken(env);
        const accodata = await notifica(auth, {
          title: q.get("titolo") || "🦅 Prova dalla coda",
          body: q.get("testo") || "Percorso completo: accodata e spedita.",
          url: q.get("url") || "/calendario",
        });
        const spedizione = await processPushQueue(env, auth, {
          runQuery,
          patchDoc,
          leggiDoc,
          eliminaDoc,
          fval,
        });
        return json({ accodata, spedizione });
      }
      /* Riapre una partita chiusa per errore, cosi il servizio torna a
         seguirla e la chiude di nuovo con i dati veri. Serve quando una
         lettura sbagliata l-ha dichiarata finita in anticipo. */
      /* Rimuove una partita. Serve per ripulire i documenti creati per
         sbaglio: scrivere su un identificativo inesistente non dà
         errore, lo CREA — e un documento senza squadre né data resta lì
         a sporcare il calendario (successo il 24/08/2026 usando un id
         accorciato). */
      if (q.get("cancellaPartita")) {
        const auth = await getAccessToken(env);
        const ok = await eliminaDoc(auth, `matches/${q.get("cancellaPartita")}`);
        return json({ cancellata: q.get("cancellaPartita"), esito: ok });
      }

      if (q.get("riapri")) {
        const auth = await getAccessToken(env);
        const idPartita = q.get("riapri");
        await patchDoc(auth, `matches/${idPartita}`, {
          status: "live",
          scored: false,
          live: true,
          liveStatus: "2H",
          updatedAt: new Date(),
        });
        return json({ riaperta: idPartita, poi: await eseguiTutto(env) });
      }
      return json(await eseguiTutto(env));
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

/* Un solo accesso a Firestore per entrambi i compiti del Worker:
   1) aggiornare la partita in diretta  2) spedire le notifiche in coda.
   Se uno dei due fallisce, l'altro prosegue comunque. */
async function eseguiTutto(env) {
  const auth = await getAccessToken(env);
  const out = {};

  try {
    out.live = await poll(env, auth);
  } catch (e) {
    out.live = { errore: e.message };
  }

  try {
    out.notifiche = await processPushQueue(env, auth, { runQuery, patchDoc, leggiDoc, eliminaDoc, fval });
  } catch (e) {
    out.notifiche = { errore: e.message };
  }

  try {
    out.newsletter = await processNewsletter(env, auth, { runQuery, patchDoc, fval });
  } catch (e) {
    out.newsletter = { errore: e.message };
  }

  /* Riprova ad aprire le pagelle rimaste indietro (vedi finalize). */
  try {
    out.pagelleRecuperate = await recuperaPagelle(env, auth);
  } catch (e) {
    out.pagelleRecuperate = { errore: e.message };
  }

  /* Lascia traccia dell'ultima esecuzione. Serve ad accorgersi se il
     Worker si è fermato: se questa data è vecchia di ore, qualcosa non
     va (il pannello admin la mostra). Senza, un blocco resterebbe
     invisibile finché non si nota che il minuto non avanza. */
  try {
    await patchDoc(auth, "sistema/livePoller", {
      ultimaEsecuzione: new Date(),
      esito: out.live?.errore || out.notifiche?.errore ? "errore" : "ok",
    });
    out.battito = "ok";
  } catch (e) {
    /* il battito non deve mai far fallire il lavoro vero */
    out.battito = `errore: ${e.message}`.slice(0, 200);
  }

  return out;
}

const WINDOW_BEFORE_MS = 10 * 60 * 1000;  // 10 min prima del kickoff
/* Durata minima reale di una partita: 45 + 15 di intervallo + 45, senza
   contare il recupero. Prima di questo tempo una gara NON puo essere
   finita, quindi una sua sparizione dalle live e un problema di lettura. */
const MIN_DURATA_MS = 100 * 60 * 1000;
/* Oltre questo tempo dal fischio d-inizio una partita e finita di
   sicuro, comunque siano andate le letture. */
const MAX_DURATA_MS = 165 * 60 * 1000;
const WINDOW_AFTER_MS = 200 * 60 * 1000;  // copre anche la chiusura di sicurezza (165 min)
const IN_PLAY = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
const FINISHED = ["FT", "AET", "PEN"];

async function poll(env, authCondiviso) {
  const auth = authCondiviso || (await getAccessToken(env));

  // 1) C'è una partita Lazio nella finestra oraria? (lettura Firestore gratis)
  const now = Date.now();
  const lo = new Date(now - WINDOW_AFTER_MS).toISOString();
  const hi = new Date(now + WINDOW_BEFORE_MS).toISOString();
  const candidates = await runQuery(auth, {
    from: [{ collectionId: "matches" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "kickoff" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: lo } } },
          { fieldFilter: { field: { fieldPath: "kickoff" }, op: "LESS_THAN_OR_EQUAL", value: { timestampValue: hi } } },
        ],
      },
    },
    limit: 5,
  });
  const m = candidates.find((c) => fval(c.fields.status) !== "finished");
  if (!m) return { skipped: "nessuna partita nella finestra" };

  // Già finalizzata (risultato + punti scritti): non sprecare chiamate API.
  // Il piano free ha 100 richieste/giorno, quindi ogni chiamata conta.
  if (fval(m.fields.scored) === true) return { skipped: "già finalizzata" };

  const curLive = fval(m.fields.live) === true;
  const curStatus = fval(m.fields.liveStatus);
  const dallInizio = Date.now() - new Date(fval(m.fields.kickoff) || 0).getTime();

  /* ─── RISPARMIO CHIAMATE ───────────────────────────────────────
     Il piano gratuito di API-Football dà 100 richieste al giorno, e
     una partita ne consumava fino a 98: margine zero. Bastava un
     imprevisto per restare a secco a metà gara — successo il
     24/08/2026 durante Bologna-Lazio.
     I tre controlli qui sotto vengono PRIMA della chiamata, non dopo:
     una richiesta risparmiata è una richiesta che resta disponibile. */

  // 1. Prima del fischio d'inizio la partita non può essere in diretta.
  //    Erano cinque chiamate buttate a ogni gara.
  if (dallInizio < 0) {
    return { skipped: "non ancora iniziata", fraQuantoMinuti: Math.round(-dallInizio / 60000) };
  }

  // 2. Oltre il tempo massimo si chiude senza chiedere nulla a nessuno:
  //    a quel punto la partita è finita di sicuro.
  if (curLive && curStatus !== "FT" && dallInizio >= MAX_DURATA_MS) {
    return await finalize(
      auth,
      m.id,
      fval(m.fields.liveHome) ?? 0,
      fval(m.fields.liveAway) ?? 0,
      readEvents(m.fields.events),
      "tempo-scaduto",
      { casa: fval(m.fields.homeTeam), ospite: fval(m.fields.awayTeam), kickoff: fval(m.fields.kickoff) },
      env,
      fval(m.fields.liveFixtureId)
    );
  }

  // 3. Se siamo vicini al limite giornaliero ci si ferma da soli, invece
  //    di sbatterci contro e ricevere risposte vuote scambiate per
  //    "partita finita".
  const consumo = await contaChiamataApi(auth);
  if (consumo.oggi > LIMITE_API_GIORNO) {
    console.error(`Limite API vicino: ${consumo.oggi} chiamate oggi. Diretta sospesa.`);
    return { skipped: "limite giornaliero API raggiunto", chiamateOggi: consumo.oggi };
  }

  // 4) Dati live da API-Football. Usiamo ?live=all (accessibile sul piano
  //    GRATIS) e filtriamo la Lazio: ?season=2026 sul free è bloccato.
  const { partita: fx, attendibile } = await fetchLiveLazio(env);

  // 3) In gioco (la partita compare tra le live): aggiorna minuto/recupero/
  //    risultato E il tabellino (gol, marcatori, cartellini) in diretta.
  if (fx) {
    const short = fx.fixture?.status?.short || "2H";
    const elapsed = fx.fixture?.status?.elapsed ?? null;
    const extra = fx.fixture?.status?.extra ?? null;
    const home = fx.goals?.home ?? 0;
    const away = fx.goals?.away ?? 0;
    const fixtureId = fx.fixture?.id ?? null;

    // Gli eventi arrivano già dentro ?live=all. Se un giorno non ci fossero,
    // ripieghiamo su /fixtures/events — ma NON a ogni giro: raddoppierebbe le
    // chiamate e sforerebbe le 100/giorno del piano free a metà partita.
    // Quindi solo quando cambia il punteggio (serve subito il marcatore) o
    // ogni ~10 minuti di gioco per raccogliere i cartellini.
    let raw = Array.isArray(fx.events) ? fx.events : null;
    if (!raw && fixtureId) {
      const golNuovo =
        (fval(m.fields.liveHome) ?? -1) !== home || (fval(m.fields.liveAway) ?? -1) !== away;
      const giroPeriodico = elapsed != null && elapsed % 10 === 0;
      if (golNuovo || giroPeriodico) raw = await fetchEvents(env, fixtureId);
    }
    const events = mapEvents(raw, fx.teams?.home?.id);

    const fields = {
      live: true,
      liveStatus: short,
      liveMinute: elapsed,
      liveExtra: extra,
      liveHome: home,
      liveAway: away,
      liveUpdatedAt: new Date(),
      liveFixtureId: fixtureId,
    };
    // Scriviamo il tabellino solo se abbiamo davvero letto degli eventi,
    // così un vuoto temporaneo dell'API non cancella quello già salvato.
    if (events) fields.events = events;

    /* ── Notifiche automatiche ────────────────────────────────
       Solo gli eventi che contano davvero: fischio d'inizio e gol.
       Ammonizioni e sostituzioni NON generano notifiche, altrimenti
       il telefono dei tifosi suonerebbe dieci volte a partita. */
    const casa = cleanTeam(fx.teams?.home?.name) || fval(m.fields.homeTeam) || "Casa";
    const ospite = cleanTeam(fx.teams?.away?.name) || fval(m.fields.awayTeam) || "Ospite";

    // Fischio d'inizio: la partita compare tra le live per la prima volta
    if (!curLive) {
      await notifica(auth, {
        title: "⚽ Si comincia!",
        body: `${casa} - ${ospite}: la partita è iniziata. Segui la diretta su Netflaxt.`,
      });
    } else {
      // Gol: il punteggio è cambiato rispetto a quello salvato
      const primaCasa = fval(m.fields.liveHome) ?? 0;
      const primaOspite = fval(m.fields.liveAway) ?? 0;
      if (home !== primaCasa || away !== primaOspite) {
        const laLazioHaSegnato = segnaLazio(env, fx, home, away, primaCasa, primaOspite);
        await notifica(auth, {
          title: laLazioHaSegnato ? "🦅 GOL DELLA LAZIO!" : "⚽ Gol",
          body: `${casa} ${home} - ${away} ${ospite}${marcatore(events, home + away)}`,
        });
      }
    }

    // Se l'API dichiara la partita conclusa mentre è ancora in lista,
    // finalizziamo subito con i dati definitivi.
    if (FINISHED.includes(short)) {
      return await finalize(auth, m.id, home, away, events, "api", { casa, ospite, kickoff: fval(m.fields.kickoff) }, env, fixtureId);
    }

    await patchMatch(auth, m.id, fields);
    return { updated: m.id, short, elapsed, extra, score: `${home}-${away}`, eventi: events?.length ?? "invariati" };
  }

  // 4) La Lazio non è più tra le partite live. Se la NOSTRA era in corso, la
  //    partita è appena finita: finalizziamo da soli con l'ultimo stato
  //    conosciuto (punteggio + tabellino già salvati poll dopo poll).
  /* ⚠️ DUE CONDIZIONI, ed entrambe servono.

     1. La risposta dell'API deve essere ATTENDIBILE. Se non lo è (quota
        finita, chiave scaduta) l'elenco arriva vuoto e sembrerebbe che
        la partita sia finita, mentre invece non ne sappiamo nulla.
     2. Deve essere passato abbastanza tempo dal fischio d'inizio. Una
        partita non può finire prima di ~100 minuti reali (45 + 15 di
        intervallo + 45 + recupero). Se "sparisce" prima, è un problema
        di lettura, non la fine della gara.

     Senza queste due condizioni Bologna-Lazio è stata chiusa 0-1 mentre
     si giocava ancora, con i punti dei pronostici già assegnati sul
     parziale (24/08/2026). */
  if (curLive && curStatus !== "FT" && attendibile && dallInizio >= MIN_DURATA_MS) {
    const home = fval(m.fields.liveHome) ?? 0;
    const away = fval(m.fields.liveAway) ?? 0;
    const events = readEvents(m.fields.events);
    return await finalize(
      auth, m.id, home, away, events, "uscita-dalle-live",
      { casa: fval(m.fields.homeTeam), ospite: fval(m.fields.awayTeam), kickoff: fval(m.fields.kickoff) },
      env,
      fval(m.fields.liveFixtureId)
    );
  }
  /* La chiusura per tempo scaduto sta più in alto, prima della chiamata
     all'API: a quel punto la partita è finita di sicuro e non serve
     chiedere nulla. */
  if (curLive && !attendibile) {
    return { skipped: "risposta non attendibile: la partita resta aperta", curLive };
  }
  return { skipped: "non in corso", curLive };
}

/* ── Finalizzazione automatica ─────────────────────────────────
   Scrive il risultato definitivo, chiude lo stato live e assegna i
   punti ai pronostici (stessa logica di scoreMatch lato sito:
   3 punti al risultato esatto, 1 all'esito 1X2). ─────────────── */
async function finalize(auth, matchId, home, away, events, origine, squadre = {}, env, fixtureId) {
  const fields = {
    homeScore: home,
    awayScore: away,
    status: "finished",
    scored: true,
    live: false,
    liveStatus: "FT",
    liveUpdatedAt: new Date(),
    updatedAt: new Date(),
  };
  if (events) fields.events = events;
  await patchMatch(auth, matchId, fields);

  const punti = await scorePredictions(auth, matchId, home, away);

  /* Apre le pagelle: raccoglie chi ha davvero giocato e prepara il
     documento su cui i tifosi voteranno. Se fallisce, la partita resta
     comunque chiusa correttamente — le pagelle sono un di più, non
     devono poter far saltare il risultato. */
  let pagelle = "non aperte";
  try {
    if (env && fixtureId) {
      pagelle = await apriPagelle(
        auth,
        env,
        matchId,
        fixtureId,
        squadre,
        `${home} - ${away}`,
        squadre.kickoff || null
      );
    }
  } catch (e) {
    pagelle = `errore: ${e.message}`.slice(0, 150);
    console.error("Pagelle non aperte:", e.message);
    /* Lascia un segno da recuperare più tardi. Il servizio partite ha
       anche un limite al MINUTO, oltre a quello giornaliero: se la
       richiesta cade proprio nell'istante sbagliato, senza questo segno
       le pagelle non si aprirebbero mai più — la partita è finita e
       non viene più interrogata. */
    try {
      await patchMatch(auth, matchId, { pagelleDaAprire: true });
    } catch {}
  }

  const casa = squadre.casa || "Casa";
  const ospite = squadre.ospite || "Ospite";

  /* Una notifica sola, non due: il fischio finale è il momento in cui la
     voglia di dire la propria è al massimo, e aggiungerne una seconda
     poco dopo darebbe solo fastidio. */
  const invito = pagelle && pagelle.giocatori
    ? " Vota le pagelle dei biancocelesti."
    : " Guarda il tabellino e i punti dei pronostici.";
  await notifica(auth, {
    title: "🏁 Fine partita",
    body: `${casa} ${home} - ${away} ${ospite}.${invito}`,
    url: "/",
  });

  return {
    finalizzata: matchId,
    risultato: `${home}-${away}`,
    eventi: events?.length ?? 0,
    pronosticiValutati: punti,
    pagelle,
    origine,
  };
}

/* Riapre le pagelle di una partita in cui la raccolta era fallita.
   Una sola per giro: non c'è fretta, e ogni tentativo costa una
   richiesta al servizio partite. */
async function recuperaPagelle(env, auth) {
  const rimaste = await runQuery(auth, {
    from: [{ collectionId: "matches" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "pagelleDaAprire" },
        op: "EQUAL",
        value: { booleanValue: true },
      },
    },
    limit: 1,
  });
  if (!rimaste.length) return "niente da recuperare";

  const m = rimaste[0];
  const fixture = fval(m.fields.liveFixtureId);
  if (!fixture) {
    await patchMatch(auth, m.id, { pagelleDaAprire: false });
    return "partita senza collegamento al servizio: rinuncio";
  }

  try {
    const esito = await apriPagelle(
      auth,
      env,
      m.id,
      fixture,
      { casa: fval(m.fields.homeTeam), ospite: fval(m.fields.awayTeam), kickoff: fval(m.fields.kickoff) },
      `${fval(m.fields.homeScore) ?? ""} - ${fval(m.fields.awayScore) ?? ""}`
    );
    await patchMatch(auth, m.id, { pagelleDaAprire: false });
    return { partita: m.id, ...esito };
  } catch (e) {
    return `ancora non riuscito: ${e.message}`.slice(0, 120);
  }
}

/* ── Pagelle: chi ha giocato davvero ───────────────────────────
   Una sola richiesta al servizio partite, a gara finita. Restituisce
   minuti giocati, ruolo e se il giocatore era titolare o subentrato:
   chi ha zero minuti resta fuori dall'elenco, perché non si può dare
   un voto a chi non è sceso in campo. */
const ORDINE_RUOLI = { G: 0, D: 1, M: 2, F: 3 };

async function apriPagelle(
  auth,
  env,
  matchId,
  fixtureId,
  squadre = {},
  risultato = "",
  partitaIl = null
) {
  const teamId = String(env.TEAM_ID || "487");
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures/players?fixture=${fixtureId}`,
    { headers: { "x-apisports-key": env.APIFOOTBALL_KEY } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const dati = await res.json();

  const err = dati?.errors;
  if (err && (Array.isArray(err) ? err.length : Object.keys(err).length)) {
    throw new Error(JSON.stringify(err).slice(0, 120));
  }

  const squadra = (dati.response || []).find((s) => String(s.team?.id) === teamId);
  if (!squadra) throw new Error("squadra non trovata nella risposta");

  const giocatori = [];
  for (const voce of squadra.players || []) {
    const st = voce.statistics?.[0]?.games || {};
    const minuti = Number(st.minutes ?? 0);
    if (!minuti) continue; // in panchina tutta la partita: niente voto
    giocatori.push({
      id: String(voce.player?.id ?? ""),
      nome: voce.player?.name || "",
      ruolo: st.position || "",
      minuti,
      titolare: st.substitute !== true,
      numero: Number(st.number ?? 0),
      /* Il voto calcolato dal servizio: si mostra accanto a quello della
         curva, ed è proprio lo scarto fra i due a far discutere. */
      votoAlgoritmo: st.rating ? Number(st.rating) : null,
    });
  }
  if (!giocatori.length) throw new Error("nessun giocatore con minuti giocati");

  giocatori.sort((a, b) => {
    const r = (ORDINE_RUOLI[a.ruolo] ?? 9) - (ORDINE_RUOLI[b.ruolo] ?? 9);
    return r !== 0 ? r : b.minuti - a.minuti;
  });

  await patchDoc(auth, `pagelle/${matchId}`, {
    partita: `${squadre.casa || "?"} - ${squadre.ospite || "?"}`,
    risultato,
    /* L'orario della partita, non quello di adesso: è da qui che il
       sito conta il giorno di permanenza in home. Se le pagelle vengono
       aperte in ritardo, la scadenza resta ancorata alla gara. */
    partitaIl: partitaIl ? new Date(partitaIl) : new Date(),
    chiuse: false,
    giocatori,
    aperteIl: new Date(),
    /* Somme e conteggi dei voti stanno qui, non sparsi: la media è una
       divisione fra due numeri già pronti, senza dover rileggere tutti
       i voti uno per uno. */
    somme: {},
    conteggi: {},
    senzaVoto: {},
  });

  return { giocatori: giocatori.length };
}

/* Esito 1X2 dal punteggio */
function outcomeOf(h, a) {
  if (h > a) return "1";
  if (h < a) return "2";
  return "X";
}

/* Assegna i punti a tutti i pronostici della partita */
async function scorePredictions(auth, matchId, home, away) {
  const finalOutcome = outcomeOf(home, away);
  const preds = await runQuery(auth, {
    from: [{ collectionId: "predictions" }],
    where: {
      fieldFilter: { field: { fieldPath: "matchId" }, op: "EQUAL", value: { stringValue: matchId } },
    },
  });
  let n = 0;
  for (const p of preds) {
    const ph = fval(p.fields.homeScore);
    const pa = fval(p.fields.awayScore);
    const esatto = Number(ph) === Number(home) && Number(pa) === Number(away);
    let points = 0;
    if (esatto) points = 3;
    else if (fval(p.fields.outcome) === finalOutcome) points = 1;
    await patchDoc(auth, `predictions/${p.id}`, { points });
    n++;
  }
  return n;
}

/* ── API-Football: partite LIVE (?live=all). A differenza di ?season=…
   questo endpoint è accessibile anche sul piano gratuito. ──────── */
/* Restituisce { partita, attendibile }.

   ⚠️ `attendibile` è la parte importante, e la sua assenza ha causato un
   guaio vero: API-Football, quando si esauriscono le 100 richieste
   giornaliere del piano gratuito, NON risponde con un errore — risponde
   200 con un elenco VUOTO e il motivo dentro `errors`.
   Il codice interpretava quell'elenco vuoto come "la partita non è più
   in diretta, quindi è finita", chiudeva la gara e assegnava i punti dei
   pronostici sul punteggio parziale. È successo durante Bologna-Lazio il
   24/08/2026: partita dichiarata finita 0-1 mentre si stava ancora
   giocando.
   Una risposta non attendibile va trattata come "non lo so", mai come
   "è finita". */
/* Quante richieste ad API-Football sono state fatte oggi.

   Stasera il problema non è stato solo restare senza richieste: è stato
   non ACCORGERSENE. Il consumo era una stima sulla carta, non un numero
   leggibile. Ora si conta davvero, e si vede da `?diag=coda`.
   Il conteggio riparte da solo a ogni cambio di data. */
const LIMITE_API_GIORNO = 90; // sotto le 100 vere, per lasciare margine

async function contaChiamataApi(auth) {
  const oggiStr = new Date().toISOString().slice(0, 10);
  let oggi = 1;
  try {
    const d = await leggiDoc(auth, "sistema/livePoller");
    const dataSalvata = d?.fields?.apiData?.stringValue;
    const contatore = Number(d?.fields?.apiOggi?.integerValue ?? 0);
    oggi = dataSalvata === oggiStr ? contatore + 1 : 1;
  } catch {
    /* se non si riesce a leggere si prosegue: meglio una diretta
       imprecisa nel conteggio che una diretta ferma */
  }
  try {
    await patchDoc(auth, "sistema/livePoller", { apiData: oggiStr, apiOggi: oggi });
  } catch {}
  return { oggi };
}

async function fetchLiveLazio(env) {
  const teamId = env.TEAM_ID || "487";
  const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": env.APIFOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const data = await res.json();

  /* `errors` è [] quando va tutto bene, un oggetto con dentro il motivo
     quando c'è un problema (quota finita, chiave non valida, piano non
     abilitato). In quel caso la risposta non dice nulla sulla partita. */
  const errori = data?.errors;
  const haErrori = errori && (Array.isArray(errori) ? errori.length > 0 : Object.keys(errori).length > 0);
  if (haErrori || !Array.isArray(data.response)) {
    console.error("API-Football non attendibile:", JSON.stringify(errori).slice(0, 200));
    return { partita: null, attendibile: false };
  }

  const partita =
    data.response.find(
      (fx) =>
        String(fx.teams?.home?.id) === teamId ||
        String(fx.teams?.away?.id) === teamId
    ) || null;
  return { partita, attendibile: true };
}

/* ── Eventi della partita (fallback: usato solo se ?live=all non li
   include già nella risposta). ─────────────────────────────────── */
async function fetchEvents(env, fixtureId) {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`,
    { headers: { "x-apisports-key": env.APIFOOTBALL_KEY } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data.response) ? data.response : null;
}

/* ── Mappa gli eventi API-Football sul formato del tabellino del sito:
   { team: "home"|"away", type, player, minute }
   Tipi gestiti: gol (normale/rigore/autogol), giallo, rosso.
   NB: l'API non segnala gli infortuni come evento dedicato, quindi
   l'icona ambulanza resta un inserimento manuale dell'admin. ───── */
function mapEvents(raw, homeTeamId) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const e of raw) {
    const tipo = String(e?.type || "").toLowerCase();
    const dett = String(e?.detail || "").toLowerCase();

    let type = null;
    if (tipo === "goal") {
      if (dett.includes("missed")) continue;      // rigore sbagliato: non è gol
      if (dett.includes("own")) type = "owngoal";
      else if (dett.includes("penalty")) type = "penalty";
      else type = "goal";
    } else if (tipo === "card") {
      if (dett.includes("yellow") && !dett.includes("second")) type = "yellow";
      else type = "red";                           // rosso diretto o doppio giallo
    } else {
      continue;                                    // sostituzioni, VAR: non in tabellino
    }

    const elapsed = Number(e?.time?.elapsed ?? 0);
    const extra = Number(e?.time?.extra ?? 0) || 0;
    const minute = Math.max(0, Math.min(130, elapsed + extra));

    out.push({
      team: String(e?.team?.id) === String(homeTeamId) ? "home" : "away",
      type,
      player: String(e?.player?.name || "").trim().slice(0, 60),
      minute,
    });
  }
  out.sort((a, b) => a.minute - b.minute);
  return out;
}

/* ── Supporto per le notifiche automatiche ────────────────────── */

/* Nomi come li scrive il sito: "SS Lazio" → "Lazio", "AC Milan" → "Milan" */
function cleanTeam(nome) {
  if (!nome) return "";
  return (
    nome
      .replace(/\b(AC|FC|SS|SSC|AS|US|ACF|Calcio|1907|1909|1913)\b/g, "")
      .replace(/\s+/g, " ")
      .trim() || nome.trim()
  );
}

/* Ha segnato la Lazio? Dipende da che lato del campo si trova. */
function segnaLazio(env, fx, home, away, primaCasa, primaOspite) {
  const teamId = String(env.TEAM_ID || "487");
  const lazioInCasa = String(fx.teams?.home?.id) === teamId;
  return lazioInCasa ? home > primaCasa : away > primaOspite;
}

/* Chi ha segnato l'ultimo gol, per il testo della notifica.
   Restituisce " · Zaccagni 12'" oppure "" se il dato non c'è. */
function marcatore(events, golAttesi) {
  if (!Array.isArray(events) || !events.length) return "";
  const gol = events.filter((e) => ["goal", "penalty", "owngoal"].includes(e.type));
  // Se il tabellino non è ancora allineato al punteggio, meglio tacere
  // che annunciare il marcatore sbagliato.
  if (gol.length !== golAttesi) return "";
  const ultimo = gol[gol.length - 1];
  if (!ultimo?.player) return "";
  const suffisso =
    ultimo.type === "penalty" ? " (rig.)" : ultimo.type === "owngoal" ? " (aut.)" : "";
  return ` · ${ultimo.player}${suffisso} ${ultimo.minute}'`;
}

/* Rilegge il tabellino già salvato su Firestore (formato typed values) */
function readEvents(field) {
  const vals = field?.arrayValue?.values;
  if (!Array.isArray(vals)) return null;
  return vals.map((v) => {
    const f = v.mapValue?.fields || {};
    return {
      team: fval(f.team) || "home",
      type: fval(f.type) || "goal",
      player: fval(f.player) || "",
      minute: Number(fval(f.minute) ?? 0),
    };
  });
}

/* ── Firestore REST (auth service account) ────────────────────── */
async function getAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error("manca FIREBASE_SERVICE_ACCOUNT");
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    // datastore = leggere/scrivere Firestore · firebase.messaging = inviare le push
    scope:
      "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const jwt = await signJwt(claim, sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token: " + JSON.stringify(data));
  return { token: data.access_token, projectId: sa.project_id };
}

/* `dentro` limita la ricerca a una sottoraccolta precisa
   (es. "users/abc"): serve per cercare fra i dispositivi di UN utente
   senza dover cercare fra quelli di tutti, cosa che Firestore
   consentirebbe solo creando un indice apposta. */
async function runQuery(auth, structuredQuery, dentro = "") {
  const base = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents`;
  const url = `${base}${dentro ? "/" + dentro : ""}:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`runQuery HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data || [])
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document.name.split("/").pop(),
      // Percorso relativo (es. "users/abc/devices/xyz"): serve per
      // aggiornare documenti che stanno dentro sottoraccolte, dove il
      // solo id non basta a ritrovarli.
      percorso: r.document.name.split("/documents/")[1] || "",
      fields: r.document.fields || {},
    }));
}

function patchMatch(auth, id, fields) {
  return patchDoc(auth, `matches/${id}`, fields);
}

/* Elimina un documento (serve a svuotare la coda delle notifiche già spedite) */
async function eliminaDoc(auth, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${auth.token}` },
  });
  return res.ok;
}

/* Legge un singolo documento (serve per ripulire i dispositivi non più validi) */
async function leggiDoc(auth, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${auth.token}` } });
  if (!res.ok) return null;
  return await res.json();
}

/* Crea un nuovo documento in una collection (serve per accodare le notifiche) */
async function createDoc(auth, collection, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/${collection}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({ fields: toFields(fields) }),
  });
  if (!res.ok) throw new Error(`create HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

/* Mette una notifica in coda: la spedirà processPushQueue allo stesso giro
   o al successivo. Se fallisce non deve MAI bloccare l'aggiornamento della
   partita, quindi l'errore viene solo annotato. */
async function notifica(auth, { title, body, url = "/calendario" }) {
  try {
    await createDoc(auth, "pushQueue", {
      title,
      body,
      url,
      audience: "all",
      status: "queued",
      createdAt: new Date(),
      origine: "automatica",
    });
    return true;
  } catch (e) {
    console.error("notifica non accodata:", e.message);
    return false;
  }
}

/* Aggiorna un documento qualsiasi (matches, predictions, …) */
async function patchDoc(auth, path, fields) {
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents/${path}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({ fields: toFields(fields) }),
  });
  if (!res.ok) throw new Error(`patch HTTP ${res.status}: ${await res.text()}`);
}

/* ── Helpers Firestore typed values ───────────────────────────── */
function fval(f) {
  if (!f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("timestampValue" in f) return new Date(f.timestampValue).getTime();
  return null;
}
function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = toValue(v);
  return out;
}

/* Converte un valore JS nel formato "typed value" di Firestore.
   Gestisce anche array e oggetti annidati (serve per il tabellino). */
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

/* ── JWT RS256 via Web Crypto ─────────────────────────────────── */
async function signJwt(claim, pem) {
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const data = `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claim)}`;
  const key = await importKey(pem);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}
async function importKey(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* Il sito e questo servizio vivono su indirizzi diversi. Per sicurezza i
   browser bloccano le chiamate fra indirizzi diversi, a meno che la
   risposta non dichiari di accettarle: senza questa intestazione, dal
   sito la richiesta fallisce sempre e l'utente vede solo un generico
   "non è stato possibile contattare il servizio" (successo il
   24/08/2026 con la conferma degli accessi).
   Da riga di comando il problema non si vede: quel controllo lo fa
   soltanto il browser. */
const SITI_AMMESSI = ["https://netflaxt.it", "https://www.netflaxt.it"];

function intestazioniCors(req) {
  const origine = req?.headers?.get("origin") || "";
  return {
    "content-type": "application/json",
    "access-control-allow-origin": SITI_AMMESSI.includes(origine)
      ? origine
      : SITI_AMMESSI[0],
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-max-age": "86400",
  };
}

function json(obj, status = 200, req = null) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: intestazioniCors(req),
  });
}
