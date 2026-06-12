# 🔴 Live poller — minuto in diretta delle partite Lazio

Questo "programmino" gira su **Cloudflare** ogni 2 minuti. Quando c'è una
partita della Lazio **in corso**, legge da **API-Football** (minuto, recupero,
stato, risultato) e lo scrive su Firestore. Il sito mostra il ticker live in
tempo reale (Live lampeggiante, 12'→13', 45+5', "Fine 1° tempo", "Fine partita").

> Setup **una volta sola**, ~15 minuti. Poi è tutto automatico e **gratis**.
> Il sito è già pronto a mostrare i dati: questo Worker li fornisce.

---

## Passo 1 — Chiave API-Football (gratis)
1. Registrati su **https://dashboard.api-football.com/register**
2. Nel dashboard, copia la tua **API Key** (sezione "API KEY" / "Account").
   Piano gratuito: 100 richieste/giorno (a noi bastano: ~75 per partita).

## Passo 2 — Account Cloudflare (gratis)
1. Crea un account su **https://dash.cloudflare.com/sign-up** (gratis, no carta).

## Passo 3 — Installa gli strumenti (sul tuo PC)
Apri il terminale **dentro** la cartella `scripts/live-poller` ed esegui:
```
npm install
npx wrangler login
```
(`wrangler login` apre il browser per collegare il tuo account Cloudflare.)

## Passo 4 — Imposta i 2 segreti
```
npx wrangler secret put APIFOOTBALL_KEY
```
→ incolla la chiave del Passo 1, invio.

```
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
```
→ incolla **tutto** il contenuto del file `.json` della chiave Firebase
   (la **stessa** che usi per il sync del calendario), invio.

## Passo 5 — Pubblica
```
npx wrangler deploy
```
A fine deploy ti dà un **URL** del Worker (es. `https://netflaxt-live-poller.tuonome.workers.dev`).

## Passo 6 — Prova
Apri quell'URL nel browser. Deve rispondere con un JSON tipo:
```json
{ "skipped": "nessuna partita nella finestra" }
```
✅ Vuol dire che funziona (e che ora non c'è una partita in corso).
Durante una partita della Lazio risponderà con minuto/stato/risultato, e il
**sito mostrerà il ticker live da solo**.

---

## Come funziona (tecnico)
- Cron ogni 2 min. Ogni run **legge prima Firestore** (gratis) per vedere se
  siamo nella finestra di una partita Lazio (da −10 min a +150 min dal kickoff).
- Solo in quel caso chiama **API-Football** (`/fixtures?team=487&date=oggi`) →
  così si consumano ~75 chiamate per partita (sotto le 100/giorno gratuite).
- Mappa `status.short` (1H/HT/2H/ET/P/FT…), `status.elapsed` (minuto),
  `status.extra` (recupero), `goals` (risultato) → li scrive su `matches/{id}`.
- Il sito interpola il minuto col clock locale, così **ticchetta ogni minuto**
  anche se il poller aggiorna ogni 2 min.
- Non tocca i risultati/pronostici: quando l'admin finalizza, il live sparisce.

## Diagnostica
- Log in tempo reale: `npx wrangler tail`
- Errore `token:` o `patch HTTP 403` → ricontrolla `FIREBASE_SERVICE_ACCOUNT`.
- Errore `API-Football HTTP 401/403` → ricontrolla `APIFOOTBALL_KEY`.
- Per cambiare squadra: variabile `TEAM_ID` in `wrangler.toml`.

Tutto gratis. Fonte dati: [API-Football](https://www.api-football.com/).
