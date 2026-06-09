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

// Notifica in background (app chiusa / tab non in foreground)
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Netflaxt News";
  const options = {
    body: payload?.notification?.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload?.data || {},
    tag: payload?.data?.tag || "netflaxt",
  };
  self.registration.showNotification(title, options);
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
