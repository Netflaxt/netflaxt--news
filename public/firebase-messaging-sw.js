/* Service Worker per le push notifications Firebase Cloud Messaging.
   Va lasciato in /public così viene servito a /firebase-messaging-sw.js
   e Firebase Messaging lo registra automaticamente. */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDxEskCC29f_1i_kGSxS1SpCAAoQ84-wvw",
  authDomain: "netflaxt-news.firebaseapp.com",
  projectId: "netflaxt-news",
  storageBucket: "netflaxt-news.firebasestorage.app",
  messagingSenderId: "180313929316",
  appId: "1:180313929316:web:84ce5584a616e221585171",
});

/* ATTENZIONE — qui NON va registrato onBackgroundMessage.

   Sembra innocuo, ma registrare quell'handler dice a Firebase «la
   notifica la mostro io»: da quel momento l'SDK smette di mostrarla da
   solo. Con un handler vuoto il risultato è che non la mostra NESSUNO e
   il telefono resta muto (successo il 23/08/2026, sull'iPhone).

   Senza handler, l'SDK mostra da sé la notifica contenuta nel messaggio:
   una sola volta e su tutte le piattaforme, iOS compreso.
   Se un domani servisse fare qualcosa all'arrivo del messaggio, va
   registrato l'handler E mostrata la notifica al suo interno. */
firebase.messaging();

/* Prende il controllo subito, senza aspettare che l'utente chiuda tutte
   le schede/l'app. Senza questo, dopo un aggiornamento il telefono
   continuerebbe a usare la versione precedente di questo file — ed è
   proprio così che le notifiche sono rimaste mute per ore. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* Il click sulla notifica lo gestisce l'SDK, che apre l'indirizzo
   indicato dal messaggio (campo `link`). Non aggiungiamo un handler
   nostro: ne risulterebbero due in ascolto sullo stesso click, con il
   rischio di aprire due finestre o di sovrascrivere la destinazione. */
