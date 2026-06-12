/* ─────────────────────────────────────────────────────────────
   src/utils/matches.js
   Calendario partite (#16). Sorgente dati: Firestore `matches`.
   Campi:
     - homeTeam, awayTeam: string
     - homeLogo, awayLogo: string|null
     - competition: string (es. "Serie A")
     - matchday: number|null (giornata)
     - kickoff: Timestamp
     - status: "scheduled" | "live" | "finished"
     - homeScore, awayScore: number|null
     - scored: boolean (pronostici già valutati)
     - externalId: string|null (id football-data.org per l'auto-sync)
     - homeCrest, awayCrest: string|null (logo dall'API, fallback)
     - timeConfirmed: boolean (false = orario ancora da definire)
     - postponed: boolean (rinviata/sospesa)
     - lockedByAdmin: boolean (true → l'auto-sync NON la tocca)
     - source: "manual" | "football-data"
     - createdAt, updatedAt, syncedAt
   Auto-sync: lo script scripts/sync-lazio-calendar.mjs (GitHub Actions)
   aggiorna le partite per externalId. Non sovrascrive mai i risultati
   inseriti a mano (scored=true) né i match con lockedByAdmin=true.
   ───────────────────────────────────────────────────────────── */
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { scoreMatch } from "./predictions";

const COMPETITIONS = ["Serie A", "Coppa Italia", "Europa League", "Champions League", "Amichevole"];

/** Sottoscrive tutte le partite ordinate per data di inizio. */
export function subscribeMatches(cb, onError) {
  const q = query(collection(db, "matches"), orderBy("kickoff", "asc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => {
      console.error("Errore lettura partite:", e);
      onError && onError(e);
    }
  );
}

/** Lista una tantum (per pannelli admin). */
export async function listMatches() {
  const q = query(collection(db, "matches"), orderBy("kickoff", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function toTimestamp(kickoff) {
  if (!kickoff) return null;
  if (kickoff instanceof Date) return Timestamp.fromDate(kickoff);
  if (typeof kickoff === "string") {
    const d = new Date(kickoff);
    return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
  }
  return kickoff; // già Timestamp
}

export async function createMatch(data) {
  const payload = {
    homeTeam: (data.homeTeam || "").trim(),
    awayTeam: (data.awayTeam || "").trim(),
    homeLogo: data.homeLogo || null,
    awayLogo: data.awayLogo || null,
    homeCrest: data.homeCrest || null,
    awayCrest: data.awayCrest || null,
    competition: data.competition || "Serie A",
    matchday: data.matchday != null && data.matchday !== "" ? Number(data.matchday) : null,
    kickoff: toTimestamp(data.kickoff),
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    scored: false,
    externalId: data.externalId || null,
    // Partita creata a mano: orario certo, non gestita dall'auto-sync
    timeConfirmed: true,
    postponed: false,
    lockedByAdmin: false,
    source: "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!payload.homeTeam || !payload.awayTeam) throw new Error("Inserisci entrambe le squadre");
  if (!payload.kickoff) throw new Error("Inserisci data e ora del match");
  const ref = await addDoc(collection(db, "matches"), payload);
  return ref.id;
}

export async function updateMatch(id, data) {
  if (!id) throw new Error("id mancante");
  const patch = { updatedAt: serverTimestamp() };
  if (data.homeTeam != null) patch.homeTeam = data.homeTeam.trim();
  if (data.awayTeam != null) patch.awayTeam = data.awayTeam.trim();
  if (data.homeLogo !== undefined) patch.homeLogo = data.homeLogo || null;
  if (data.awayLogo !== undefined) patch.awayLogo = data.awayLogo || null;
  if (data.competition != null) patch.competition = data.competition;
  if (data.matchday !== undefined)
    patch.matchday = data.matchday !== "" && data.matchday != null ? Number(data.matchday) : null;
  if (data.kickoff !== undefined) {
    patch.kickoff = toTimestamp(data.kickoff);
    // Se l'admin imposta a mano data/ora, l'orario è da considerarsi certo
    patch.timeConfirmed = true;
  }
  if (data.status != null) patch.status = data.status;
  if (data.lockedByAdmin !== undefined) patch.lockedByAdmin = !!data.lockedByAdmin;
  if (data.timeConfirmed !== undefined) patch.timeConfirmed = !!data.timeConfirmed;
  if (data.postponed !== undefined) patch.postponed = !!data.postponed;
  if (data.homeCrest !== undefined) patch.homeCrest = data.homeCrest || null;
  if (data.awayCrest !== undefined) patch.awayCrest = data.awayCrest || null;
  await updateDoc(doc(db, "matches", id), patch);
}

/** Blocca/sblocca una partita dall'auto-sync (toggle rapido admin). */
export async function setMatchLock(id, locked) {
  if (!id) throw new Error("id mancante");
  await updateDoc(doc(db, "matches", id), {
    lockedByAdmin: !!locked,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Imposta/aggiorna lo stato LIVE di una partita. Usato dal poller live
 * (Cloudflare Worker) e dal bottone "Simula live" dell'admin per testare.
 * status: "1H"|"HT"|"2H"|"ET"|"BT"|"P"|"FT"|... (codici API-Football)
 */
export async function setLiveState(id, { status, minute, extra = null, home = null, away = null }) {
  if (!id) throw new Error("id mancante");
  await updateDoc(doc(db, "matches", id), {
    live: true,
    liveStatus: status || "2H",
    liveMinute: minute != null ? Number(minute) : null,
    liveExtra: extra != null ? Number(extra) : null,
    liveHome: home != null ? Number(home) : null,
    liveAway: away != null ? Number(away) : null,
    liveUpdatedAt: serverTimestamp(),
  });
}

/** Spegne lo stato LIVE di una partita. */
export async function clearLiveState(id) {
  if (!id) throw new Error("id mancante");
  await updateDoc(doc(db, "matches", id), {
    live: false,
    liveUpdatedAt: serverTimestamp(),
  });
}

export async function deleteMatch(id) {
  if (!id) return;
  await deleteDoc(doc(db, "matches", id));
}

function sanitizeEvents(events) {
  return (events || [])
    .filter((e) => e && (e.player || e.minute != null))
    .map((e) => ({
      team: e.team === "away" ? "away" : "home",
      type: ["goal", "penalty", "owngoal", "yellow", "red", "injury"].includes(e.type)
        ? e.type
        : "goal",
      player: (e.player || "").trim().slice(0, 60),
      minute:
        e.minute === "" || e.minute == null || Number.isNaN(Number(e.minute))
          ? null
          : Math.max(0, Math.min(130, Number(e.minute))),
    }))
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
}

/**
 * Finalizza il risultato di una partita (con eventuale tabellino) e
 * assegna i punti ai pronostici.
 */
export async function finalizeMatch(match, homeScore, awayScore, events = []) {
  if (!match?.id) throw new Error("Match mancante");
  const h = parseInt(homeScore, 10);
  const a = parseInt(awayScore, 10);
  if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
    throw new Error("Inserisci un risultato valido");
  }
  await updateDoc(doc(db, "matches", match.id), {
    homeScore: h,
    awayScore: a,
    status: "finished",
    scored: true,
    events: sanitizeEvents(events),
    updatedAt: serverTimestamp(),
  });
  const result = await scoreMatch({ ...match, homeScore: h, awayScore: a });
  return result;
}

/* Tipi di evento del tabellino + meta per la UI */
export const EVENT_TYPES = [
  { key: "goal", label: "Gol", icon: "⚽", isGoal: true },
  { key: "penalty", label: "Rigore", icon: "⚽", isGoal: true },
  { key: "owngoal", label: "Autogol", icon: "⚽", isGoal: true },
  { key: "yellow", label: "Ammonizione", icon: "🟨" },
  { key: "red", label: "Espulsione", icon: "🟥" },
  { key: "injury", label: "Infortunio", icon: "🚑" },
];

/* Calcola il punteggio dai gol presenti negli eventi */
export function scoreFromEvents(events) {
  let home = 0;
  let away = 0;
  (events || []).forEach((e) => {
    const goalTypes = ["goal", "penalty", "owngoal"];
    if (!goalTypes.includes(e.type)) return;
    const benefits = e.type === "owngoal" ? (e.team === "home" ? "away" : "home") : e.team;
    if (benefits === "home") home += 1;
    else away += 1;
  });
  return { home, away };
}

export { COMPETITIONS };
