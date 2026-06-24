/* ─────────────────────────────────────────────────────────────
   scripts/sync-lazio-calendar.mjs
   Sincronizza il calendario della Lazio (Serie A) da TheSportsDB
   verso Firestore (collezione "matches"). Gira su GitHub Actions, 2x al
   giorno + manualmente. Carica i match mancanti e aggiorna gli orari/date
   spostati AUTOMATICAMENTE, senza intervento manuale.

   Fonte: TheSportsDB (thesportsdb.com). La chiave gratuita pubblica "3"
   limita le richieste "per stagione" a pochi eventi, quindi scarichiamo
   il calendario UNA GIORNATA ALLA VOLTA (endpoint eventsround), così
   otteniamo tutte le 38 giornate complete.

   Sicurezza anti-sovrascrittura:
     • non tocca MAI risultato/tabellino inseriti dall'admin (scored=true)
     • salta i match con lockedByAdmin=true (l'admin li "blocca" dal pannello)
     • non sovrascrive un logo personalizzato caricato dall'admin
     • i match creati a mano (senza externalId) non vengono mai toccati

   Variabili d'ambiente (GitHub Actions secrets/env):
     FIREBASE_SERVICE_ACCOUNT → JSON chiave service account Firebase (secret)
     THESPORTSDB_KEY          → chiave API (opzionale, default "3" pubblica)
     SEASON                   → es. "2026-2027"
     LEAGUE_ID                → id lega TheSportsDB (Serie A = 4332)
     TEAM                     → nome squadra (default "Lazio")
     TEAM_ID                  → id squadra TheSportsDB (SS Lazio = 133668)
     ROUNDS                   → numero di giornate (default 38)
   ───────────────────────────────────────────────────────────── */
import admin from "firebase-admin";

const SA_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
const KEY = process.env.THESPORTSDB_KEY || "3";
const LEAGUE_ID = process.env.LEAGUE_ID || "4332"; // Serie A
const SEASON = process.env.SEASON || "2026-2027";
const TEAM = (process.env.TEAM || "Lazio").trim();
const TEAM_ID = (process.env.TEAM_ID || "133668").trim(); // SS Lazio
const ROUNDS = Number(process.env.ROUNDS || 38);

const API = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

/* ── Validazione ambiente ─────────────────────────────────────── */
if (!SA_JSON) {
  console.error("❌ Manca FIREBASE_SERVICE_ACCOUNT (chiave service account).");
  process.exit(1);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(SA_JSON);
} catch (e) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT non è un JSON valido:", e.message);
  process.exit(1);
}

/* ── Init Firestore (Admin SDK: bypassa le security rules) ────── */
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

/* ── Helpers mapping TheSportsDB → schema Netflaxt ────────────── */

// Nomi TheSportsDB → nomi puliti usati dal sito (per risolvere i loghi)
const NAME_MAP = {
  "ac milan": "Milan",
  "inter milan": "Inter",
  internazionale: "Inter",
  "as roma": "Roma",
  "ss lazio": "Lazio",
  "juventus fc": "Juventus",
  "ssc napoli": "Napoli",
  "us lecce": "Lecce",
  "torino fc": "Torino",
  "udinese calcio": "Udinese",
  "bologna fc": "Bologna",
  "como 1907": "Como",
};
function cleanName(n) {
  if (!n) return "";
  const key = n.trim().toLowerCase();
  if (NAME_MAP[key]) return NAME_MAP[key];
  const stripped = n
    .replace(/\b(AC|FC|SS|SSC|AS|US|ACF|Calcio|1907|1909|1913)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || n.trim();
}

// È la nostra squadra in questo evento?
function isOurTeam(ev) {
  if (TEAM_ID && (ev.idHomeTeam === TEAM_ID || ev.idAwayTeam === TEAM_ID)) return true;
  const t = TEAM.toLowerCase();
  return (
    (ev.strHomeTeam || "").toLowerCase().includes(t) ||
    (ev.strAwayTeam || "").toLowerCase().includes(t)
  );
}

// Stato evento → stato nostro
function mapStatus(ev) {
  const s = (ev.strStatus || "").toLowerCase();
  const postponed =
    (ev.strPostponed || "").toLowerCase() === "yes" || s.includes("postp");
  let status = "scheduled";
  if (s.includes("finish") || ["ft", "aet", "pen"].includes(s)) status = "finished";
  else if (["1h", "2h", "ht"].includes(s) || s.includes("live") || s.includes("play"))
    status = "live";
  return { status, postponed };
}

// Calcio d'inizio in UTC (TheSportsDB fornisce dateEvent + strTime in UTC)
function kickoffFrom(ev) {
  const date = ev.dateEvent; // "YYYY-MM-DD"
  if (!date) return { ts: null, timeConfirmed: false };
  const time = ev.strTime && ev.strTime !== "00:00:00" ? ev.strTime : null;
  const d = new Date(`${date}T${time || "12:00:00"}Z`);
  if (Number.isNaN(d.getTime())) return { ts: null, timeConfirmed: false };
  return { ts: d, timeConfirmed: !!time };
}

// Campi di SOLO calendario (mai punteggio/tabellino)
function scheduleFields(ev) {
  const { status, postponed } = mapStatus(ev);
  const { ts, timeConfirmed } = kickoffFrom(ev);
  return {
    homeTeam: cleanName(ev.strHomeTeam),
    awayTeam: cleanName(ev.strAwayTeam),
    homeCrest: ev.strHomeTeamBadge || null,
    awayCrest: ev.strAwayTeamBadge || null,
    competition: "Serie A",
    matchday: ev.intRound ? Number(ev.intRound) : null,
    kickoff: ts ? Timestamp.fromDate(ts) : null,
    status,
    postponed,
    timeConfirmed,
    externalId: String(ev.idEvent),
    source: "thesportsdb",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pausa tra una giornata e l'altra: la chiave gratuita "3" è condivisa e
// rate-limited (~30 richieste/minuto), quindi andiamo piano.
const ROUND_DELAY_MS = Number(process.env.ROUND_DELAY_MS || 2000);

/* ── Fetch di una giornata (con retry sul rate limit 429) ─────── */
async function fetchRound(round, attempt = 1) {
  const url = `${API}/eventsround.php?id=${LEAGUE_ID}&r=${round}&s=${SEASON}`;
  const res = await fetch(url);
  if (res.status === 429 && attempt <= 4) {
    const wait = 12000;
    console.warn(
      `   ⏳ Giornata ${round}: limite richieste (429), attendo ${wait / 1000}s e riprovo (tentativo ${attempt + 1})…`
    );
    await sleep(wait);
    return fetchRound(round, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  return Array.isArray(data.events) ? data.events : [];
}

function fmtDate(ts) {
  try {
    return ts.toDate().toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
function kickoffMillis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}
function hasChanged(existing, next) {
  return (
    kickoffMillis(existing.kickoff) !== kickoffMillis(next.kickoff) ||
    (existing.matchday ?? null) !== (next.matchday ?? null) ||
    (existing.status || "") !== (next.status || "") ||
    Boolean(existing.postponed) !== Boolean(next.postponed) ||
    Boolean(existing.timeConfirmed) !== Boolean(next.timeConfirmed) ||
    (existing.homeTeam || "") !== (next.homeTeam || "") ||
    (existing.awayTeam || "") !== (next.awayTeam || "")
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
async function main() {
  console.log(`\n🦅 Sync calendario "${TEAM}" · Serie A ${SEASON} · fonte TheSportsDB`);

  // 1) Scarica giornata per giornata e tieni solo le partite della Lazio
  const ours = [];
  let roundsWithData = 0;
  for (let r = 1; r <= ROUNDS; r++) {
    let events = [];
    try {
      events = await fetchRound(r);
    } catch (e) {
      console.warn(`   ⚠️  Giornata ${r}: ${e.message}`);
    }
    if (events.length) roundsWithData++;
    ours.push(...events.filter(isOurTeam));
    await sleep(ROUND_DELAY_MS); // rispetta il rate limit della chiave gratuita
  }
  console.log(
    `   Giornate con dati: ${roundsWithData}/${ROUNDS} · partite "${TEAM}" trovate: ${ours.length}`
  );
  if (ours.length === 0) {
    console.warn("⚠️  Nessuna partita trovata. Nessuna scrittura.");
    return;
  }

  // 2) Upsert su Firestore per externalId
  const col = db.collection("matches");
  let created = 0;
  let updated = 0;
  let skippedLocked = 0;
  let unchanged = 0;

  for (const ev of ours) {
    const next = scheduleFields(ev);
    if (!next.kickoff) {
      console.warn(`   (salto ${next.homeTeam}-${next.awayTeam}: data mancante)`);
      continue;
    }
    const snap = await col.where("externalId", "==", next.externalId).limit(1).get();

    if (snap.empty) {
      await col.add({
        ...next,
        homeLogo: null,
        awayLogo: null,
        homeScore: null,
        awayScore: null,
        scored: false,
        lockedByAdmin: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        syncedAt: FieldValue.serverTimestamp(),
      });
      created++;
      console.log(`   + ${next.homeTeam} – ${next.awayTeam} (${next.matchday}ª) · ${fmtDate(next.kickoff)}`);
      continue;
    }

    const docRef = snap.docs[0].ref;
    const existing = snap.docs[0].data();
    if (existing.scored === true || existing.lockedByAdmin === true) {
      skippedLocked++;
      continue;
    }
    if (!hasChanged(existing, next)) {
      await docRef.set({ syncedAt: FieldValue.serverTimestamp() }, { merge: true });
      unchanged++;
      continue;
    }
    await docRef.set(
      { ...next, updatedAt: FieldValue.serverTimestamp(), syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    updated++;
    const was = fmtDate(existing.kickoff);
    const now = fmtDate(next.kickoff);
    const when = was !== now ? ` · ${was} → ${now}` : "";
    console.log(`   ~ ${next.homeTeam} – ${next.awayTeam} (${next.matchday}ª) aggiornata${when}`);
  }

  console.log(
    `\n✅ Fatto. Nuove: ${created} · Aggiornate: ${updated} · Invariate: ${unchanged} · Saltate (admin/risultato): ${skippedLocked}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Errore sync:", e.message || e);
    process.exit(1);
  });
