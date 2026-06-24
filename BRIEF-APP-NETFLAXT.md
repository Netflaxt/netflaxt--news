# 🦅 Brief per Claude — App "Netflaxt News"

> Incolla tutto questo in una chat con Claude (o in un tool di design AI) e
> chiedi: **"Crea un'app/prototipo interattivo basato su questo brief"**.
> È un esperimento per vedere come l'AI interpreta il progetto.

---

## 1. Concetto
**Netflaxt News** è il **fan site indipendente della S.S. Lazio** (calcio,
Serie A) — "la casa dei tifosi laziali". Un posto dove i tifosi biancocelesti
vivono la squadra: notizie, calendario, pronostici, quiz, chat dal vivo e
classifica della community. Tono **appassionato, biancoceleste, in prima
persona**, in italiano, con l'aquila 🦅 come simbolo. Slogan: *"La Lazio dal
divano"*, *"Forza Lazio"*.

## 2. Pubblico
Tifosi della Lazio di ogni età, soprattutto da mobile. Devono sentirsi "a casa"
e parte di una community.

## 3. Identità visiva (IMPORTANTE — è il cuore del look)
- **Tema scuro** di default (anche tema chiaro disponibile).
- **Biancoceleste**: colore accento **azzurro `#38BDF8`** (sky), profondo `#0EA5E9`.
- Sfondi scuri: base `#05070D`, superfici `#0A0E1A`, elevati `#111827`.
- Testo: `#F8FAFC` (principale), `#94A3B8` (secondario), `#64748B` (tenue).
- Stati: successo `#10B981`, errore `#F43F5E`, giallo `#F59E0B`.
- **Font titoli**: **Bebas Neue** (condensato, maiuscolo, d'impatto).
- **Font testo**: **Inter**.
- **Stile**: moderno e "premium" — bagliori azzurri sfumati (glow/aurora), leggeri
  gradienti, vetro smerigliato (backdrop-blur), card arrotondate, micro-animazioni
  eleganti, riflessi "shimmer" sui bottoni, alone che segue il cursore sulle card.
  Niente di kitsch: pulito, scuro, elegante, con tocchi azzurri.

## 4. Tono di voce
Caldo, da tifoso vero, in prima persona ("dico sempre la mia…"), entusiasta ma
mai volgare. Emoji 🦅💙 usate con misura.

## 5. Funzionalità / Sezioni
- **Home**: hero con titolone "LA CASA DEI TIFOSI LAZIALI" (effetto macchina da
  scrivere), una **barra "Prossima partita"** con countdown, ultime notizie in
  card, card del **quiz**, invito ai **pronostici**, CTA Instagram. Easter egg:
  un'**aquila** che "vola" cliccando un bottone.
- **News**: griglia articoli con categorie, immagine, "Top"; dettaglio articolo
  con reazioni, commenti, salva nei preferiti, eventuale video.
- **Calendario**: partite della Lazio (Serie A) con loghi, **countdown** al match,
  "Data da confermare" per le partite lontane, e — durante la gara — un **ticker
  LIVE** (🔴 minuto che sale, recupero 45+5', "Fine 1° tempo", "Fine partita").
- **Pronostici**: l'utente indovina il risultato (si aprono 2 giorni prima),
  guadagna punti (+3 risultato esatto, +1 esito 1X2).
- **Classifica**: classifica generale dei tifosi (punti quiz + pronostici), con
  **podio Top-3** (medaglie, contatore punti animato).
- **Quiz**: 5 domande al giorno sulla storia della Lazio, con punti.
- **Chat**: chat dal vivo dei tifosi (foto/video, sondaggi, reazioni, moderazione).
- **Profilo**: badge sbloccabili, statistiche, bio; profilo pubblico `/u/username`.
- **App installabile (PWA)** con notifiche push e auto-aggiornamento.

## 6. Tabellino eventi (icone)
Gol = pallone azzurro; Rigore = pallone azzurro + "RIG."; Autogol = pallone rosso
+ "AUT."; Ammonizione = cartellino giallo; Espulsione = cartellino rosso;
Infortunio = ambulanza azzurra + "INF.".

## 7. Note tecniche (facoltative, se il tool le usa)
Stack reale: React + Vite + Tailwind CSS + Firebase (Firestore/Auth/Hosting),
PWA. Ma per il prototipo basta riprodurre **look & feel + schermate**.

## 8. Schermate da generare (priorità)
1. **Home** (hero + barra prossima partita + griglia notizie)
2. **Calendario** con una partita **LIVE** (ticker 🔴 67' · 1-0)
3. **Classifica** con il **podio Top-3**
4. **Dettaglio partita** con tabellino (icone gol/cartellini)

Obiettivo: un'app dall'aria **scura, elegante, biancoceleste**, che faccia dire
a un tifoso della Lazio *"questa è casa mia"*. 🦅💙
