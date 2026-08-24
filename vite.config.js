import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ✨ ID univoco di build: cambia ad OGNI build/deploy. Serve al sistema
// di auto-update: il client confronta il proprio __BUILD_ID__ con quello
// in /version.json e, se diversi, sa che c'è una nuova versione.
const BUILD_ID = Date.now().toString()

// Plugin minimale che scrive dist/version.json con il BUILD_ID corrente
function versionJsonPlugin() {
  return {
    name: 'netflaxt-version-json',
    closeBundle() {
      try {
        writeFileSync(
          resolve('dist', 'version.json'),
          JSON.stringify({ version: BUILD_ID })
        )
      } catch (e) {
        console.warn('version.json non scritto:', e)
      }
    },
  }
}

export default defineConfig({
  // Espone il BUILD_ID al codice client (sostituito a build-time)
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  // ✨ Performance: chunking manuale dei vendor per ridurre il bundle
  // iniziale. Firebase, React, axios e analytics vanno in file separati
  // così sono cachati dal browser/SW e non si riscaricano ad ogni deploy.
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Funzione (Rolldown/Vite 8): grouping vendor in chunk dedicati
        // così il browser cacha React e Firebase a lungo termine.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-react';
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/'))
              return 'vendor-react';
            if (id.includes('node_modules/firebase/')) return 'vendor-firebase';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    versionJsonPlugin(),
    // ✨ Fase 4 — PWA installabile sul telefono
    VitePWA({
      // 'prompt': il SW resta in waiting finché PwaUpdateNotifier
      // non chiama updateSW(true). Così possiamo mostrare il MODAL
      // con la progress bar all'utente prima di ricaricare.
      // (con 'autoUpdate' onNeedRefresh non scatta mai → niente modal)
      registerType: 'prompt',
      // Niente auto-inject: lo registriamo da React (PwaUpdateNotifier)
      // così possiamo intercettare gli update e mostrare un toast.
      injectRegister: null,

      // Include nel SW gli assets statici (così funzionano offline)
      includeAssets: [
        'favicon.svg',
        'favicon-16.png',
        'favicon-32.png',
        'apple-touch-icon.png',
        'logo.png',
        'instagram-cta.PNG',
        'login-curva.jpg',
      ],

      // ✨ Manifest generato automaticamente dal plugin
      manifest: {
        name: 'Netflaxt News',
        short_name: 'Netflaxt',
        description: 'Notizie, analisi e curva biancoceleste. La Lazio dal divano.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05070D',
        theme_color: '#05070D',
        lang: 'it-IT',
        categories: ['sports', 'news'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },

      workbox: {
        // NON skipWaiting/clientsClaim: con registerType:'prompt' il SW
        // resta in waiting finché PwaUpdateNotifier non chiama
        // updateSW(true) (su click del bottone "Aggiorna ora").
        // Solo allora il SW manda skipWaiting() e l'app si ricarica.
        // Se li metti a true il SW si auto-attiva subito e il modal
        // non appare → bug.
        skipWaiting: false,
        clientsClaim: false,
        // Pulisci automaticamente le vecchie cache (così non restano
        // versioni precedenti del sito in giro sul dispositivo)
        cleanupOutdatedCaches: true,
        // Limite max file precachable: 5 MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // File da cachare per uso offline
        globPatterns: ['**/*.{js,css,html,svg,png,ico,jpg,jpeg,webp,woff2}'],
        // Escludi file enormi dalla precache (verranno cachati in runtime)
        globIgnores: [
          '**/eagle.png',      // 7.3 MB — animazione easter egg, non serve offline al primo load
          '**/eagle-cry.mp3',  // verso aquila, idem
          '**/version.json',   // file versione: deve essere SEMPRE fresco dalla rete
          // chat-bg.jpg NON è qui di proposito: ora pesa 228 KB ed è PRECACHED
          // → lo sfondo chat è sempre disponibile all'istante, niente flash al reload.
        ],
        // Cache runtime per Google Fonts + Cloudinary + asset locali pesanti
        runtimeCaching: [
          {
            // version.json: SEMPRE dalla rete (mai cache) → rilevamento
            // affidabile delle nuove versioni.
            urlPattern: /\/version\.json/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Immagini Cloudinary: cache aggressiva (CacheFirst).
            // NOTA: nome cache "v2" così Workbox abbandona la vecchia
            // cache "cloudinary-images" che conteneva anche blob video
            // corrotti (i video erano stati erroneamente inclusi qui).
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\/image\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images-v2',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Video Cloudinary: SOLO rete. Il SW NON deve intercettarli
            // perché Workbox CacheFirst non supporta i Range Requests
            // (HTTP 206) che servono al seeking/streaming dei video,
            // quindi il player mobile non riesce a riprodurli.
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\/video\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Anche eventuali Cloudinary URL "raw" (non /image/ né
            // /video/) li lasciamo passare in rete senza cache, per
            // sicurezza assoluta.
            urlPattern: /^https:\/\/res\.cloudinary\.com\/(?!.*\/image\/).+/i,
            handler: 'NetworkOnly',
          },
          {
            // Asset locali pesanti non precachati (eagle.png, eagle-cry.mp3).
            // chat-bg.jpg ora è precachato (228 KB), quindi non serve qui.
            urlPattern: /\/(eagle\.png|eagle-cry\.mp3)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'heavy-assets',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: '/index.html',
        /* I percorsi che iniziano con /__/ sono di Firebase, non nostri:
           lì vive la pagina che completa l'accesso con Google.
           Senza questa esclusione il service worker risponde con la home
           del sito, React non riconosce quel percorso e mostra la 404:
           il popup di Google muore lì e l'accesso fallisce con un
           fuorviante "popup chiuso dall'utente".
           Succedeva solo dal dominio nostro (netflaxt.it), perché prima
           la pagina di Google si apriva su firebaseapp.com — un altro
           dominio, fuori dalla portata del service worker. */
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/, /^\/__\//],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],
})
