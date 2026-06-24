/* ─────────────────────────────────────────────────────────────
   scripts/sync-lazio-calendar.mjs
   Sincronizza il calendario della Lazio (Serie A) da API-Football
   verso Firestore (collezione "matches"). Gira su GitHub Actions, 2x al
   giorno + manualmente. Carica i match mancanti e aggiorna date/orari
   spostati AUTOMATICAMENTE (anticipi/posticipi), con le date UFFICIALI.

   Perché API-Football: una sola chiamata prende tutte le 38 partite, è
   una fonte professionale (più aggiornata di TheSportsDB) e dice da sola
   se l'orario è confermato (status "NS") o ancora da definire ("TBD") →
   il sito mostra "Data da confermare" solo quando serve davvero.

   Sicurezza anti-sovrascrittura:
     • non tocca risultato/tabellino dell'admin (scored=true)
     • salta i match con lockedByAdmin=true
     • non tocca i campi live (li gestisce il poller Cloudflare)
     • non sovrascrive un logo personalizzato dell'admin

   Variabili d'ambiente (GitHub Actions secrets/env):
     FIREBASE_SERVICE_ACCOUNT → JSON chiave service account Firebase (secret)
     APIFOOTBALL_KEY          → chiave API-Football (secret)
     SEASON                   → anno d'inizio stagione (default 2026 = 2026/27)
     TEAM_ID                  → id squadra (default 487 = SS Lazio)
     LEAGUE_ID                → id lega (default 135 = Serie A)
   ───────────────────────────────────────────────────────────── */
import admin from "firebase-admin";

const SA_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
const API_KEY = process.env.APIFOOTBALL_KEY;
const SEASON = process.env.SEASON || "2026";
const TEAM_ID = process.env.TEAM_ID || "487"; // SS Lazio
const LEAGUE_ID = process.env.LEAGUE_ID || "135"; // Serie A
const API_BASE = "https://v3.football.api-sports.io";

if (!SA_JSON) {
  console.error("❌ Manca FIREBASE_SERVICE_ACCOUNT.");
  process.exit(1);
}
if (!API_KEY) {
  console.error("❌ Manca APIFOOTBALL_KEY (chiave API-Football).");
  process.exit(1);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(SA_JSON);
} catch (e) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT non è un JSON valido:", e.message);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

/* ── Mapping API-Football → schema Netflaxt ───────────────────── */
const NAME_MAP = {
  "ac milan": "Milan",
  "inter": "Inter",
  "internazionale": "Inter",
  "as roma": "Roma",
  "ss lazio": "Lazio",
};
function cleanName(n) {
  if (!n) return "";
  const key = n.trim().toLowerCase();
  if (NAME_MAP[key]) return NAME_MAP[key];
  const stripped = n
    .replace(/\b(AC|FC|SS|SSC|AS|US|ACF|Calcio)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || n.trim();
}

// "Regular Season - 12" → 12
function roundToMatchday(round) {
  const m = (round || "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

// status API-Football → stato nostro (live lo gestisce il poller)
const FINISHED = ["FT", "AET", "PEN", "AWD", "WO"];
const POSTPONED = ["PST", "CANC", "ABD", "SUSP", "INT"];
function mapStatus(short) {
  if (FINISHED.includes(short)) return "finished";
  return "scheduled";
}

function scheduleFields(fx) {
  const short = fx.fixture?.status?.short || "NS";
  return {
    homeTeam: cleanName(fx.teams?.home?.name),
    awayTeam: cleanName(fx.teams?.away?.name),
    homeCrest: fx.teams?.home?.logo || null,
    awayCrest: fx.teams?.away?.logo || null,
    competition: "Serie A",
    matchday: roundToMatchday(fx.league?.round),
    kickoff: fx.fixture?.date ? Timestamp.fromDate(new Date(fx.fixture.date)) : null,
    status: mapStatus(short),
    // "TBD" = orario ancora da definire → il sito mostra "Data da confermare"
    timeConfirmed: short !== "TBD",
    postponed: POSTPONED.includes(short),
    externalId: String(fx.fixture?.id),
    source: "api-football",
  };
}

/* ── Fetch ────────────────────────────────────────────────────── */
async function fetchFixtures() {
  const url = `${API_BASE}/fixtures?team=${TEAM_ID}&league=${LEAGUE_ID}&season=${SEASON}`;
  console.log(`→ GET ${url}`);
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API-Football HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length) {
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`);
  }
  return Array.isArray(data.response) ? data.response : [];
}

/* ── Helpers diff ─────────────────────────────────────────────── */
function kMillis(ts) {
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
}
function hasChanged(a, b) {
  return (
    kMillis(a.kickoff) !== kMillis(b.kickoff) ||
    (a.matchday ?? null) !== (b.matchday ?? null) ||
    (a.status || "") !== (b.status || "") ||
    Boolean(a.timeConfirmed) !== Boolean(b.timeConfirmed) ||
    Boolean(a.postponed) !== Boolean(b.postponed) ||
    (a.homeTeam || "") !== (b.homeTeam || "") ||
    (a.awayTeam || "") !== (b.awayTeam || "")
  );
}
function fmt(ts) {
  try {
    return ts.toDate().toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/* ── Main ─────────────────────────────────────────────────────── */
async function main() {
  console.log(`\n🦅 Sync calendario Lazio · Serie A ${SEASON}/${Number(SEASON) + 1} · fonte API-Football`);

  const fixtures = await fetchFixtures();
  console.log(`   Ricevute ${fixtures.length} partite di Serie A.`);
  if (fixtures.length === 0) {
    console.warn("⚠️  Nessuna partita restituita. Nessuna scrittura.");
    return;
  }

  // Carica i match esistenti una volta sola (per adottarli, evitando doppioni
  // quando l'externalId cambia da TheSportsDB ad API-Football).
  const snap = await db.collection("matches").get();
  const byExternal = new Map();
  const serieAByMatchday = new Map();
  snap.forEach((d) => {
    const data = d.data();
    if (data.externalId) byExternal.set(String(data.externalId), { id: d.id, data });
    if (data.competition === "Serie A" && data.matchday != null) {
      serieAByMatchday.set(Number(data.matchday), { id: d.id, data });
    }
  });

  const col = db.collection("matches");
  let created = 0,
    updated = 0,
    adopted = 0,
    skipped = 0,
    unchanged = 0;

  for (const fx of fixtures) {
    const next = scheduleFields(fx);
    if (!next.kickoff) {
      console.warn(`   (salto ${next.homeTeam}-${next.awayTeam}: data mancante)`);
      continue;
    }

    // 1) match esistente per externalId; 2) altrimenti adotta per giornata
    let existing = byExternal.get(next.externalId);
    let isAdoption = false;
    if (!existing && next.matchday != null) {
      const cand = serieAByMatchday.get(next.matchday);
      if (cand && cand.data.externalId !== next.externalId) {
        existing = cand;
        isAdoption = true;
      }
    }

    if (!existing) {
      await col.add({
        ...next,
        homeLogo: null,
        awayLogo: null,
        homeScore: null,
        awayScore: null,
        scored: false,
        lockedByAdmin: false,
        live: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        syncedAt: FieldValue.serverTimestamp(),
      });
      created++;
      console.log(`   + ${next.homeTeam} – ${next.awayTeam} (${next.matchday}ª) · ${fmt(next.kickoff)}`);
      continue;
    }

    const { id, data } = existing;
    if (data.scored === true || data.lockedByAdmin === true) {
      skipped++;
      continue;
    }
    if (!isAdoption && !hasChanged(data, next)) {
      await col.doc(id).set({ syncedAt: FieldValue.serverTimestamp() }, { merge: true });
      unchanged++;
      continue;
    }
    await col.doc(id).set(
      { ...next, updatedAt: FieldValue.serverTimestamp(), syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    if (isAdoption) {
      adopted++;
      console.log(`   ↪ adottata ${next.homeTeam} – ${next.awayTeam} (${next.matchday}ª) · ${fmt(next.kickoff)}`);
    } else {
      updated++;
      const was = fmt(data.kickoff);
      const now = fmt(next.kickoff);
      const when = was !== now ? ` · ${was} → ${now}` : "";
      console.log(`   ~ ${next.homeTeam} – ${next.awayTeam} (${next.matchday}ª) aggiornata${when}`);
    }
  }

  console.log(
    `\n✅ Fatto. Nuove: ${created} · Adottate: ${adopted} · Aggiornate: ${updated} · Invariate: ${unchanged} · Saltate (admin): ${skipped}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Errore sync:", e.message || e);
    process.exit(1);
  });
