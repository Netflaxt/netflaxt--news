/* ─────────────────────────────────────────────────────────────
   scripts/sync-lazio-calendar.mjs
   Sincronizza il calendario della Lazio (Serie A) da football-data.org
   verso Firestore (collezione "matches"). Gira su GitHub Actions, 2x al
   giorno + manualmente. Carica i match mancanti e aggiorna gli orari/date
   spostati AUTOMATICAMENTE, senza intervento manuale.

   Sicurezza anti-sovrascrittura:
     • non tocca MAI risultato/tabellino inseriti dall'admin (scored=true)
     • salta i match con lockedByAdmin=true (l'admin li "blocca" dal pannello)
     • non sovrascrive un logo personalizzato caricato dall'admin
     • i match creati a mano (senza externalId) non vengono mai toccati

   Variabili d'ambiente (impostate come "secret" su GitHub Actions):
     FOOTBALL_DATA_TOKEN      → token gratuito football-data.org
     FIREBASE_SERVICE_ACCOUNT → JSON chiave service account Firebase
     SEASON                   → anno d'inizio stagione (default 2026 = 2026/27)
     TEAM                     → nome squadra da sincronizzare (default "Lazio")
   ───────────────────────────────────────────────────────────── */
import admin from "firebase-admin";

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const SA_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
const SEASON = process.env.SEASON || "2026";
const TEAM = (process.env.TEAM || "Lazio").trim();
const COMPETITION_CODE = "SA"; // Serie A su football-data.org

const API_BASE = "https://api.football-data.org/v4";

/* ── Validazione ambiente ─────────────────────────────────────── */
if (!FD_TOKEN) {
  console.error("❌ Manca FOOTBALL_DATA_TOKEN (token football-data.org).");
  process.exit(1);
}
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

/* ── Helpers mapping football-data → schema Netflaxt ──────────── */

// È la nostra squadra? (match per sigla TLA o per nome)
function isOurTeam(team) {
  if (!team) return false;
  const target = TEAM.toLowerCase();
  const name = (team.name || "").toLowerCase();
  const short = (team.shortName || "").toLowerCase();
  // Lazio → TLA "LAZ"
  if (target === "lazio" && (team.tla || "").toUpperCase() === "LAZ") return true;
  return name.includes(target) || short.includes(target);
}

// Nome da mostrare: shortName è già "Lazio", "Milan", "Inter"… → ottimo
function displayName(team) {
  return (team?.shortName || team?.name || "").trim();
}

// Stato football-data → stato nostro (scheduled | live | finished)
function mapStatus(fdStatus) {
  switch (fdStatus) {
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    default:
      return "scheduled"; // SCHEDULED, TIMED, POSTPONED, SUSPENDED, CANCELLED
  }
}

// L'orario è confermato? (SCHEDULED = solo data, orario da definire)
function isTimeConfirmed(fdStatus) {
  return ["TIMED", "IN_PLAY", "PAUSED", "FINISHED", "AWARDED", "SUSPENDED"].includes(
    fdStatus
  );
}

// Campi di SOLO calendario (mai punteggio/tabellino) da scrivere su Firestore
function scheduleFields(fm) {
  return {
    homeTeam: displayName(fm.homeTeam),
    awayTeam: displayName(fm.awayTeam),
    homeCrest: fm.homeTeam?.crest || null,
    awayCrest: fm.awayTeam?.crest || null,
    competition: "Serie A",
    matchday: fm.matchday ?? null,
    kickoff: Timestamp.fromDate(new Date(fm.utcDate)),
    status: mapStatus(fm.status),
    postponed: ["POSTPONED", "SUSPENDED", "CANCELLED"].includes(fm.status),
    timeConfirmed: isTimeConfirmed(fm.status),
    externalId: String(fm.id),
    source: "football-data",
  };
}

/* ── Fetch dall'API (con diagnostica robusta) ─────────────────── */
async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": FD_TOKEN },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Scopre qual è la stagione "corrente" che l'API espone per la Serie A
async function discoverCurrentSeason() {
  try {
    const comp = await api(`/competitions/${COMPETITION_CODE}`);
    const cs = comp.currentSeason;
    const year = cs?.startDate ? new Date(cs.startDate).getFullYear() : null;
    console.log(
      `   Stagione corrente su football-data: ${
        year ? `${year}/${year + 1}` : "?"
      } (${cs?.startDate || "?"} → ${cs?.endDate || "?"})`
    );
    return year;
  } catch (e) {
    console.warn(`   (impossibile leggere la stagione corrente: ${e.message})`);
    return null;
  }
}

// Prende i match: prima prova la stagione richiesta, se l'API risponde
// 404/403 ripiega sulla stagione corrente (sempre permessa sul piano free)
async function fetchSeasonMatches(season) {
  try {
    const data = await api(`/competitions/${COMPETITION_CODE}/matches?season=${season}`);
    return { matches: data.matches || [], via: `season=${season}` };
  } catch (e) {
    if (e.status === 404 || e.status === 403) {
      console.log(
        `   La stagione ${season} non è interrogabile direttamente (HTTP ${e.status}). Provo con la stagione corrente…`
      );
      const data = await api(`/competitions/${COMPETITION_CODE}/matches`);
      return { matches: data.matches || [], via: "stagione corrente" };
    }
    throw e;
  }
}

/* ── Confronto: c'è davvero qualcosa di cambiato? ─────────────── */
function kickoffMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
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

/* ── Main ─────────────────────────────────────────────────────── */
async function main() {
  console.log(
    `\n🦅 Sync calendario "${TEAM}" · Serie A · stagione richiesta ${SEASON}/${Number(SEASON) + 1}`
  );

  const curYear = await discoverCurrentSeason();
  const { matches: all, via } = await fetchSeasonMatches(SEASON);
  console.log(`   Ricevuti ${all.length} match (${via}).`);
  if (all.length === 0) {
    console.warn(
      "⚠️  Nessun match restituito. La stagione potrebbe non essere ancora pubblicata. Nessuna scrittura."
    );
    return;
  }

  // Che stagione abbiamo davvero ricevuto?
  const loadedYear = all[0]?.season?.startDate
    ? new Date(all[0].season.startDate).getFullYear()
    : curYear;
  console.log(
    `   Stagione dei dati ricevuti: ${loadedYear ? `${loadedYear}/${loadedYear + 1}` : "?"}`
  );

  // Se NON è la stagione che vogliamo, non scriviamo nulla (per non
  // caricare partite vecchie). Messaggio chiaro per capire il perché.
  if (loadedYear != null && Number(SEASON) !== loadedYear) {
    console.warn(
      `\n⚠️  football-data.org espone ancora la stagione ${loadedYear}/${loadedYear + 1}, ` +
        `non la ${SEASON}/${Number(SEASON) + 1} richiesta.`
    );
    console.warn(
      "   Il calendario nuovo non è ancora disponibile su questa fonte (piano free).\n" +
        "   Non scrivo nulla per non mettere partite della stagione sbagliata.\n" +
        "   → Soluzioni: riprova tra qualche giorno, oppure imposta SEASON sulla stagione corrente.\n"
    );
    return;
  }

  const ours = all.filter((m) => isOurTeam(m.homeTeam) || isOurTeam(m.awayTeam));
  console.log(`   Di cui "${TEAM}": ${ours.length} partite.`);
  if (ours.length === 0) {
    console.warn(`⚠️  Nessuna partita di "${TEAM}" trovata. Controlla il nome squadra. Nessuna scrittura.`);
    return;
  }

  const col = db.collection("matches");
  let created = 0;
  let updated = 0;
  let skippedLocked = 0;
  let unchanged = 0;

  for (const fm of ours) {
    const next = scheduleFields(fm);
    const snap = await col.where("externalId", "==", next.externalId).limit(1).get();

    if (snap.empty) {
      await col.add({
        ...next,
        // logo: lasciati vuoti → il sito usa i loghi locali (logoForTeam),
        // con fallback automatico al crest dell'API per le squadre fuori lista
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

    // Rispetta le scelte dell'admin: risultato finalizzato o match "bloccato"
    if (existing.scored === true || existing.lockedByAdmin === true) {
      skippedLocked++;
      continue;
    }

    if (!hasChanged(existing, next)) {
      // aggiorna comunque syncedAt (heartbeat) senza rumore
      await docRef.set({ syncedAt: FieldValue.serverTimestamp() }, { merge: true });
      unchanged++;
      continue;
    }

    // Solo campi calendario: NON tocchiamo homeScore/awayScore/events/scored/logo
    await docRef.set(
      { ...next, updatedAt: FieldValue.serverTimestamp(), syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    updated++;
    const was = fmtDate(existing.kickoff);
    const now = fmtDate(next.kickoff);
    const when = was !== now ? ` · orario ${was} → ${now}` : "";
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
