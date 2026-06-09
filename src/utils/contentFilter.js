/* ═══════════════════════════════════════════════════════════════
   CONTENT FILTER — netflaxt-news
   ───────────────────────────────────────────────────────────────
   Modalità STRICT:
   - Normalizza testo: lowercase, rimozione accenti, sostituzione
     leet (0→o 1→i 3→e 4→a 5→s 7→t @→a $→s !→i), spazi tra lettere.
   - Due categorie BLOCCATE → sospensione progressiva:
       • blasphemy  → bestemmie
       • insult     → insulti razzisti/omofobi/personali pesanti
   - PERMESSE (anche in modalità strict):
       cazzo, merda, stronzo (esclamativo), coglione, idiota,
       scemo, pirla, vaffanculo (esclamativo), porca miseria,
       oddio, mannaggia, ecc.
   ═══════════════════════════════════════════════════════════════ */

/* ─── Normalizzazione ─── */
const LEET_MAP = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

export function normalize(text) {
  if (!text) return { spaced: "", tight: "" };
  let n = text.toLowerCase();
  // Strip accents (à→a, è→e, ecc.)
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Leet substitution
  n = n.replace(/[0134578@$!]/g, (c) => LEET_MAP[c] || c);
  // Sostituisci tutto ciò che non è a-z o spazio con uno spazio
  n = n.replace(/[^a-z\s]/g, " ");
  // Collassa spazi multipli
  n = n.replace(/\s+/g, " ").trim();
  // "tight" version: senza spazi (per cattura "d i o c a n e")
  const tight = n.replace(/\s/g, "");
  return { spaced: n, tight };
}

/* ─── Bestemmie (italiano) ─── */
const BLASPHEMY_LIST = [
  // Dio + animale/insulto
  "dio cane", "dio porco", "dio bestia", "dio merda", "dio boia",
  "dio maiale", "dio crepa", "dio stronzo", "dio infame", "dio caro",
  "dio ladro", "dio cretino", "dio schifo", "dio porcello",
  "dio bastardo", "dio stramaledetto", "dio mortacci",
  "porco dio", "porca dio",
  // Madonna
  "madonna puttana", "madonna troia", "madonna cagna",
  "madonna porca", "madonna merda", "madonna ladra",
  "porca madonna",
  // Cristo
  "cristo cane", "cristo porco", "cristo bestia", "cristo merda",
  "cristo boia", "cristo bastardo",
  // Gesù / Gesù Cristo
  "gesu cane", "gesu cristo cane", "gesu cristo bestia",
  "gesu cristo porco", "gesu cristo merda", "gesu cristo boia",
  // Sacro famiglia
  "santissimo dio", "santa madonna puttana",
];

/* ─── Insulti pesanti diretti / slur ─── */
const INSULT_LIST = [
  // Insulti familiari pesanti
  "figlio di puttana", "figlia di puttana", "figli di puttana",
  "figlio di troia", "figlia di troia", "fdp",
  // Slur omofobi
  "frocio", "froci", "froce", "frocia",
  "finocchio", "finocchi",
  "ricchione", "ricchioni",
  "culattone", "culattoni",
  // Slur razzisti / etnici
  "negro di merda", "negra di merda", "sporco negro", "sporca negra",
  "zingaro di merda", "zingara di merda",
  "marocchino di merda", "albanese di merda",
  // Insulti abilistici
  "handicappato", "handicappata", "ritardato", "ritardata",
  "mongoloide", "mongoloidi", "deficiente del cazzo",
  // Attacchi personali forti
  "pezzo di merda", "pezzi di merda",
  "vai a morire", "vai a crepare", "spero che muori",
  "muori male",
  // Vaffanculo diretto (non come esclamazione)
  "vaffanculo tu", "vaffanculo te", "vaffanculo a te",
  "vaffanculo stronzo",
];

/* ─── Compila pattern regex per match parola intera ─── */
function compilePatterns(list) {
  return list.map((phrase) => {
    // Spazi tra parole → spazi opzionali (per match anche su tight)
    const escaped = phrase
      .split(" ")
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s*");
    // Word boundaries esterni
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
  });
}

const BLASPHEMY_PATTERNS = compilePatterns(BLASPHEMY_LIST);
const INSULT_PATTERNS = compilePatterns(INSULT_LIST);

/* ─── Match anche su versione "tight" (no spazi) ─── */
function compileTightPatterns(list) {
  return list.map((phrase) => {
    const tight = phrase.replace(/\s+/g, "");
    const escaped = tight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped);
  });
}

const BLASPHEMY_TIGHT = compileTightPatterns(BLASPHEMY_LIST);
const INSULT_TIGHT = compileTightPatterns(INSULT_LIST);

/* ─── API pubblica ─── */
export function checkText(text) {
  const { spaced, tight } = normalize(text);
  if (!spaced) return { ok: true, type: null, match: null };

  // Pad con spazi per word-boundary su "spaced"
  const padded = ` ${spaced} `;

  // Check bestemmie (priorità più alta)
  for (let i = 0; i < BLASPHEMY_PATTERNS.length; i++) {
    if (BLASPHEMY_PATTERNS[i].test(padded) || BLASPHEMY_TIGHT[i].test(tight)) {
      return { ok: false, type: "blasphemy", match: BLASPHEMY_LIST[i] };
    }
  }

  // Check insulti
  for (let i = 0; i < INSULT_PATTERNS.length; i++) {
    if (INSULT_PATTERNS[i].test(padded) || INSULT_TIGHT[i].test(tight)) {
      return { ok: false, type: "insult", match: INSULT_LIST[i] };
    }
  }

  return { ok: true, type: null, match: null };
}

/* ─── Label per UI ─── */
export const VIOLATION_LABELS = {
  blasphemy: "Bestemmia",
  insult: "Insulto / slur",
};

export const VIOLATION_DESCRIPTIONS = {
  blasphemy:
    "Hai utilizzato una bestemmia. Le bestemmie non sono permesse in chat.",
  insult:
    "Hai utilizzato un insulto pesante o un termine offensivo contro un altro utente.",
};
