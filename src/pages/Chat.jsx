import React, { useState, useEffect, useRef, useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import { rtdb, db } from "../firebase/firebase";
import {
  ref,
  remove,
  onValue,
  onDisconnect,
  query,
  orderByChild,
  serverTimestamp,
  set,
} from "firebase/database";
import { doc as fsDoc, onSnapshot as fsOnSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { checkText, VIOLATION_LABELS } from "../utils/contentFilter";
import {
  getModerationStatus,
  applyViolation,
  formatRemainingTime,
  suspensionDurationLabel,
} from "../utils/moderationService";

// ✨ Componenti chat — Fase 3: tasti inline sempre visibili
import MessageActionButtons from "../components/chat/MessageActionButtons";
import ChatRulesBanner from "../components/chat/ChatRulesBanner";
import ReportButton from "../components/ReportButton";
import MessageReactions from "../components/chat/MessageReactions";
import ReplyComposer from "../components/chat/ReplyComposer";
import ReplyPreview from "../components/chat/ReplyPreview";
import PollCard from "../components/chat/PollCard";
import ChatMedia from "../components/chat/ChatMedia";
import PollComposer from "../components/chat/PollComposer";
import {
  sendMessageWithReply,
  toggleReaction,
  createPoll,
  votePoll,
  closePoll,
} from "../utils/chatActions";

// ✨ Fase 4: "sta scrivendo..."
import TypingIndicator from "../components/chat/TypingIndicator";
import { setTyping, clearTyping } from "../utils/typing";
import { uploadImageToCloudinary, compressImage } from "../utils/imageUpload";
import { uploadVideoToCloudinary } from "../utils/videoUpload";
import { maybeWeeklyClear } from "../utils/chatMaintenance";

const ADMIN_EMAIL = "cretellamattia36@gmail.com";

/* Presence — soglie temporali */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const STALE_THRESHOLD_MS = 2 * 60 * 1000;
const RETICK_MS = 15 * 1000;

/* ─────────────────────────────────────────────────────────────
   AVATAR HELPERS
   ───────────────────────────────────────────────────────────── */
const AVATAR_GRADIENTS = [
  "from-sky-400 to-sky-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-violet-400 to-violet-600",
  "from-orange-400 to-orange-600",
  "from-cyan-400 to-cyan-600",
  "from-fuchsia-400 to-fuchsia-600",
];

const getGradient = (seed) => {
  if (!seed) return AVATAR_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
};

const getInitials = (name) =>
  name
    ? name
        .split(" ")
        .map((n) => n[0])
        .filter(Boolean)
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

function Avatar({
  photoURL,
  displayName,
  seed,
  sizeClass = "h-9 w-9",
  textSize = "text-[10px]",
  ring = "ring-2 ring-bg-base",
  showOnline = false,
}) {
  const [broken, setBroken] = useState(false);
  const hasPhoto = photoURL && !broken;

  return (
    <div className="relative shrink-0">
      {hasPhoto ? (
        <img
          src={photoURL}
          alt={displayName || ""}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className={`${sizeClass} rounded-full object-cover ${ring} shadow-lg bg-bg-elevated`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br ${getGradient(
            seed || displayName || "x"
          )} flex items-center justify-center ${textSize} font-black text-text-inverse ${ring} shadow-lg`}
        >
          {getInitials(displayName)}
        </div>
      )}
      {showOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-bg-surface" />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHAT — componente principale
   ───────────────────────────────────────────────────────────── */
export default function Chat() {
  const { user, loading: authLoading } = useAuth();

  // Stato chat
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ✨ Fase 2: stato per reply + highlight scroll
  const [replyTo, setReplyTo] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // ✨ Fase 4: composer sondaggio (solo admin)
  const [showPoll, setShowPoll] = useState(false);

  // ✨ Fase 4: typing — utenti che stanno scrivendo (escluso self)
  const [typingUsers, setTypingUsers] = useState([]);

  // Presence
  const [serverOffset, setServerOffset] = useState(0);
  const [, setTick] = useState(0);

  // Moderazione
  const [modStatus, setModStatus] = useState(null);
  const [violationToast, setViolationToast] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const mediaInputRef = useRef(null);

  // Upload media (foto/video) in chat
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  /* ─── animazione mount ─── */
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  /* ─── Svuotamento automatico settimanale ───
     Per sicurezza (regole RTDB: solo l'admin può cancellare i messaggi)
     scatta SOLO quando è l'admin ad aprire la chat. L'admin apre il
     sito regolarmente → la chat si pulisce ~ogni settimana. */
  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) {
      maybeWeeklyClear(true).catch(() => {});
    }
  }, [user?.email]);

  /* ─── Subscription messaggi (RTDB) ─── */
  useEffect(() => {
    if (!user) return;
    const messagesRef = query(ref(rtdb, "messages"), orderByChild("timestamp"));
    const unsub = onValue(
      messagesRef,
      (snap) => {
        const data = snap.val();
        const list = data
          ? Object.entries(data).map(([id, m]) => ({ id, ...m }))
          : [];
        list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(list);
        setLoadingMessages(false);
      },
      (err) => {
        console.error("Errore lettura messaggi:", err);
        setLoadingMessages(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  /* ─── Subscription presenza ─── */
  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(rtdb, "presence");
    const unsub = onValue(
      presenceRef,
      (snap) => {
        const data = snap.val();
        const list = data
          ? Object.entries(data).map(([uid, p]) => ({ uid, ...p }))
          : [];
        setPresence(list);
      },
      (err) => console.error("Errore lettura presenza:", err)
    );
    return () => unsub();
  }, [user?.uid]);

  /* ─── Server time offset ─── */
  useEffect(() => {
    if (!user) return;
    const offsetRef = ref(rtdb, ".info/serverTimeOffset");
    const unsub = onValue(offsetRef, (snap) => {
      setServerOffset(snap.val() || 0);
    });
    return () => unsub();
  }, [user?.uid]);

  /* ─── Re-tick UI periodico ─── */
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), RETICK_MS);
    return () => clearInterval(t);
  }, []);

  /* ─── Scrittura presenza + heartbeat + onDisconnect ─── */
  useEffect(() => {
    if (!user) return;
    const myRef = ref(rtdb, `presence/${user.uid}`);
    const lastSeenRef = ref(rtdb, `presence/${user.uid}/lastSeen`);
    const myInfo = {
      uid: user.uid,
      displayName:
        user.displayName || (user.email ? user.email.split("@")[0] : "Anonimo"),
      photoURL: user.photoURL || null,
      email: user.email || null,
      isAdmin: user.email === ADMIN_EMAIL,
      lastSeen: serverTimestamp(),
    };
    set(myRef, myInfo).catch((e) => console.error("Errore set presence:", e));
    onDisconnect(myRef)
      .remove()
      .catch((e) => console.error("Errore onDisconnect:", e));

    const heartbeat = setInterval(() => {
      set(lastSeenRef, serverTimestamp()).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      remove(myRef).catch(() => {});
    };
  }, [user?.uid, user?.photoURL, user?.displayName]);

  /* ─── Autoscroll giù sui nuovi messaggi ─── */
  useEffect(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }, [messages.length, loadingMessages]);

  /* ─── Real-time: ascolta lo stato di moderazione ───
     Niente più polling 30s: appena l'admin sblocca l'utente o scade
     la sospensione, il banner della chat sparisce automaticamente. */
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = fsOnSnapshot(
      fsDoc(db, "users", user.uid),
      async () => {
        try {
          const status = await getModerationStatus(user.uid);
          setModStatus(status);
        } catch (e) {
          console.error("Errore aggiornamento moderazione:", e);
        }
      },
      (err) => console.error("Errore listener moderazione:", err)
    );
    return () => unsub();
  }, [user?.uid]);

  /* ✨ Fase 4: subscription a "/typing" — chi sta scrivendo ora */
  useEffect(() => {
    if (!user?.uid) return;
    const typingRef = ref(rtdb, "typing");
    const unsub = onValue(typingRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setTypingUsers([]);
        return;
      }
      const now = Date.now() + serverOffset;
      const STALE_MS = 6000; // entries più vecchie di 6s sono stale
      const list = Object.entries(data)
        .filter(([uid, info]) => {
          if (uid === user.uid) return false; // escludi self
          const ts = typeof info?.ts === "number" ? info.ts : 0;
          if (ts === 0) return true; // appena scritto, non ancora risolto
          return now - ts < STALE_MS;
        })
        .map(([uid, info]) => ({
          uid,
          displayName: info.displayName || "Anonimo",
        }));
      setTypingUsers(list);
    });
    return () => unsub();
  }, [user?.uid, serverOffset]);

  /* ✨ Fase 4: cleanup typing su unmount (lascia chat senza "sta scrivendo" fantasma) */
  useEffect(() => {
    return () => {
      clearTyping(user);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Auto-dismiss del toast violazione */
  useEffect(() => {
    if (!violationToast) return;
    const t = setTimeout(() => setViolationToast(null), 6000);
    return () => clearTimeout(t);
  }, [violationToast]);

  /* Auto-dismiss highlight scroll-to-reply */
  useEffect(() => {
    if (!highlightedId) return;
    const t = setTimeout(() => setHighlightedId(null), 1600);
    return () => clearTimeout(t);
  }, [highlightedId]);

  /* ─── Presence filtrata ─── */
  /* NB: questi useMemo stanno PRIMA dell'auth gate di proposito. Al logout
     `user` diventa null e il componente si ri-renderizza un'ultima volta
     prima del redirect: se gli hook stessero dopo il gate, React ne
     troverebbe di meno e romperebbe il render (schermata bianca). */
  const livePresence = useMemo(() => {
    const serverNow = Date.now() + serverOffset;
    return presence.filter((p) => {
      const ls = typeof p.lastSeen === "number" ? p.lastSeen : 0;
      if (ls === 0) return true;
      return serverNow - ls < STALE_THRESHOLD_MS;
    });
  }, [presence, serverOffset]);

  const presenceMap = useMemo(() => {
    const m = {};
    livePresence.forEach((p) => {
      m[p.uid] = p;
    });
    return m;
  }, [livePresence]);

  /* ─── Raggruppa messaggi per giorno ─── */
  const groups = useMemo(() => {
    const out = [];
    let currentKey = null;
    messages.forEach((m) => {
      const d = new Date(m.timestamp || Date.now());
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let key;
      if (d.toDateString() === today.toDateString()) key = "Oggi";
      else if (d.toDateString() === yesterday.toDateString()) key = "Ieri";
      else
        key = d.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "long",
        });

      if (key !== currentKey) {
        out.push({ day: key, items: [] });
        currentKey = key;
      }
      out[out.length - 1].items.push(m);
    });
    return out;
  }, [messages]);

  /* ─── Auth gate ─── */
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  /* ─── Send message ─── */
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    if (modStatus?.accountDisabled) {
      setViolationToast({
        type: "disabled",
        match: "Il tuo account è stato disattivato definitivamente.",
      });
      return;
    }
    if (modStatus?.isSuspended) {
      setViolationToast({
        type: "suspended",
        match: `Sei sospeso fino al ${modStatus.suspendedUntil?.toLocaleString("it-IT")}`,
      });
      return;
    }

    const check = checkText(text);
    if (!check.ok) {
      setSending(true);
      try {
        const myRecent = messages.filter((m) => m.uid === user.uid).slice(-4);
        const result = await applyViolation(
          user.uid,
          { type: check.type, match: check.match, text },
          myRecent
        );
        setViolationToast({
          type: check.type,
          match: check.match,
          banCount: result.banCount,
          accountDisabled: result.accountDisabled,
          suspensionDays: result.suspensionDays,
        });
        const fresh = await getModerationStatus(user.uid);
        setModStatus(fresh);
        setDraft("");
      } catch (e) {
        console.error("Errore applicazione violazione:", e);
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      // ✨ Fase 2: usa l'helper che gestisce anche replyTo
      await sendMessageWithReply({ user, text, replyTo });
      setDraft("");
      setReplyTo(null);
      // ✨ Fase 4: pulisci subito lo stato "sta scrivendo" all'invio
      clearTyping(user);
      inputRef.current?.focus();
    } catch (e) {
      console.error("Errore invio messaggio:", e);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      setReplyTo(null);
    }
  };

  /* ─── Upload media (foto/video) ─── */
  const handleMediaFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // Blocca se sospeso/disabilitato
    if (modStatus?.accountDisabled || modStatus?.isSuspended) {
      setUploadError("Non puoi inviare media: account sospeso o disattivato.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setUploadError("Puoi caricare solo immagini o video.");
      return;
    }

    setUploadingMedia(true);
    setUploadError("");
    setUploadProgress(0);
    try {
      let media;
      if (isImage) {
        // Comprimi le foto grandi prima dell'upload (così anche foto da
        // 15-20 MB del telefono passano e la chat resta veloce)
        const toUpload = await compressImage(file);
        const res = await uploadImageToCloudinary(toUpload, setUploadProgress);
        media = { type: "image", url: res.url, width: res.width, height: res.height };
      } else {
        const res = await uploadVideoToCloudinary(file, setUploadProgress);
        media = { type: "video", url: res.url, width: res.width, height: res.height };
      }
      // Invia il messaggio con il media (testo eventuale dalla draft)
      await sendMessageWithReply({ user, text: draft, replyTo, media });
      setDraft("");
      setReplyTo(null);
      clearTyping(user);
    } catch (err) {
      console.error("Errore upload media:", err);
      setUploadError(err.message || "Upload fallito. Riprova.");
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  /* ─── Reply handler ─── */
  const handleReply = (msg) => {
    setReplyTo({
      id: msg.id,
      text: msg.text,
      displayName: msg.displayName || "Utente",
    });
    inputRef.current?.focus();
  };

  /* ─── Scroll to original message (click su reply preview) ─── */
  const scrollToMessage = (msgId) => {
    if (!msgId) return;
    const el = document.querySelector(`[data-message-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(msgId);
    }
  };

  /* ─── Toggle reazione ─── */
  const handleReact = (msgId, emoji) => {
    toggleReaction(msgId, emoji, user.uid);
  };

  /* ─── Sondaggi (#21) ─── */
  const isAdmin = user.email === ADMIN_EMAIL;

  const handleCreatePoll = async ({ question, options }) => {
    await createPoll({ user, question, options });
    setShowPoll(false);
  };

  const handleVotePoll = (m, optionId) => {
    const myVote = m.votes?.[user.uid] || null;
    votePoll(m.id, optionId, user.uid, myVote);
  };

  const handleClosePoll = (msgId) => {
    closePoll(msgId);
  };

  const adminsOnline = livePresence.filter((p) => p.isAdmin);
  const fansOnline = livePresence.filter((p) => !p.isAdmin);
  const hasOtherUsers = livePresence.some((p) => p.uid !== user.uid);

  const myLive = presenceMap[user.uid] || {};
  const myPhoto = myLive.photoURL ?? user.photoURL;
  const myName =
    myLive.displayName ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "Tu");

  return (
    <main className="nf-chat-bg h-[calc(100vh-4rem)] text-text-primary flex overflow-hidden relative">
      {/* ✨ Sfondo chat — velo adattato per tema dark/light */}
      <style>{`
        /* DARK (default): velo scuro sopra la foto */
        .nf-chat-bg {
          background-color: var(--color-bg-base);
          background-image:
            linear-gradient(180deg, rgba(5,7,13,0.84) 0%, rgba(5,7,13,0.90) 50%, rgba(5,7,13,0.94) 100%),
            url('/chat-bg.jpg');
          background-repeat: no-repeat, no-repeat;
          background-attachment: local, local;
        }
        /* LIGHT: velo CHIARO sopra la foto così non confligge col tema */
        :root[data-theme="light"] .nf-chat-bg {
          background-image:
            linear-gradient(180deg, rgba(238,242,247,0.86) 0%, rgba(238,242,247,0.92) 50%, rgba(238,242,247,0.96) 100%),
            url('/chat-bg.jpg');
        }
        /* MOBILE: foto intera visibile (contain), spostata un pelino a destra */
        @media (max-width: 1023px) {
          .nf-chat-bg {
            background-size: cover, contain;
            background-position: center, 60% center;
          }
        }
        /* DESKTOP: foto adattata (cover) che riempie tutta la chat */
        @media (min-width: 1024px) {
          .nf-chat-bg {
            background-size: cover, cover;
            background-position: center, center;
          }
        }
      `}</style>


      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute -top-32 left-1/3 w-[500px] h-[400px] bg-accent/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 -right-32 w-[400px] h-[400px] bg-accent-deep/8 rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ═══════════════════ SIDEBAR ═══════════════════ */}
      <aside
        className={`relative z-20 shrink-0 w-72 border-r border-border bg-bg-surface/95 backdrop-blur-md transition-transform duration-300 lg:translate-x-0 lg:bg-bg-surface/50 lg:block ${
          sidebarOpen
            ? "block translate-x-0 fixed inset-y-0 left-0 mt-16 h-[calc(100vh-4rem)]"
            : "hidden -translate-x-full fixed inset-y-0 left-0 mt-16 h-[calc(100vh-4rem)] lg:relative lg:mt-0 lg:translate-x-0 lg:h-auto"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
                Online ora
              </h4>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                {livePresence.length}
              </span>
            </div>
          </div>

          {adminsOnline.length > 0 && (
            <div className="px-3 pt-4 pb-2">
              <div className="px-2 text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-2">
                Admin
              </div>
              <ul className="space-y-1">
                {adminsOnline.map((u) => (
                  <UserItem
                    key={u.uid}
                    user={u}
                    isYou={u.uid === user.uid}
                    admin
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="px-3 pt-3 pb-2 flex-1 overflow-y-auto">
            <div className="px-2 text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-2">
              Tifosi
            </div>
            {fansOnline.length === 0 ? (
              hasOtherUsers ? (
                <div className="px-3 py-6 text-center text-xs text-text-muted">
                  Nessun tifoso online.
                  <br />
                  Sii il primo a entrare 🦅
                </div>
              ) : (
                <div className="px-3 py-8 text-center">
                  <div className="relative inline-block mb-3">
                    <div className="absolute inset-0 bg-accent/15 blur-xl rounded-full" />
                    <div className="relative w-12 h-12 mx-auto rounded-xl border border-border bg-bg-base/60 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-secondary leading-relaxed">
                    Nessun utente
                    <br />
                    online ora
                  </div>
                  <div className="mt-2 text-[10px] text-text-muted">
                    🦅 Sei il solo laziale collegato
                  </div>
                </div>
              )
            ) : (
              <ul className="space-y-1">
                {fansOnline.map((u) => (
                  <UserItem key={u.uid} user={u} isYou={u.uid === user.uid} />
                ))}
              </ul>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border-subtle">
            <div className="flex items-center gap-3">
              <Avatar
                photoURL={myPhoto}
                displayName={myName}
                seed={user.uid}
                sizeClass="h-9 w-9"
                textSize="text-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">
                  {myName}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-success font-semibold">
                  ● Online
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 top-16 z-10 bg-bg-base/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══════════════════ CHAT MAIN ═══════════════════ */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-border bg-bg-surface/60 backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden h-9 w-9 rounded-md border border-border hover:border-border-strong bg-bg-base/40 transition flex items-center justify-center text-text-secondary hover:text-text-primary"
              aria-label="Apri lista utenti"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </button>

            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-bg-elevated to-bg-surface ring-1 ring-accent/30 shadow-[0_0_20px_-4px_rgba(56,189,248,0.4)] flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.png"
                  alt=""
                  className="h-7 w-7 object-contain"
                  draggable="false"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success ring-2 ring-bg-base" />
              </span>
            </div>

            <div className="min-w-0">
              <h2
                className="text-xl text-text-primary leading-none truncate"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.02em",
                }}
              >
                La chat dei <span className="text-accent">laziali</span>
              </h2>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                  <span className="font-semibold tabular-nums">
                    {livePresence.length}
                  </span>
                  <span className="text-text-muted">online</span>
                </span>
                <span className="text-text-muted">·</span>
                <span className="text-text-muted hidden sm:inline">
                  Chat live · Solo registrati
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-base/60 border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-text-secondary">
                # laziali
              </span>
            </span>
          </div>
        </header>

        {/* Banner regole fissato sopra la chat */}
        <ChatRulesBanner />

        {/* Messaggi */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-6"
        >
          {loadingMessages ? (
            <LoadingState />
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="max-w-3xl mx-auto space-y-0.5">
              {groups.map((g, gi) => (
                <div key={gi}>
                  <DayDivider label={g.day} />
                  {g.items.map((m, idx) => {
                    const isMe = m.uid === user.uid;
                    const prev = g.items[idx - 1];
                    const sameAuthor =
                      prev &&
                      prev.uid === m.uid &&
                      m.timestamp - prev.timestamp < 5 * 60 * 1000;
                    const isLastInGroup =
                      idx === g.items.length - 1 ||
                      g.items[idx + 1]?.uid !== m.uid ||
                      g.items[idx + 1]?.timestamp - m.timestamp >=
                        5 * 60 * 1000;

                    const live = presenceMap[m.uid];
                    const displayName = live?.displayName || m.displayName;
                    const photoURL =
                      live?.photoURL !== undefined
                        ? live.photoURL
                        : m.photoURL;

                    return (
                      <MessageBubble
                        key={m.id}
                        m={m}
                        displayName={displayName}
                        photoURL={photoURL}
                        isMe={isMe}
                        sameAuthor={sameAuthor}
                        isLastInGroup={isLastInGroup}
                        mounted={mounted}
                        currentUid={user.uid}
                        isAdmin={isAdmin}
                        isHighlighted={highlightedId === m.id}
                        onReact={(emoji) => handleReact(m.id, emoji)}
                        onReply={() => handleReply(m)}
                        onClickReplyPreview={() => scrollToMessage(m.replyTo?.id)}
                        onVotePoll={(optId) => handleVotePoll(m, optId)}
                        onClosePoll={() => handleClosePoll(m.id)}
                      />
                    );
                  })}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input — bloccato se sospeso o account disabilitato */}
        {modStatus?.accountDisabled ? (
          <ChatBlockedBar
            tone="disabled"
            title="Account disattivato"
            description="Hai accumulato 4 violazioni del regolamento. Non puoi più scrivere in chat."
          />
        ) : modStatus?.isSuspended ? (
          <ChatSuspendedBar status={modStatus} />
        ) : (
          <div className="shrink-0 border-t border-border bg-bg-surface/60 backdrop-blur-xl p-3 sm:p-4">
            <div className="max-w-3xl mx-auto">
              {/* ✨ Fase 4: "X sta scrivendo..." */}
              <TypingIndicator typers={typingUsers} />

              {violationToast && (
                <ViolationToast
                  data={violationToast}
                  onDismiss={() => setViolationToast(null)}
                />
              )}

              {/* ✨ Reply composer — visibile solo se stai rispondendo */}
              <ReplyComposer replyTo={replyTo} onCancel={() => setReplyTo(null)} />

              {/* ✨ Composer sondaggio — solo admin */}
              {isAdmin && showPoll && (
                <PollComposer
                  onSubmit={handleCreatePoll}
                  onCancel={() => setShowPoll(false)}
                />
              )}

              {uploadError && (
                <div className="mb-2 text-xs text-error font-semibold">{uploadError}</div>
              )}
              <div className="relative flex items-end gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowPoll((v) => !v)}
                    aria-label="Crea sondaggio"
                    title="Crea sondaggio"
                    className={`shrink-0 h-12 w-12 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                      showPoll
                        ? "border-accent/60 bg-accent/10 text-accent"
                        : "border-border bg-bg-base/60 text-text-secondary hover:text-accent hover:border-accent/40"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </button>
                )}

                {/* Allega foto/video */}
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={uploadingMedia || sending}
                  aria-label="Allega foto o video"
                  title="Allega foto o video"
                  className="shrink-0 h-12 w-12 rounded-xl border border-border bg-bg-base/60 text-text-secondary hover:text-accent hover:border-accent/40 flex items-center justify-center transition-all duration-200 disabled:opacity-50"
                >
                  {uploadingMedia ? (
                    <span className="relative flex items-center justify-center">
                      <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="absolute text-[8px] font-bold text-accent">{uploadProgress}</span>
                    </span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      // ✨ Fase 4: segnala "sta scrivendo" mentre digita
                      if (e.target.value.trim().length > 0) {
                        setTyping(user);
                      } else {
                        clearTyping(user);
                      }
                    }}
                    onKeyDown={handleKey}
                    placeholder={
                      replyTo
                        ? `Rispondi a ${replyTo.displayName}...`
                        : "Scrivi nella curva..."
                    }
                    disabled={sending}
                    className="w-full pl-4 pr-12 py-3 bg-bg-base/60 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 focus:bg-bg-base transition-all duration-200 disabled:opacity-50"
                    maxLength={500}
                  />
                  {draft.length > 400 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-text-muted">
                      {500 - draft.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  aria-label="Invia messaggio"
                  className="group relative shrink-0 h-12 px-5 rounded-xl bg-accent text-text-inverse font-bold overflow-hidden transition-all duration-300 hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {sending ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="hidden sm:inline">Invia</span>
                        <svg
                          className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                          />
                        </svg>
                      </>
                    )}
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
                <span>
                  Premi{" "}
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-bg-base/60 text-text-secondary font-mono text-[9px]">
                    Invio
                  </kbd>{" "}
                  per inviare
                  {replyTo && (
                    <>
                      {" · "}
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-bg-base/60 text-text-secondary font-mono text-[9px]">
                        Esc
                      </kbd>{" "}
                      annulla risposta
                    </>
                  )}
                </span>
                {/* Avviso regole spostato sopra (vedi ChatRulesBanner) */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Style locale */}
      <style>{`
        @keyframes chat-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes chat-highlight {
          0%   { background-color: rgba(56,189,248,0.20); box-shadow: 0 0 0 2px rgba(56,189,248,0.4); }
          100% { background-color: transparent; box-shadow: none; }
        }
        .chat-highlight {
          animation: chat-highlight 1.6s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 14px;
        }
      `}</style>
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════
   SOTTOCOMPONENTI
   ════════════════════════════════════════════════════════════════ */

function UserItem({ user: u, isYou, admin }) {
  return (
    <li>
      <div
        className={`flex items-center gap-3 px-2 py-2 rounded-md transition-colors duration-200 ${
          isYou
            ? "bg-accent/10 border border-accent/20"
            : "hover:bg-bg-base/40 border border-transparent"
        }`}
      >
        <Avatar
          photoURL={u.photoURL}
          displayName={u.displayName}
          seed={u.uid}
          sizeClass="h-8 w-8"
          textSize="text-[10px]"
          ring="ring-1 ring-bg-base"
          showOnline
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-medium truncate ${
                isYou ? "text-accent" : "text-text-primary"
              }`}
            >
              {u.displayName}
            </span>
            {isYou && (
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">
                tu
              </span>
            )}
          </div>
          {admin && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-accent font-bold">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Admin
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function DayDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted font-bold px-3 py-1 rounded-full border border-border bg-bg-surface/50">
        {label}
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   MessageBubble — Fase 3
   I tasti "Rispondi" + emoji menu sono SEMPRE visibili accanto
   al messaggio (niente più hover che fa sparire la toolbar).
   ──────────────────────────────────────────────────────────────── */
function MessageBubble({
  m,
  displayName,
  photoURL,
  isMe,
  sameAuthor,
  isLastInGroup,
  mounted,
  currentUid,
  isAdmin,
  isHighlighted,
  onReact,
  onReply,
  onClickReplyPreview,
  onVotePoll,
  onClosePoll,
}) {
  const time = new Date(m.timestamp || Date.now()).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasReactions =
    m.reactions && Object.keys(m.reactions || {}).length > 0;

  /* ─── Sondaggio: layout dedicato (#21) ─── */
  if (m.type === "poll") {
    const canManage = isAdmin || m.uid === currentUid;
    return (
      <div
        data-message-id={m.id}
        className={`group/msg relative flex gap-3 ${sameAuthor ? "mt-1" : "mt-4"}`}
        style={{
          animation: mounted
            ? "chat-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both"
            : undefined,
        }}
      >
        <div className="shrink-0 w-9">
          <Avatar
            photoURL={photoURL}
            displayName={displayName}
            seed={m.uid}
            sizeClass="h-9 w-9"
            textSize="text-[10px]"
            ring="ring-2 ring-bg-base"
          />
        </div>
        <div className="flex-1 min-w-0 max-w-[88%] sm:max-w-[80%]">
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="text-xs font-bold text-text-primary">
              {isMe ? "Tu" : displayName}
            </span>
            <span className="text-[10px] text-text-muted">{time}</span>
          </div>
          <PollCard
            m={m}
            currentUid={currentUid}
            canManage={canManage}
            onVote={onVotePoll}
            onClose={onClosePoll}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-message-id={m.id}
      className={`group/msg relative flex gap-3 ${isMe ? "flex-row-reverse" : ""} ${
        sameAuthor ? "mt-0.5" : "mt-4"
      } ${isHighlighted ? "chat-highlight" : ""}`}
      style={{
        animation: mounted
          ? "chat-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both"
          : undefined,
      }}
    >
      {/* Avatar slot */}
      <div className="shrink-0 w-9">
        {isLastInGroup ? (
          <Avatar
            photoURL={photoURL}
            displayName={displayName}
            seed={m.uid}
            sizeClass="h-9 w-9"
            textSize="text-[10px]"
            ring="ring-2 ring-bg-base"
          />
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>

      <div
        className={`relative flex-1 max-w-[78%] sm:max-w-[68%] ${
          isMe ? "flex flex-col items-end" : ""
        }`}
      >
        {/* Header (nome + ora) */}
        {!sameAuthor && (
          <div
            className={`flex items-baseline gap-2 mb-1 px-1 ${
              isMe ? "flex-row-reverse" : ""
            }`}
          >
            <span
              className={`text-xs font-bold ${
                isMe ? "text-accent" : "text-text-primary"
              }`}
            >
              {isMe ? "Tu" : displayName}
            </span>
            <span className="text-[10px] text-text-muted">{time}</span>
          </div>
        )}

        {/* Bubble + bottoni inline (sempre visibili) */}
        <div className={`flex items-stretch ${isMe ? "flex-row-reverse" : ""}`}>
          {/* Media SENZA testo/reply → mostrato "nudo" (niente bolla blu),
              più grande e con angoli arrotondati. Altrimenti bolla normale. */}
          {m.media && !m.text && !m.replyTo ? (
            <div className="relative inline-block rounded-2xl overflow-hidden shadow-lg max-w-full">
              <ChatMedia media={m.media} />
            </div>
          ) : (
            <div
              className={`relative inline-block px-4 py-2.5 text-sm leading-relaxed break-words shadow-lg max-w-full ${
                isMe
                  ? `bg-gradient-to-br from-accent to-accent-deep text-text-inverse shadow-accent/10 rounded-2xl ${
                      isLastInGroup ? "rounded-tr-md" : "rounded-tr-2xl"
                    } ${sameAuthor && !isLastInGroup ? "rounded-br-md" : ""}`
                  : `bg-bg-surface border border-border text-text-primary rounded-2xl ${
                      isLastInGroup ? "rounded-tl-md" : "rounded-tl-2xl"
                    } ${sameAuthor && !isLastInGroup ? "rounded-bl-md" : ""}`
              }`}
            >
              {/* Reply preview (dentro il bubble, sopra il testo) */}
              <ReplyPreview
                replyTo={m.replyTo}
                isMe={isMe}
                onClick={onClickReplyPreview}
              />
              {/* Media allegato (con testo/reply) */}
              {m.media && <ChatMedia media={m.media} />}
              {m.text && <div className={m.media ? "mt-1.5" : ""}>{m.text}</div>}
            </div>
          )}

          {/* ✨ Tasti azione SEMPRE visibili accanto al bubble */}
          <MessageActionButtons
            isMe={isMe}
            onReply={onReply}
            onReact={onReact}
          />
          {/* Segnala — solo messaggi altrui di tipo testo */}
          {!isMe && m.type !== "poll" && currentUid && (
            <ReportButton
              contentType="chat"
              contentId={m.id}
              contentText={m.text}
              contentAuthor={{ uid: m.uid, name: displayName }}
              targetRtdbPath={`messages/${m.id}`}
              className="self-center opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity"
            />
          )}
        </div>

        {/* Reazioni sotto al bubble */}
        {hasReactions && (
          <MessageReactions
            messageId={m.id}
            reactions={m.reactions}
            currentUid={currentUid}
            isMe={isMe}
          />
        )}

        {sameAuthor && isLastInGroup && (
          <span
            className={`mt-0.5 px-1 text-[9px] text-text-muted ${
              isMe ? "text-right" : ""
            }`}
          >
            {time}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-accent/15 blur-2xl rounded-full" />
          <div className="relative w-20 h-20 rounded-2xl border border-border bg-bg-surface/60 flex items-center justify-center">
            <svg
              className="w-9 h-9 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </div>
        </div>
        <h3
          className="mt-6 text-3xl text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Chat in attesa
        </h3>
        <p className="mt-2 text-text-secondary max-w-xs">
          Nessun messaggio ancora. Inizia tu la conversazione 🦅
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs uppercase tracking-[0.25em] font-semibold">
          Caricamento chat...
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   MODERAZIONE — banner & toast
   ─────────────────────────────────────────────────────────────── */

function ChatSuspendedBar({ status }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = formatRemainingTime(status.suspendedUntil);
  const banLabel = suspensionDurationLabel(status.banCount);

  return (
    <div className="shrink-0 border-t border-red-500/40 bg-red-500/8 backdrop-blur-xl p-4 sm:p-5">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-red-400">
              Sei sospeso
            </span>
            <span className="text-[10px] text-text-muted">
              · {banLabel} · violazione n° {status.banCount}
            </span>
          </div>
          <div className="text-sm text-text-primary leading-snug">
            {status.suspensionReason || "Violazione del regolamento"}
          </div>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-base/60 border border-red-500/30">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Termina tra
            </span>
            <span className="text-sm font-bold tabular-nums text-red-400">
              {remaining}
            </span>
          </div>
        </div>
        <Link
          to="/profile"
          className="shrink-0 px-4 py-2.5 rounded-md text-xs font-bold bg-bg-surface border border-border hover:border-red-400/50 hover:bg-red-500/10 text-text-primary transition-all duration-300"
        >
          Presenta ricorso →
        </Link>
      </div>
    </div>
  );
}

function ChatBlockedBar({ tone = "disabled", title, description }) {
  return (
    <div className="shrink-0 border-t border-red-500/40 bg-red-500/10 backdrop-blur-xl p-4 sm:p-5">
      <div className="max-w-3xl mx-auto flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-red-400 mb-1">
            {title}
          </div>
          <div className="text-sm text-text-primary leading-relaxed">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function ViolationToast({ data, onDismiss }) {
  const isSuspended = data.type === "suspended";
  const isDisabled = data.type === "disabled" || data.accountDisabled;
  const typeLabel = VIOLATION_LABELS[data.type] || "Avviso";
  // 1ª violazione: solo richiamo, niente sospensione effettiva
  const isWarningOnly =
    !isDisabled &&
    !isSuspended &&
    !data.accountDisabled &&
    (data.suspensionDays === 0 || data.banCount === 1);

  // Stile arancione "warning" se è solo avviso, rosso "error" altrimenti
  const tone = isWarningOnly
    ? {
        border: "border-warning/50",
        bg: "bg-warning/10",
        iconBg: "bg-warning/20 border-warning/60",
        iconColor: "text-warning",
        labelColor: "text-warning",
        accentColor: "text-warning",
      }
    : {
        border: "border-red-500/40",
        bg: "bg-red-500/10",
        iconBg: "bg-red-500/20 border-red-500/50",
        iconColor: "text-red-400",
        labelColor: "text-red-400",
        accentColor: "text-red-400",
      };

  return (
    <div
      className={`mb-3 p-4 rounded-xl border ${tone.border} ${tone.bg} backdrop-blur-sm`}
      style={{ animation: "chat-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-lg ${tone.iconBg} border flex items-center justify-center ${tone.iconColor} font-black text-lg`}>
          {isWarningOnly ? "⚠" : "!"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[10px] uppercase tracking-[0.25em] font-bold ${tone.labelColor}`}>
              {isDisabled
                ? "Account disattivato"
                : isSuspended
                ? "Chat bloccata"
                : isWarningOnly
                ? "Primo avviso · richiamo"
                : `${typeLabel} rilevata`}
            </span>
            <button
              onClick={onDismiss}
              className="text-text-muted hover:text-text-primary text-sm leading-none"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>
          {isDisabled || isSuspended ? (
            <div className="text-sm text-text-primary">{data.match}</div>
          ) : data.accountDisabled ? (
            <div className="text-sm text-text-primary">
              Hai raggiunto la 4ª violazione. Il tuo account è stato disattivato.
            </div>
          ) : isWarningOnly ? (
            <>
              <div className="text-sm text-text-primary leading-snug">
                Messaggio bloccato. Hai ricevuto il{" "}
                <span className={`font-bold ${tone.accentColor}`}>primo avviso</span>: questa
                volta nessuna sospensione, è solo un richiamo.
              </div>
              <div className="mt-1 text-xs text-text-secondary">
                Violazione: "<span className="font-semibold">{data.match}</span>".
              </div>
              <div className={`mt-2 p-2 rounded-md bg-bg-base/40 border ${tone.border} text-xs text-text-secondary`}>
                ⚠ Alla <span className="font-bold text-text-primary">prossima violazione</span>{" "}
                scatta automaticamente la <span className={`font-bold ${tone.accentColor}`}>sospensione di 24 ore</span>.
              </div>
              <Link
                to="/profile"
                className={`inline-flex items-center gap-1 mt-2 text-xs font-bold ${tone.accentColor} hover:underline`}
              >
                Dettagli sul profilo →
              </Link>
            </>
          ) : (
            <>
              <div className="text-sm text-text-primary leading-snug">
                Messaggio bloccato. Sei stato sospeso dalla chat per{" "}
                <span className="font-bold text-red-400">
                  {suspensionDurationLabel(data.banCount)}
                </span>
                .
              </div>
              <div className="mt-1 text-xs text-text-secondary">
                Violazione: "
                <span className="font-semibold">{data.match}</span>". Puoi
                presentare ricorso dal tuo profilo.
              </div>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-red-400 hover:underline"
              >
                Vai al profilo →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
