# 🦅 Auto-sync Calendario Lazio — Guida setup

Questo sistema **carica e tiene aggiornato da solo** il calendario della Lazio
(Serie A) sul sito: prende i dati da **football-data.org** (gratis) e li scrive
su Firestore con un piccolo "programmino" che gira su **GitHub Actions** 2 volte
al giorno. Se la Lega sposta o anticipa una partita, entro poche ore è aggiornata
sul sito **senza che tu faccia niente**.

> Devi fare questo setup **una volta sola**, dura ~15 minuti. Poi è automatico.

---

## ✅ Cosa fa, in breve

- **Primo avvio** → carica tutte le ~38 partite della Lazio (Calendario + Pronostici, con countdown).
- **Ogni giorno** → controlla football-data.org e aggiorna date/orari spostati.
- **Non tocca mai** i risultati che inserisci a mano nel pannello admin.
- Puoi **bloccare** una singola partita dal pannello admin (🔒) se vuoi gestirla tu.

---

## Passo 1 — Token gratuito football-data.org

1. Vai su **https://www.football-data.org/client/register**
2. Registrati con la tua email (gratis, piano "Free Tier").
3. Ricevi via email un **API Token** (una stringa lunga tipo `a1b2c3d4...`).
4. Tienilo da parte: serve al Passo 3.

> Il piano gratuito include la **Serie A** ed è sufficiente per il calendario.

---

## Passo 2 — Chiave Firebase (service account)

Serve a far scrivere il "programmino" sul tuo database in sicurezza.

1. Apri la **Firebase Console** → progetto **netflaxt-news**.
2. Icona ingranaggio ⚙️ in alto a sinistra → **Impostazioni progetto**.
3. Scheda **Account di servizio** (Service accounts).
4. Clicca **Genera nuova chiave privata** → **Genera chiave**.
5. Si scarica un file **`.json`** → **NON metterlo nel sito, non condividerlo**.
   (È già protetto: il `.gitignore` impedisce di committarlo per sbaglio.)
6. Aprilo con il Blocco note e **copia tutto il contenuto** (da `{` a `}`): serve al Passo 3.

---

## Passo 3 — Aggiungi i 2 "segreti" su GitHub

1. Vai sul repo: **https://github.com/Netflaxt/netflaxt--news**
2. **Settings** (in alto) → menu a sinistra **Secrets and variables** → **Actions**.
3. Bottone **New repository secret** e crea **due** segreti:

   | Name (esatto)              | Secret (valore)                                   |
   |----------------------------|---------------------------------------------------|
   | `FOOTBALL_DATA_TOKEN`      | il token del Passo 1                              |
   | `FIREBASE_SERVICE_ACCOUNT` | **tutto** il contenuto del file `.json` del Passo 2 |

   > Per `FIREBASE_SERVICE_ACCOUNT` incolla l'intero JSON (con le `{ }`).

---

## Passo 4 — Carica i file sul repo

I file del sistema sono già pronti nel progetto:

- `scripts/sync-lazio-calendar.mjs` — il programmino
- `scripts/package.json` — le sue dipendenze
- `.github/workflows/sync-calendar.yml` — l'automazione (cron + bottone manuale)

Vanno semplicemente messi su GitHub (commit + push del branch `main`).
Se vuoi, lo faccio io: **dimmi "fai commit e push del sync"**.

---

## Passo 5 — Primo caricamento (manuale)

1. Sul repo GitHub → scheda **Actions** (in alto).
2. A sinistra scegli **"Sync calendario Lazio"**.
3. Bottone **Run workflow** → **Run workflow** (sul branch `main`).
4. Dopo ~30-60 secondi clicca sull'esecuzione per vedere il log:
   dovresti leggere qualcosa come `Nuove: 38 · Aggiornate: 0`.
5. Apri il sito → **Calendario**: ci sono tutte le partite della Lazio 🎉

Da qui in poi è **tutto automatico**: gira ogni mattina e ogni sera.

---

## 🛠️ Nel pannello admin

- Le partite caricate dal sync hanno il badge **🔄 auto**.
- Se la Lega non ha ancora fissato l'ora esatta, vedi **"orario da definire"**
  (il sito mostra solo il giorno). Quando l'ora viene decisa, si aggiorna da sola.
- **🔒 Blocca da sync**: se vuoi gestire tu una partita (orario speciale,
  amichevole, ecc.), bloccala: l'auto-sync non la toccherà più finché non la sblocchi.
- I risultati che inserisci a fine partita **non vengono mai sovrascritti**.

---

## ❓ Problemi comuni

- **Il log dice "Nessun match restituito"** → la stagione 2026/27 potrebbe non
  essere ancora attiva sul piano free, oppure `SEASON` è errata. Riprova tra qualche
  giorno; nel frattempo puoi inserire le partite a mano come sempre.
- **Errore HTTP 403/429** → token errato o troppe chiamate. Controlla
  `FOOTBALL_DATA_TOKEN`. Il limite gratuito è 10 chiamate/minuto: il sync ne fa 1.
- **Errore sul service account** → ricontrolla di aver incollato **tutto** il JSON
  in `FIREBASE_SERVICE_ACCOUNT`.
- **Voglio cambiare orari del cron** → modifica le righe `cron:` in
  `.github/workflows/sync-calendar.yml` (sono in orario UTC).

---

Tutto gratis, resta sul piano **Firebase Spark** (niente Blaze).
Fonte dati: [football-data.org](https://www.football-data.org/).
