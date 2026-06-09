/* ─────────────────────────────────────────────────────────────
   src/utils/teamLogos.js
   Risoluzione automatica del logo squadra dal nome.
   Sorgente: file PNG/WEBP UFFICIALI servititi staticamente da
   /public/team-logos/. Niente dipendenze da CDN esterni →
   loghi sempre visibili anche offline, senza problemi di CORS.
   Se la squadra non è in mappa → null → l'admin può caricare
   il logo dal PC dal pannello partite.
   ───────────────────────────────────────────────────────────── */

// nome canonico (normalizzato) → path locale del file
const TEAM_LOGOS = {
  // Serie A 2026/27 (file in public/team-logos/*)
  atalanta: "/team-logos/atalanta.png",
  bologna: "/team-logos/bologna.png",
  cagliari: "/team-logos/cagliari.png",
  como: "/team-logos/como.png",
  fiorentina: "/team-logos/fiorentina.png",
  frosinone: "/team-logos/frosinone.png",
  genoa: "/team-logos/genoa.png",
  inter: "/team-logos/inter.webp",
  juventus: "/team-logos/juventus.png",
  lazio: "/team-logos/lazio.png",
  lecce: "/team-logos/lecce.png",
  milan: "/team-logos/milan.webp",
  monza: "/team-logos/monza.png",
  napoli: "/team-logos/napoli.png",
  parma: "/team-logos/parma.png",
  roma: "/team-logos/roma.png",
  sassuolo: "/team-logos/sassuolo.png",
  torino: "/team-logos/torino.png",
  udinese: "/team-logos/udinese.png",
  venezia: "/team-logos/venezia.png",
};

// alias / nomi alternativi → nome canonico
const ALIASES = {
  internazionale: "inter",
  "inter milan": "inter",
  "ac milan": "milan",
  "ssc napoli": "napoli",
  juve: "juventus",
  "as roma": "roma",
  "ss lazio": "lazio",
  "acf fiorentina": "fiorentina",
  "us lecce": "lecce",
  "torino fc": "torino",
  "ac monza": "monza",
  "us sassuolo": "sassuolo",
  "parma calcio": "parma",
  "venezia fc": "venezia",
  "como 1907": "como",
  "frosinone calcio": "frosinone",
};

/**
 * Squadre della Serie A 2026/2027 — lista ufficiale per il selettore
 * dell'admin. Ordine alfabetico, nome così come va mostrato in UI.
 */
export const SERIE_A_TEAMS_2026_27 = [
  "Atalanta",
  "Bologna",
  "Cagliari",
  "Como",
  "Fiorentina",
  "Frosinone",
  "Genoa",
  "Inter",
  "Juventus",
  "Lazio",
  "Lecce",
  "Milan",
  "Monza",
  "Napoli",
  "Parma",
  "Roma",
  "Sassuolo",
  "Torino",
  "Udinese",
  "Venezia",
];

function normalize(name) {
  if (!name) return "";
  return name
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\b(fc|ac|ssc|us|ssd|as|ss|acf|calcio|1907|1909|1913)\b/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Restituisce l'URL del logo per il nome squadra, o null se sconosciuto. */
export function logoForTeam(name) {
  const n = normalize(name);
  if (!n) return null;
  if (ALIASES[n] && TEAM_LOGOS[ALIASES[n]]) return TEAM_LOGOS[ALIASES[n]];
  if (TEAM_LOGOS[n]) return TEAM_LOGOS[n];
  // match per sottostringa (gestisce prefissi/suffissi residui)
  for (const key of Object.keys(TEAM_LOGOS)) {
    if (n.includes(key)) return TEAM_LOGOS[key];
  }
  return null;
}
