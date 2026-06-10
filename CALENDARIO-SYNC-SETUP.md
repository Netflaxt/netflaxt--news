# 🦅 Auto-sync Calendario Lazio — Guida

Questo sistema **carica e tiene aggiornato da solo** il calendario della Lazio
(Serie A) sul sito: prende i dati da **TheSportsDB** (gratis) e li scrive su
Firestore con un piccolo "programmino" che gira su **GitHub Actions** 2 volte al
giorno. Se la Lega sposta o anticipa una partita, entro poche ore è aggiornata
sul sito **senza che tu faccia niente**.

> ✅ Setup già completato. La fonte **TheSportsDB** usa una **chiave gratuita
> pubblica** (`"3"`): **non serve nessun token aggiuntivo**. L'unico secret che
> serve è la chiave Firebase, che hai già impostato.

---

## ✅ Cosa fa, in breve

- **Primo avvio** → carica tutte le ~38 partite della Lazio (Calendario + Pronostici, con countdown).
- **Ogni giorno** → controlla TheSportsDB e aggiorna date/orari spostati.
- **Non tocca mai** i risultati che inserisci a mano nel pannello admin.
- Puoi **bloccare** una singola partita dal pannello admin (🔒) se vuoi gestirla tu.

---

## 🔧 Come funziona (tecnico)

- Script: `scripts/sync-lazio-calendar.mjs`
- Automazione: `.github/workflows/sync-calendar.yml` (cron 2x/giorno + run manuale)
- Fonte dati: TheSportsDB, scaricata **una giornata alla volta** (endpoint
  `eventsround`) così si ottengono tutte le 38 giornate complete anche con la
  chiave gratuita.
- Scrive su Firestore (`matches`) via `firebase-admin` (service account).
- Gira su **Firebase Spark** (niente Cloud Functions/Blaze).

### Secret su GitHub (repo → Settings → Secrets and variables → Actions)

| Name                       | Valore                                   | Obbligatorio |
|----------------------------|------------------------------------------|--------------|
| `FIREBASE_SERVICE_ACCOUNT` | tutto il JSON della chiave service account | ✅ Sì (già fatto) |
| `THESPORTSDB_KEY`          | una tua chiave TheSportsDB                | ⛔ No (default gratis `"3"`) |

> `THESPORTSDB_KEY` serve solo se un domani vuoi una chiave personale (più veloce/
> senza limiti condivisi). Senza, usa la chiave pubblica gratuita.

---

## ▶️ Lanciare / rilanciare il sync

1. Repo GitHub → scheda **Actions** → a sinistra **"Sync calendario Lazio"**
2. Bottone **Run workflow** → branch `main` → **Run workflow**
3. Dopo ~1 minuto apri il log (**sync → Esegui sync**): dovresti leggere
   `Giornate con dati: 38/38 · partite "Lazio" trovate: 38` e `Nuove: 38`.
4. Apri il sito → **Calendario**: ci sono tutte le partite della Lazio 🎉

Da qui in poi è **tutto automatico** (ogni mattina e ogni sera).

---

## 🛠️ Nel pannello admin

- Le partite caricate dal sync hanno il badge **🔄 auto**.
- Se l'orario esatto non è ancora confermato, vedi **"orario da definire"**.
- **🔒 Blocca da sync**: blocca una partita e l'auto-sync non la toccherà più.
- I risultati che inserisci a fine partita **non vengono mai sovrascritti**.

---

## ❓ Problemi comuni

- **Log dice "Nessuna partita trovata"** → TheSportsDB potrebbe avere temporanei
  problemi o la stagione/lega è cambiata. Riprova; intanto puoi inserire partite a mano.
- **Errori HTTP ripetuti** → la chiave pubblica `"3"` è condivisa e a volte
  limitata; in tal caso imposta il secret `THESPORTSDB_KEY` con una tua chiave.
- **Errore service account** → ricontrolla che `FIREBASE_SERVICE_ACCOUNT` contenga
  tutto il JSON.

---

Tutto gratis, resta sul piano **Firebase Spark**.
Fonte dati: [TheSportsDB](https://www.thesportsdb.com/).
