# 🦅 Auto-sync Calendario Lazio — Guida

Questo sistema **carica e tiene aggiornato da solo** il calendario della Lazio
(Serie A) sul sito: prende i dati da **API-Football** (la stessa fonte del minuto
live) e li scrive su Firestore con un "programmino" che gira su **GitHub Actions**
2 volte al giorno. Anticipi e posticipi ufficiali compaiono **da soli**.

> **Perché API-Football:** una sola chiamata prende tutte le 38 partite, è una
> fonte professionale (più aggiornata di TheSportsDB) e dice da sola se l'orario
> è **ufficiale** (`NS`) o ancora **da definire** (`TBD`) → il sito mostra
> "Data da confermare" solo quando serve davvero.

---

## ✅ Cosa fa, in breve

- **Carica** tutte le ~38 partite della Lazio (Calendario + Pronostici, countdown).
- **Ogni giorno** aggiorna date/orari spostati con quelli **ufficiali**.
- **Non tocca mai** i risultati che inserisci a mano, né i campi del minuto live.
- Puoi **bloccare** una singola partita dal pannello admin (🔒).

---

## 🔧 Setup (una volta sola)

### 1) Aggiungi il secret della chiave API-Football su GitHub
È la **stessa chiave** che hai usato per il poller live (account api-football.com).

1. Repo GitHub → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**:

| Name              | Valore                          |
|-------------------|---------------------------------|
| `APIFOOTBALL_KEY` | la tua chiave API-Football      |

> Il secret `FIREBASE_SERVICE_ACCOUNT` ce l'hai già dal setup precedente.
> (Se avevi `THESPORTSDB_KEY`, ora non serve più — puoi lasciarlo o cancellarlo.)

### 2) Lancia il sync
1. Repo GitHub → scheda **Actions** → **"Sync calendario Lazio"**
2. **Run workflow** → branch `main` → **Run workflow**
3. Dopo ~30 sec apri il log (**Esegui sync**): dovresti leggere tipo
   `Ricevute 38 partite` e `Adottate: 38` (la prima volta adotta i match già
   esistenti aggiornandoli con le date ufficiali — **niente doppioni**).
4. Apri il sito → **Calendario**: ora vedi le **date e gli orari ufficiali**. 🎉

Da qui in poi è **tutto automatico** (ogni mattina e ogni sera).

---

## 🛠️ Nel pannello admin

- Le partite del sync hanno il badge **🔄 auto**.
- Se l'orario non è ancora ufficiale (API-Football lo segna `TBD`), il sito
  mostra **"Data da confermare"** (e si aggiorna da solo quando esce l'ufficiale).
- **🔒 Blocca da sync**: blocca una partita e l'auto-sync non la toccherà più.
- I risultati che inserisci a fine partita **non vengono mai sovrascritti**.

---

## ❓ Problemi comuni

- **Log: "Nessuna partita restituita"** → controlla `SEASON`/`LEAGUE_ID`/`TEAM_ID`
  nel workflow (2026 / 135 / 487) o riprova più tardi.
- **Errore HTTP 401/403** → chiave `APIFOOTBALL_KEY` errata o assente.
- **Errore service account** → ricontrolla `FIREBASE_SERVICE_ACCOUNT`.
- **Limite chiamate**: piano free 100/giorno. Il sync ne usa 1-2; il poller live
  ~75 nei giorni di partita → si resta sotto i 100.

---

Tutto gratis, resta sul piano **Firebase Spark**.
Fonte dati: [API-Football](https://www.api-football.com/).
