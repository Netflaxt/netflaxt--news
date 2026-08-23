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

      const chiave = env.ADMIN_KEY;
      if (!chiave || q.get("key") !== chiave) {
        return json({ error: "accesso non autorizzato" }, 401);
      }
      if (q.get("diag") === "push") {
        const auth = await getAccessToken(env);
        return json(await diagnosticaPush(auth, { runQuery, fval }));
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
          fval,
        });
        return json({ accodata, spedizione });
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
    out.notifiche = await processPushQueue(env, auth, { runQuery, patchDoc, leggiDoc, fval });
  } catch (e) {
    out.notifiche = { errore: e.message };
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
const WINDOW_AFTER_MS = 150 * 60 * 1000;  // 150 min dopo (copre recuperi/ET)
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

  // 2) Dati live da API-Football. Usiamo ?live=all (accessibile sul piano
  //    GRATIS) e filtriamo la Lazio: ?season=2026 sul free è bloccato.
  const fx = await fetchLiveLazio(env);
  const curLive = fval(m.fields.live) === true;
  const curStatus = fval(m.fields.liveStatus);

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
      return await finalize(auth, m.id, home, away, events, "api", { casa, ospite });
    }

    await patchMatch(auth, m.id, fields);
    return { updated: m.id, short, elapsed, extra, score: `${home}-${away}`, eventi: events?.length ?? "invariati" };
  }

  // 4) La Lazio non è più tra le partite live. Se la NOSTRA era in corso, la
  //    partita è appena finita: finalizziamo da soli con l'ultimo stato
  //    conosciuto (punteggio + tabellino già salvati poll dopo poll).
  if (curLive && curStatus !== "FT") {
    const home = fval(m.fields.liveHome) ?? 0;
    const away = fval(m.fields.liveAway) ?? 0;
    const events = readEvents(m.fields.events);
    return await finalize(auth, m.id, home, away, events, "uscita-dalle-live", {
      casa: fval(m.fields.homeTeam),
      ospite: fval(m.fields.awayTeam),
    });
  }
  return { skipped: "non in corso", curLive };
}

/* ── Finalizzazione automatica ─────────────────────────────────
   Scrive il risultato definitivo, chiude lo stato live e assegna i
   punti ai pronostici (stessa logica di scoreMatch lato sito:
   3 punti al risultato esatto, 1 all'esito 1X2). ─────────────── */
async function finalize(auth, matchId, home, away, events, origine, squadre = {}) {
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

  // Notifica con il risultato finale
  const casa = squadre.casa || "Casa";
  const ospite = squadre.ospite || "Ospite";
  await notifica(auth, {
    title: "🏁 Fine partita",
    body: `${casa} ${home} - ${away} ${ospite}. Guarda il tabellino e i punti dei pronostici.`,
  });

  return { finalizzata: matchId, risultato: `${home}-${away}`, eventi: events?.length ?? 0, pronosticiValutati: punti, origine };
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
async function fetchLiveLazio(env) {
  const teamId = env.TEAM_ID || "487";
  const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": env.APIFOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data.response) ? data.response : [];
  return (
    list.find(
      (fx) =>
        String(fx.teams?.home?.id) === teamId ||
        String(fx.teams?.away?.id) === teamId
    ) || null
  );
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

async function runQuery(auth, structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`runQuery HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data || [])
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split("/").pop(), fields: r.document.fields || {} }));
}

function patchMatch(auth, id, fields) {
  return patchDoc(auth, `matches/${id}`, fields);
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
