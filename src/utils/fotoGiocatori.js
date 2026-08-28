/* ─────────────────────────────────────────────────────────────
   src/utils/fotoGiocatori.js
   Dal nome che arriva dal servizio partite alla foto nel sito.

   Il servizio scrive i nomi abbreviati e non sempre uguali a come li
   chiamiamo noi: "R. Floriani" per Floriani Mussolini, "N. Tavares"
   per Nuno Tavares. Le foto invece hanno il nome del file, e basta.
   Questa tabella tiene insieme le due cose.

   ⚠️ Quando arriva un giocatore nuovo: metti la foto in
   public/giocatori/ (tutto minuscolo, .webp) e aggiungi qui il suo
   cognome. Se manca, al posto della foto compaiono le iniziali —
   il sito non si rompe, ma la faccia non c'è.
   ───────────────────────────────────────────────────────────── */

/* Cognome (minuscolo, senza accenti) → nome del file, senza estensione.
   Sono elencati solo i casi in cui i due valori NON coincidono: per
   tutti gli altri il cognome è già il nome del file. */
const ECCEZIONI = {
  floriani: "floriani-mussolini",
  mussolini: "floriani-mussolini",
  "floriani mussolini": "floriani-mussolini",
  "dele bashiru": "dele-bashiru",
  "dele-bashiru": "dele-bashiru",
  bashiru: "dele-bashiru",
  bordon: "bordon",
  "nuno tavares": "tavares",
};

/* Foto disponibili nel sito. Serve a non chiedere al browser file che
   non esistono: senza questo elenco ogni giocatore senza foto
   produrrebbe un errore di caricamento visibile in console. */
const DISPONIBILI = new Set([
  "belahyane", "bordon", "cancellieri", "cataldi", "dele-bashiru", "dia",
  "doekhi", "floriani-mussolini", "frattesi", "gigot", "isaksen", "lazzari",
  "mandas", "marusic", "motta", "noslin", "patric", "pedraza", "pellegrini",
  "pinamonti", "provstgaard", "przyborek", "ratkov", "romagnoli", "rovella",
  "sutalo", "tavares", "taylor", "zaccagni",
]);

/** Toglie accenti e punteggiatura, per confrontare nomi scritti in modi diversi. */
function normalizza(testo) {
  return String(testo || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .trim();
}

/**
 * Indirizzo della foto di un giocatore, oppure null se non ce l'abbiamo.
 * @param {string} nomeCompleto es. "M. Zaccagni", "Nuno Tavares"
 */
export function fotoDi(nomeCompleto) {
  const pulito = normalizza(nomeCompleto);
  if (!pulito) return null;

  /* Il servizio abbrevia il nome di battesimo ("M. Zaccagni"): quello che
     resta dopo il puntino è il cognome, ed è la parte che ci interessa. */
  const senzaIniziale = pulito.replace(/^[a-z]\s+/, "");

  const candidati = [
    senzaIniziale,
    senzaIniziale.replace(/\s+/g, "-"),
    senzaIniziale.split(/\s+/).pop(),
    pulito,
  ];

  for (const c of candidati) {
    if (ECCEZIONI[c] && DISPONIBILI.has(ECCEZIONI[c])) {
      return `/giocatori/${ECCEZIONI[c]}.webp`;
    }
    if (DISPONIBILI.has(c)) return `/giocatori/${c}.webp`;
  }
  return null;
}

/** Iniziali di riserva, quando la foto non c'è. */
export function inizialiDi(nomeCompleto) {
  const pulito = normalizza(nomeCompleto).replace(/^[a-z]\s+/, "");
  const parti = pulito.split(/[\s-]+/).filter(Boolean);
  if (!parti.length) return "??";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return (parti[0][0] + parti[parti.length - 1][0]).toUpperCase();
}

/* Cognomi che NON sono l'ultima parola del nome. Sono pochi, ma senza
   questa eccezione "Romano Floriani Mussolini" diventerebbe soltanto
   "Mussolini" — cioè un altro cognome. */
const COGNOMI_INTERI = {
  "romano floriani mussolini": "Floriani Mussolini",
  "floriani mussolini": "Floriani Mussolini",
};

/**
 * Solo il cognome, per mostrarlo grande sulla carta.
 *
 * Il servizio partite scrive i nomi in due modi diversi a seconda di
 * dove li si chiede: abbreviati negli eventi ("M. Zaccagni") e completi
 * nell'elenco di chi ha giocato ("Mattia Zaccagni"). Qui si gestiscono
 * entrambi, altrimenti sulla carta finirebbe il nome intero e non ci
 * starebbe.
 */
export function cognomeDi(nomeCompleto) {
  const grezzo = String(nomeCompleto || "").trim();
  if (!grezzo) return "";

  const chiave = normalizza(grezzo);
  if (COGNOMI_INTERI[chiave]) return COGNOMI_INTERI[chiave];

  // Forma abbreviata: "M. Zaccagni" → quello che segue è già il cognome
  const abbreviato = grezzo.match(/^[A-Za-zÀ-ÿ]\.\s*(.+)$/);
  if (abbreviato) return abbreviato[1].trim();

  // Forma estesa: l'ultima parola è il cognome
  const parti = grezzo.split(/\s+/).filter(Boolean);
  return parti.length > 1 ? parti[parti.length - 1] : grezzo;
}
