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

const messaging = firebase.messaging();

/* ATTENZIONE — qui NON si deve chiamare showNotification().

   I messaggi inviati dal server contengono il campo `notification`, quindi
   è il browser stesso a mostrare la notifica. Se la mostrassimo anche qui,
   l'utente ne vedrebbe DUE identiche (è già successo: bug corretto il
   23/08/2026). Questo handler serve solo a intercettare il messaggio, per
   esempio se un domani volessimo aggiornare un contatore. */
messaging.onBackgroundMessage(() => {
  // Nessuna azione: la notifica è già mostrata dal browser.
});

// Click → apri/porta in foreground il sito al link giusto
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(url) && "focus" in w) return w.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
