/* ─────────────────────────────────────────────────────────────
   src/App.jsx
   FASE 3:
   - Aggiunge route /privacy
   - Monta CookieBanner globale
   - Inizializza analytics (se consenso accettato)
   ───────────────────────────────────────────────────────────── */
import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Pagine CRITICHE (entry points): caricamento eager → no flash di skeleton
import Home from "./pages/Home";
import News from "./pages/News";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Pagine NON CRITICHE: lazy import → bundle iniziale dimezzato.
// L'utente scarica il chunk SOLO quando visita quella pagina, e poi
// il SW lo cacha per le visite successive (warm load istantaneo).
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const Chat = lazy(() => import("./pages/Chat"));
const Admin = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileSaved = lazy(() => import("./pages/ProfileSaved"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const About = lazy(() => import("./pages/About"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Pronostici = lazy(() => import("./pages/Pronostici"));
const Classifica = lazy(() => import("./pages/Classifica"));
const Privacy = lazy(() => import("./pages/Privacy"));

import ErrorBoundary from "./components/ErrorBoundary";
import PushNudge from "./components/PushNudge";
import { refreshPushToken } from "./utils/push";
import CookieBanner from "./components/CookieBanner";
import InstallPrompt from "./components/InstallPrompt";
import SiteStatusModal from "./components/SiteStatusModal";
import EagleEasterEgg from "./components/EagleEasterEgg";
import DidYouKnowBubble from "./components/DidYouKnowBubble";
import PwaUpdateNotifier from "./components/PwaUpdateNotifier";
import BadgeWatcher from "./components/BadgeWatcher";
import ChatMessageNotifier from "./components/ChatMessageNotifier";
import { useAuth } from "./context/AuthContext";
import useEnsureUserDoc from "./hooks/useEnsureUserDoc";
import useDeviceTracking from "./hooks/useDeviceTracking";
import useTwemoji from "./hooks/useTwemoji";
import { initAnalytics, syncConsent, trackPageView } from "./utils/analytics";

/* Scroll-to-top + page fade-in al cambio route */
function RouteEffects() {
  const location = useLocation();
  useEffect(() => {
    // Salta scroll-to-top quando torniamo allo stesso path
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    // Il sito cambia pagina senza ricaricare il browser: segnaliamo noi la
    // visita, altrimenti le statistiche conterebbero solo la prima schermata.
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

function App() {
  const { user } = useAuth();
  useEnsureUserDoc(user);
  useDeviceTracking(user);

  // I collegamenti alle notifiche scadono (reinstallazioni, aggiornamenti di
  // sistema). Li rinnoviamo a ogni avvio per chi le ha già attivate, così non
  // smettono di arrivare senza che nessuno se ne accorga. È silenzioso: non
  // chiede permessi e non mostra nulla.
  useEffect(() => {
    if (user?.uid) refreshPushToken(user.uid);
  }, [user?.uid]);
  const location = useLocation();

  // Emoji uguali e a colori su tutti i dispositivi (Twemoji)
  useTwemoji();

  // Inizializza analytics se l'utente ha già dato consenso in precedenza
  useEffect(() => {
    initAnalytics();
    const handler = () => syncConsent();
    window.addEventListener("netflaxt:cookie-consent-changed", handler);
    return () =>
      window.removeEventListener("netflaxt:cookie-consent-changed", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <RouteEffects />
      <Navbar />
      <div key={location.pathname} className="flex-1 nf-page-enter">
        <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<ArticleDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/pronostici" element={<Pronostici />} />
            <Route path="/classifica" element={<Classifica />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/saved" element={<ProfileSaved />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* Catch-all 404 — DEVE essere l'ultima route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>
      <Footer />

      {/* Cookie banner globale */}
      <CookieBanner />

      {/* 🔔 Invito discreto ad attivare le notifiche (solo se loggato) */}
      <PushNudge />

      {/* ✨ Fase 4 — Banner "Installa app" su mobile/desktop supportati */}
      <InstallPrompt />

      {/* Popup stato sito (manutenzione / down) */}
      <SiteStatusModal />

      {/* 🦅 Easter egg: aquila biancoceleste in volo */}
      <EagleEasterEgg />

      {/* 💡 Sapevi che... — curiosità random ogni 15 minuti */}
      <DidYouKnowBubble />

      {/* 🔄 PWA auto-update con notifica utente */}
      <PwaUpdateNotifier />

      {/* 🏆 Watcher globale badge: popup + campanella allo sblocco */}
      <BadgeWatcher />

      {/* 💬 Notifica globale nuovo messaggio chat */}
      <ChatMessageNotifier />
    </div>
  );
}

/* Fallback minimale mostrato durante il caricamento di un chunk lazy.
   È volutamente leggero (no skeleton complicato) per evitare jank su
   dispositivi vecchi mentre il chunk arriva. */
function RouteLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default App;
