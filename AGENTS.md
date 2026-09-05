# Netflaxt News — istruzioni per chi lavora al progetto

Questo file è la consegna del progetto a un assistente nuovo. Leggilo prima di
toccare qualsiasi cosa: quasi tutto quello che c'è scritto è stato imparato
rompendo qualcosa in produzione, con utenti veri collegati.

> ⚠️ **Il repository è pubblico.** Non scrivere mai chiavi, token o segreti in
> nessun file versionato. Qui sotto i segreti sono citati solo per nome.

---

## 1. Cos'è, e con chi parli

**Netflaxt News** (https://netflaxt.it) è un sito di tifosi della **SS Lazio**:
notizie, chat dal vivo, pronostici, classifica, quiz, pagelle dei giocatori.
È **online e in uso**: al 30/08/2026 ha oltre 120 iscritti registrati.

Il proprietario è anche l'unico amministratore. È italiano e **va risposto in
italiano**. Non è uno sviluppatore: conosce benissimo il suo sito dal lato di
chi lo usa, non dal lato del codice. Quindi:

- Spiega **cosa cambia per lui e per i tifosi**, non come è scritta la funzione.
- Evita il gergo tecnico inglese quando esiste una parola italiana.
- Quando gli chiedi di fare qualcosa fuori dall'editor (console Firebase,
  GitHub, DNS), scrivi i passaggi uno per uno, con il nome esatto dei bottoni.
- Quando qualcosa non funziona, dagli il **fatto misurato**, non l'ipotesi.

---

## 2. Come si lavora qui (la parte più importante)

Queste regole vengono da errori reali fatti su questo progetto. Non sono stile:
sono le cose che, quando sono state ignorate, hanno rotto il sito.

**Misura, non dedurre.** Le diagnosi a tavolino su questo progetto hanno
sbagliato bersaglio quasi ogni volta. C'è una diagnostica già pronta (§8):
usala. Se manca lo strumento per misurare, il primo lavoro è **costruire lo
strumento**, non indovinare.

**Verifica il risultato, non la procedura.** Un rilascio "verde" dice che i
comandi sono andati a termine, non che il sito sia giusto. Il 29/08/2026 la
pubblicazione automatica è andata a buon fine e ha messo online un sito in cui
**nessuno poteva più caricare un'immagine**, per ore.

**Verifica quello che c'era prima, non solo quello che hai aggiunto.** Quando
cambia *come* il sito viene costruito o pubblicato, è il vecchio ad avere più
bisogno di controlli.

**Dove un guasto può passare inosservato, metti un blocco automatico.** Non un
promemoria. Verde su una cosa rotta è peggio di rosso.

**Non dire "funziona tutto"** per aver verificato la parte nuova. Elenca cosa
hai visto funzionare e cosa no.

**Segui le convenzioni già presenti.** Token semantici Tailwind
(`bg-bg-base`, `text-text-primary`, `text-accent`), font display Bebas Neue nei
titoli, stati di caricamento e vuoto curati. I commenti nel codice sono in
italiano e spiegano **perché**, spesso citando il guasto che hanno risolto: è
voluto, continua così.

**Il lint è già rosso in partenza** (`eslint-plugin-react-hooks` v7 molto
severo su codice preesistente). Usa `npm run build` come cancello, non il lint.

**Dopo ogni pubblicazione, fai commit e push** su GitHub: il proprietario
pubblica da locale e vuole il repository sempre allineato al sito vivo.

---

## 3. Struttura e comandi

React 19 + Vite + Tailwind v4 (tema scuro con token CSS) + Firebase.

```
npm run dev      # sviluppo
npm run build    # compila E genera mappa/pagine SEO (vedi §6)
npm run lint     # già rosso, non usarlo come cancello
```

```
src/pages/          29 pagine (Home, News, Chat, Pronostici, Classifica, Admin…)
src/pages/admin/    11 schede del pannello di amministrazione
src/components/     54 componenti
src/utils/          35 moduli di logica (matches, pagelle, predictions, push…)
src/firebase/       configurazione Firebase (un solo file)
scripts/live-poller/    Cloudflare Worker: diretta partite, notifiche, newsletter
scripts/prepara-seo.mjs mappa del sito + pagine articolo, gira dopo il build
scripts/sync-lazio-calendar.mjs  calendario Serie A
.github/workflows/  due procedure automatiche (vedi §6)
firestore.rules     regole di sicurezza — SI PUBBLICANO DA QUI
database.rules.json regole chat — NON si pubblicano da qui (vedi §7)
```

---

## 4. Dove stanno i dati

L'amministratore è riconosciuto dall'indirizzo email, sia nel sito sia nelle
regole (`isAdmin()` in `firestore.rules`).

**Firestore** — articoli, utenti, partite, pronostici, sondaggi, pagelle.
**Realtime Database** — chat, presenza, "sta scrivendo", sondaggi in chat.

⚠️ **I dati personali sono divisi apposta.** Il 24/08/2026 si è scoperto che
chiunque, senza account, poteva scaricare l'elenco completo degli iscritti con
email e sanzioni. Da allora:

| Collezione | Cosa contiene | Chi legge |
|---|---|---|
| `users/{uid}` | solo dati da vetrina: nome, foto, badge, punti | singolo: tutti · elenco: solo admin |
| `contattiUtenti/{uid}` | email | interessato + admin |
| `moderazione/{uid}` | sanzioni | interessato + admin |
| `tokenDispositivi/{uid}` | dispositivi per le notifiche | interessato + admin |
| `classifica/{uid}` | nome, foto, punti quiz | pubblico |

**Non rimettere `allow read` su `users`**: comprende anche gli elenchi. La
pagina Classifica legge da `classifica` proprio per non toccare `users`.

Le migrazioni avvengono da sole al primo accesso (`src/utils/datiPrivati.js`).
La pagina **`/controllo`** (solo admin) mostra se sono andate a buon fine.

**Limite noto:** senza un server, la sanzione a un utente la scrive il browser
dell'utente sanzionato. Chi ha competenze tecniche può annullarsela. È
documentato in `src/utils/moderationService.js`.

---

## 5. Servizi esterni

| Servizio | A cosa serve | Segreto (nome soltanto) |
|---|---|---|
| Firebase | sito, database, accessi, notifiche | `FIREBASE_SERVICE_ACCOUNT` (GitHub) |
| Cloudinary | **tutte** le immagini e i video caricati | `VITE_CLOUDINARY_*` (GitHub + `.env`) |
| API-Football | diretta partite e pagelle | `APIFOOTBALL_KEY` (Cloudflare) |
| TheSportsDB | calendario Serie A | opzionale, ripiego su chiave pubblica |
| Resend | newsletter | `RESEND_KEY` (Cloudflare) |
| Cloudflare | Worker della diretta | `ADMIN_KEY` (Cloudflare) |

⚠️ **`FIREBASE_SERVICE_ACCOUNT` su GitHub è condiviso** fra la pubblicazione
notturna e il sincronizzatore del calendario. Sovrascriverlo rompe il calendario.

⚠️ **API-Football, piano gratuito:** 100 richieste al giorno **e 10 al minuto**.
Il limite che dà problemi è quello al minuto. Inoltre il piano gratuito accede
solo alle stagioni 2022-2024 per le richieste con `?season=`: per questo il
calendario usa TheSportsDB e la diretta usa `?live=all`, che invece funziona.

---

## 6. Come si pubblica

```bash
npm run build && npx firebase deploy --only hosting
npx firebase deploy --only firestore:rules     # regole
cd scripts/live-poller && npx wrangler deploy  # servizio partite
```

Poi **commit e push**.

Esiste anche una **pubblicazione notturna** (`.github/workflows/pubblica-sito.yml`,
ogni notte alle 5:30) che ricompila il sito su GitHub e lo ripubblica. Serve a
rigenerare la mappa per Google con gli articoli nuovi, perché gli articoli si
scrivono dal pannello e non passano dal codice.

### ⚠️ Le tre trappole della pubblicazione

**1. Il file `.env` non esiste su GitHub.** Le uniche variabili di compilazione
sono `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET`. Vite le
incorpora al momento del build: se mancano diventano vuote e **ogni caricamento
di file fallisce** — foto profilo, immagini in chat, foto e video degli
articoli, tutto insieme — mentre la compilazione riesce lo stesso. Nel workflow
ci sono ora due controlli che fermano la pubblicazione se mancano. Non toglierli.

**2. Pubblicare `firestore.rules` sostituisce le regole scritte in console.**
Tutto quello che esisteva solo lì sparisce, e il blocco che nega tutto in fondo
al file lo intercetta in silenzio. Così sono spariti l'accesso a `config`
(stato del sito) e il permesso dell'admin di assegnare i punti ai pronostici.
**Prima di pubblicare le regole, controlla che ogni collezione usata dal codice
abbia il suo blocco.**

**3. Una ricerca trasversale (`collectionGroup`) è autorizzata SOLO da una
regola col percorso jolly** — `match /{percorso=**}/comments/{id}`. La regola
annidata equivalente non vale, anche se concede gli stessi permessi.

### Come si controllano i permessi davvero

Leggendo il database senza account, come farebbe un estraneo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://firestore.googleapis.com/v1/projects/netflaxt-news/databases/(default)/documents/users?pageSize=1"
```

`200` = pubblica, `403` = negata. Devono essere pubbliche: `articles`,
`classifica`, `matches`, `pagelle`, `config`, i commenti di un articolo.
Devono essere negate: `users`, `sistema`, `contattiUtenti`, `moderazione`,
`newsletter`, `pushQueue`, `reports`.

---

## 7. Il servizio partite (la parte più delicata)

`scripts/live-poller/` è un Cloudflare Worker che parte **ogni 2 minuti** e fa
quattro cose: aggiorna la partita in diretta, spedisce le notifiche in coda,
spedisce la newsletter, recupera le pagelle non aperte.

La catena completa, osservata funzionare per intero il 30/08/2026:

```
diretta ogni 2 min → chiusura al fischio finale → punti ai pronostici → pagelle
```

### Regole da rispettare

⚠️ **Ogni chiamata automatica ad API-Football deve passare da `chiediApi()`.**
Quella funzione riprova 4 volte distribuite su un minuto quando l'API rifiuta
per "troppe richieste". Un rifiuto per fretta **non consuma** il credito
giornaliero, quindi riprovare è quasi gratis. La prima versione aveva questa
pazienza solo sulla diretta: le pagelle non si aprirono per lo stesso identico
rifiuto.

⚠️ **Una risposta con errori non significa "partita finita".** API-Football,
quando rifiuta, risponde comunque `200` con un elenco vuoto e il motivo dentro
`errors`. Il codice lo interpretava come "la Lazio non è più fra le partite in
diretta, quindi è finita": il 24/08/2026 ha dichiarato finita Bologna-Lazio
mentre si giocava ancora, assegnando i punti su un punteggio parziale. Ora
esiste `attendibile`: una risposta inaffidabile vale "non lo so", mai "è finita".

⚠️ **Il minuto sullo schermo è una stima.** Il sito prende l'ultimo minuto vero
e ci somma il tempo passato (con un tetto di 3 minuti). Uno schermo che avanza
**non prova** che il servizio funzioni: controlla sempre `liveUpdatedAt`. Oltre
3 minuti senza aggiornamenti il badge lo dichiara ("· in ritardo", pallino
spento) invece di far finta di sapere.

⚠️ **Durante una partita non interrogare il Worker a mano.** Ogni chiamata
consuma una richiesta all'API e lo manda contro il limite al minuto: è successo
davvero, e il servizio si è fermato per colpa della diagnosi. Leggere Firestore
via REST invece è gratuito: usa quello.

⚠️ **Non chiudere una partita dal pannello mentre è in corso.** L'editor del
risultato contiene anche il tabellino: finché la gara è in corso il salvataggio
aggiorna **solo** gli eventi (`saveMatchEvents`), non chiude niente. La chiusura
manuale esiste ma va chiesta e confermata. Il bottone "Simula live" è un
attrezzo da collaudo e si rifiuta di agire su una partita già iniziata.

### Reti di sicurezza già presenti (non toglierle)

- Se l'API tace del tutto, la partita si chiude comunque **165 minuti** dopo il
  fischio d'inizio, senza chiedere niente a nessuno.
- Se le pagelle non si aprono, la partita resta segnata `pagelleDaAprire` e il
  servizio riprova a ogni giro finché non ci riesce.
- Il pannello ha "Chiudi la partita a mano" con conferma.

### Le regole della chat non si pubblicano da qui

La sezione `database` è stata **volutamente tolta** da `firebase.json`, perché
`database.rules.json` non è verificato e una pubblicazione completa
sovrascriverebbe le regole attive con un file forse vecchio. Le regole della
chat si modificano a mano in console.

---

## 8. Diagnostica già pronta

Sul Worker, tutte con `&key=` (la chiave è il segreto `ADMIN_KEY` su
Cloudflare, **mai** nel repository):

| Indirizzo | Cosa mostra |
|---|---|
| `?diag=api` | credito residuo giornaliero e al minuto, errori, partita trovata |
| `?diag=coda` | battito del servizio, chiamate fatte oggi, ultime notifiche |
| `?diag=push` | stato dei dispositivi registrati |
| `?diag=accessi` | ultimi esiti di invio delle email di approvazione |
| `?prova=push` / `?prova=coda` | invio di prova, singolo o dell'intera catena |
| `?riapri=<id>` | rimette in corso una partita chiusa per errore |
| `?apriPagelle=<id>` | apre le pagelle a mano |
| `?cancellaPartita=<id>` | elimina un documento partita creato per sbaglio |

⚠️ `?riapri=` **forza `liveStatus: 2H`**: va bene a fine gara, non a metà primo
tempo.

⚠️ Scrivere su un identificativo inesistente non dà errore: lo **crea**. Un
identificativo accorciato ha già generato una partita fantasma nel calendario.

Nel sito: la pagina **`/controllo`** (solo admin) verifica lo stato dei dati
personali dell'account collegato.

---

## 9. Altre trappole già pagate

**Notifiche push** — se il messaggio contiene il campo `notification`, **non**
registrare `onBackgroundMessage`: l'SDK la mostra da solo. Registrarlo con un
corpo vuoto significa che non la mostra nessuno; registrarlo e chiamare anche
`showNotification()` la mostra due volte.

**Cache dei service worker** — in `firebase.json` la regola generica sui `.js`
(un anno, immutabile) **prevale su quelle scritte prima di lei**. I service
worker vanno in fondo all'array `headers`, altrimenti una correzione non
raggiunge mai i dispositivi e un errore diventa permanente.

**Accesso con Google** — `authDomain` in `src/firebase/firebase.js` deve essere
`netflaxt.it`, non `netflaxt-news.firebaseapp.com`. La configurazione che la
console Firebase propone contiene **sempre** quest'ultimo: se qualcuno la
ricopia, l'accesso torna a fallire a intermittenza. Nei browser dentro le app
(Instagram, Facebook) l'accesso con Google non funziona per limiti loro: il
sito lo rileva e mostra un avviso.

**Finestre di dialogo** — ogni modale `position: fixed` dentro una route deve
uscire dal contenitore con `createPortal(…, document.body)`: l'animazione di
ingresso della pagina lascia un `transform` residuo che intrappola i `fixed` e
li manda fuori schermo. Sembrano non aprirsi, senza errori in console.

**Testo degli articoli** — l'editor produce spazi unificatori che rompono
l'andata a capo e il conteggio parole. `src/utils/testoArticolo.js` li ripulisce,
sia al salvataggio sia alla lettura.

**Windows / PowerShell** — non usare doppi apici dentro un messaggio di commit
passato via here-string: rompono il parsing. Se `npx` viene bloccato dalla
politica sugli script, usare `npx.cmd`.

---

## 10. Dove siamo e cosa resta

**Fatto e funzionante:** sito online su dominio proprio con certificato,
notifiche push, newsletter, approvazione degli accessi via email, calendario
Serie A che si aggiorna da solo, diretta partite con tabellino, pronostici con
punti automatici, pagelle dei giocatori, quiz, classifica, chat moderata,
registrazione su Google Search Console con mappa consegnata, pubblicazione
notturna per i motori di ricerca.

**Aperto, e onesto dirlo:**

1. **Non si sa perché API-Football rifiuti a raffica.** Il servizio fa una
   chiamata ogni 2 minuti su un tetto di 10 al minuto: non dovrebbe succedere.
   I tentativi ripetuti lo aggirano, non lo curano.
2. **L'apertura delle pagelle al primo tentativo non è mai stata osservata.**
   Il 30/08/2026 è riuscita al secondo, dopo la correzione. La rete di
   sicurezza c'è e ha funzionato.
3. **Le sanzioni sono aggirabili** da chi ha competenze tecniche (§4).
4. **`www.netflaxt.it`** funziona per reindirizzamento, ma non è stato aggiunto
   come dominio personalizzato in Firebase.
5. Il sito risponde anche su `netflaxt-news.web.app` e
   `netflaxt-news.firebaseapp.com`. Non si possono spegnere; ogni pagina
   dichiara `netflaxt.it` come indirizzo ufficiale e Google segue quella.

**Prima cosa da fare all'inizio di una sessione:** guardare lo stato reale dei
file e del sito, non fidarsi di questo documento come se fosse aggiornato a
oggi. Il proprietario se lo aspetta.
