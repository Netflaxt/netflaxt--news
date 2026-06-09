import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { auth, db, googleProvider } from "../firebase/firebase";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  verifyBeforeUpdateEmail,
  deleteUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import axios from "axios";
import {
  getModerationStatus,
  getActiveAppeal,
  submitAppeal,
  formatRemainingTime,
  suspensionDurationLabel,
} from "../utils/moderationService";
import {
  getDeviceId,
  subscribeDevices,
  removeDevice,
} from "../utils/devices";
import {
  BADGES,
  collectUserStats,
  computeUnlockedBadges,
} from "../utils/badges";
import { computePredictionStreak } from "../utils/predictions";
import BadgeChip, { StreakFire } from "../components/BadgeChip";
import OnFireBadge from "../components/OnFireBadge";
import PushOptInCard from "../components/PushOptInCard";
import SoundToggleCard from "../components/SoundToggleCard";
import { playSave } from "../utils/soundDesign";
import { GoogleLogoMark } from "../components/icons";
import { compressImage } from "../utils/imageUpload";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const INPUT_CLASS =
  "w-full px-4 py-3 bg-bg-elevated border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 focus:bg-bg-base transition-all duration-200";
const BTN_CLASS =
  "px-6 py-3 bg-accent text-text-inverse font-bold rounded-md transition-all duration-300 hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] disabled:opacity-50";

export default function Profile() {
  const { user, loading, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [successName, setSuccessName] = useState(false);
  const [successPassword, setSuccessPassword] = useState(false);
  const [successPhoto, setSuccessPhoto] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || null);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef(null);

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [successProfile, setSuccessProfile] = useState(false);
  const [errorProfile, setErrorProfile] = useState("");

  // Badge + streak + stats
  const [profileDoc, setProfileDoc] = useState(null);
  const [stats, setStats] = useState({});
  const [streak, setStreak] = useState({ current: 0, best: 0, totalScored: 0, hitRate: 0 });
  // Set di id badge sbloccati (UNICA fonte per conteggio + griglia)
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState([]);

  // ─── Moderazione ───
  const [modStatus, setModStatus] = useState(null);
  const [activeAppeal, setActiveAppeal] = useState(null);
  const [loadingMod, setLoadingMod] = useState(true);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Mantieni l'anteprima foto del profilo allineata allo stato globale
  // (user.photoURL aggiornato dal listener Firestore in AuthContext).
  // Salta mentre è in corso un upload (loadingPhoto) per non sovrascrivere
  // l'anteprima locale temporanea.
  useEffect(() => {
    if (!loadingPhoto) {
      setPhotoPreview(user?.photoURL || null);
    }
  }, [user?.photoURL, loadingPhoto]);

  useEffect(() => {
    if (!user) return;
    const loadUserData = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUsername(data.username || "");
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setBio(data.bio || "");
          setProfileDoc(data);
        }
      } catch (e) {
        console.error("Errore caricamento dati utente:", e);
      } finally {
        setLoadingUserData(false);
      }
    };
    loadUserData();
  }, [user]);

  // Carica stats + streak e calcola badge sbloccati
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, sk] = await Promise.all([
          collectUserStats(user.uid),
          computePredictionStreak(user.uid),
        ]);
        if (cancelled) return;
        setStats(s);
        setStreak(sk);
        // Badge sbloccati: calcolo PURAMENTE LIVE in base ai dati attuali.
        // Niente persistenza permanente → se l'admin azzera i dati
        // (classifica, chat…) i badge collegati si ri-bloccano da soli.
        // Il popup di sblocco è gestito globalmente da BadgeWatcher.
        const ctx = {
          user,
          profile: { ...(profileDoc || {}), username, firstName },
          predictionCount: s.predictionCount,
          exactCount: s.exactCount,
          bookmarksCount: s.bookmarksCount,
          commentCount: s.commentCount,
          chatCount: s.chatCount,
          reactionsCount: s.reactionsCount,
          bestStreak: sk.best,
        };
        const liveIds = computeUnlockedBadges(ctx);
        if (cancelled) return;
        setUnlockedBadgeIds(liveIds);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, username, firstName, profileDoc]);

  // ✨ Real-time: ascolta il doc utente per countdown + sblocco istantaneo
  // appena l'admin annulla la sospensione (no più polling 30s).
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingMod(true);
    // Carica subito il ricorso attivo una volta (non serve real-time qui)
    getActiveAppeal(user.uid)
      .then(setActiveAppeal)
      .catch((e) => console.error(e));
    // Listener sul doc utente: ogni volta che cambia banCount /
    // suspendedUntil / accountDisabled rinfresca lo stato qui.
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      async (snap) => {
        try {
          const status = await getModerationStatus(user.uid);
          setModStatus(status);
        } catch (e) {
          console.error("Errore aggiornamento moderazione:", e);
        } finally {
          setLoadingMod(false);
        }
      },
      (err) => {
        console.error("Errore listener moderazione:", err);
        setLoadingMod(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const getInitials = (name) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handlePhotoChange = async (e) => {
    const original = e.target.files[0];
    if (!original) return;
    const localUrl = URL.createObjectURL(original);
    setPhotoPreview(localUrl);
    setLoadingPhoto(true);
    setSuccessPhoto(false);
    try {
      // Comprimi le foto grandi del telefono prima dell'upload
      const file = await compressImage(original, { maxDim: 800 });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "netflaxt/avatars");
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      const photoURL = res.data.secure_url;
      await updateProfile(auth.currentUser, { photoURL });
      // Salva il photoURL anche su Firestore così:
      // - il profilo pubblico /u/:username vede la nuova foto subito
      // - il badge "profilo completo" si sblocca correttamente
      await setDoc(
        doc(db, "users", user.uid),
        { photoURL },
        { merge: true }
      );
      await refreshUser();
      setProfileDoc((prev) => ({ ...(prev || {}), photoURL }));
      setPhotoPreview(photoURL);
      setSuccessPhoto(true);
      setTimeout(() => setSuccessPhoto(false), 3000);
    } catch (error) {
      console.error("Errore upload foto:", error);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (e) => {
    // L'evento può venire dal click sul bottone "rimuovi": fermalo così
    // non scatena anche l'apertura del file picker (parent ha onClick).
    if (e?.stopPropagation) e.stopPropagation();
    if (loadingPhoto) return;
    setLoadingPhoto(true);
    setSuccessPhoto(false);
    try {
      await updateProfile(auth.currentUser, { photoURL: null });
      await setDoc(
        doc(db, "users", user.uid),
        { photoURL: null },
        { merge: true }
      );
      await refreshUser();
      setProfileDoc((prev) => ({ ...(prev || {}), photoURL: null }));
      setPhotoPreview(null);
      setSuccessPhoto(true);
      setTimeout(() => setSuccessPhoto(false), 3000);
    } catch (error) {
      console.error("Errore rimozione foto:", error);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setLoadingName(true);
    setSuccessName(false);
    try {
      await updateProfile(auth.currentUser, { displayName });
      // ✨ Aggiorna SUBITO il context user → Navbar/Avatar si rinfrescano
      await refreshUser();
      playSave();
      setSuccessName(true);
      setTimeout(() => setSuccessName(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingName(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoadingPassword(true);
    setSuccessPassword(false);
    setErrorPassword("");
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setSuccessPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setSuccessPassword(false), 3000);
    } catch (error) {
      if (error.code === "auth/wrong-password") {
        setErrorPassword("Password attuale non corretta.");
      } else if (error.code === "auth/weak-password") {
        setErrorPassword("La nuova password deve avere almeno 6 caratteri.");
      } else {
        setErrorPassword("Errore. Riprova.");
      }
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setErrorProfile("");
    setSuccessProfile(false);

    if (username) {
      const usernameRegex = /^[a-zA-Z0-9._]{3,20}$/;
      if (!usernameRegex.test(username)) {
        setErrorProfile("Username: solo lettere, numeri, punti e underscore (3-20 caratteri).");
        setSavingProfile(false);
        return;
      }
      try {
        const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
        const snap = await getDocs(q);
        const takenByOther = snap.docs.some((d) => d.id !== user.uid);
        if (takenByOther) {
          setErrorProfile("Username già in uso. Scegline un altro.");
          setSavingProfile(false);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      const newData = {
        username: username.toLowerCase(),
        firstName,
        lastName,
        bio: (bio || "").slice(0, 280),
        language: "it",
        email: user.email,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, "users", user.uid), newData, { merge: true });
      // ✨ Aggiorna lo stato locale: sezione badge + bio + link profilo pubblico
      // si rinfrescano subito senza dover ricaricare la pagina.
      setProfileDoc((prev) => ({ ...(prev || {}), ...newData }));
      playSave();
      setSuccessProfile(true);
      setTimeout(() => setSuccessProfile(false), 3000);
    } catch (e) {
      setErrorProfile("Errore nel salvataggio. Riprova.");
    } finally {
      setSavingProfile(false);
    }
  };

  const reloadModerationStatus = async () => {
    if (!user?.uid) return;
    try {
      const [status, appeal] = await Promise.all([
        getModerationStatus(user.uid),
        getActiveAppeal(user.uid),
      ]);
      setModStatus(status);
      setActiveAppeal(appeal);
    } catch (e) {
      console.error(e);
    }
  };

  const isGoogleUser = user.providerData?.[0]?.providerId === "google.com";
  const memberSince = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("it-IT", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-bg-base text-text-primary py-12 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-accent/8 blur-3xl pointer-events-none" />
      <div className="relative mx-auto max-w-2xl px-4 space-y-6">

        {/* ═══════════════════ BANNER MODERAZIONE ═══════════════════ */}
        {!loadingMod &&
          (modStatus?.accountDisabled ||
            modStatus?.isSuspended ||
            (modStatus?.banCount || 0) > 0) && (
            <ModerationBanner
              status={modStatus}
              appeal={activeAppeal}
              user={user}
              onAppealSubmitted={reloadModerationStatus}
              mounted={mounted}
            />
          )}

        {/* Header profilo */}
        <div className={`relative bg-bg-surface rounded-2xl border border-border overflow-hidden shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="h-24 bg-gradient-to-br from-accent via-accent-deep to-bg-elevated relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)" }} />
          </div>

          <div className="px-8 pb-8 -mt-12">
            <div className="flex items-end justify-between mb-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-2xl ring-4 ring-bg-surface shadow-xl overflow-hidden bg-gradient-to-br from-accent to-accent-deep flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-text-inverse">
                      {getInitials(user.displayName || user.email)}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-bg-base/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {loadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-7 h-7 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>

              {isGoogleUser && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border rounded-full text-xs text-text-secondary font-semibold shadow-sm">
                  <GoogleLogoMark className="w-3.5 h-3.5" />
                  Google
                </span>
              )}
            </div>

            {successPhoto && (
              <div className="mb-3 p-2 bg-success/10 border border-success/30 rounded-md text-success text-xs font-semibold flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-success flex items-center justify-center text-white text-[10px]">✓</span>
                Foto profilo aggiornata!
              </div>
            )}

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <p className="text-xs text-text-muted">Clicca sulla foto per cambiarla</p>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={loadingPhoto}
                  className="text-[11px] font-bold text-text-muted hover:text-error transition disabled:opacity-50"
                >
                  ✕ Rimuovi foto profilo
                </button>
              )}
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">Il tuo profilo</div>
            <h1 className="mt-1 text-4xl text-text-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              {user.displayName || "Utente"}
            </h1>
            {username && (
              <p className="text-accent text-sm font-semibold mt-0.5">@{username}</p>
            )}
            <p className="text-text-secondary text-sm mt-1">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-text-muted mt-2 uppercase tracking-wider">Membro da {memberSince}</p>
            )}
          </div>
        </div>

        {/* Stats + Streak + Badge sintetico */}
        <div className={`bg-bg-surface rounded-2xl border border-border p-6 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`} style={{ transitionDelay: "80ms" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-bold">
                Le tue statistiche
              </div>
              <h2 className="text-2xl text-text-primary mt-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                A che punto sei
              </h2>
            </div>
            {streak.best > 0 && <OnFireBadge streak={streak.current || streak.best} size="lg" />}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MiniStat label="Punti" value={stats.totalPoints || 0} accent />
            <MiniStat label="Esatti (3pt)" value={stats.exactCount || 0} />
            <MiniStat label="Esiti (1pt)" value={stats.correctCount || 0} />
            <MiniStat label="Errate" value={stats.wrongCount || 0} />
          </div>
          <div className="mt-2.5 text-[10px] text-text-muted tabular-nums text-right">
            Hit-rate complessivo: <span className="text-text-secondary font-bold">{streak.hitRate}%</span>
          </div>

          {/* Riassunto badge */}
          <div className="mt-5 pt-5 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Badge sbloccati
              </div>
              <span className="text-xs text-text-muted">
                <span className="text-text-primary font-bold tabular-nums">
                  {unlockedBadgeIds.length}
                </span>{" "}
                / {BADGES.length}
              </span>
            </div>
            <BadgeGrid unlockedIds={unlockedBadgeIds} />
          </div>
        </div>

        {/* Shortcut: i miei salvati */}
        <Link
          to="/profile/saved"
          className={`group flex items-center justify-between gap-4 p-5 bg-bg-surface border border-border hover:border-accent/40 rounded-2xl shadow-sm transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-text-primary truncate">Articoli salvati</div>
              <div className="text-xs text-text-muted">Tutti gli articoli messi da parte</div>
            </div>
          </div>
          <span className="text-accent font-bold transition-transform group-hover:translate-x-1">→</span>
        </Link>

        {/* Username, nome, cognome, lingua */}
        <div className={`bg-bg-surface rounded-2xl border border-border p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "60ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-2xl text-text-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Informazioni profilo</h2>
          </div>

          {loadingUserData ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {successProfile && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-success flex items-center justify-center text-white text-xs">✓</span>
                  Profilo aggiornato con successo!
                </div>
              )}
              {errorProfile && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-sm">{errorProfile}</div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="il_tuo_username"
                    maxLength={20}
                    className={`${INPUT_CLASS} pl-7`}
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted">Lettere, numeri, punti e underscore. 3-20 caratteri.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Nome <span className="text-text-muted font-normal normal-case">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Es. Mario"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Cognome <span className="text-text-muted font-normal normal-case">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Es. Rossi"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                  <span>Bio <span className="text-text-muted font-normal normal-case">(visibile sul profilo pubblico)</span></span>
                  <span className="tabular-nums text-[10px] text-text-muted">
                    {(bio || "").length}/280
                  </span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 280))}
                  rows={3}
                  placeholder="Una frase per descriverti: tifoso da sempre, Olimpico ogni domenica, ecc."
                  className={`${INPUT_CLASS} resize-none`}
                />
                {username && (
                  <p className="mt-2 text-xs text-text-muted">
                    Il tuo profilo pubblico:{" "}
                    <Link to={`/u/${username}`} className="text-accent font-semibold hover:underline">
                      netflaxt.it/u/{username}
                    </Link>
                  </p>
                )}
              </div>

              <button type="submit" disabled={savingProfile} className={BTN_CLASS}>
                {savingProfile ? "Salvataggio..." : "Salva profilo"}
              </button>
            </form>
          )}
        </div>

        {/* Modifica nome */}
        <div className={`bg-bg-surface rounded-2xl border border-border p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "120ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <h2 className="text-2xl text-text-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Nome visualizzato</h2>
          </div>

          {successName && (
            <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm font-semibold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-success flex items-center justify-center text-white text-xs">✓</span>
              Nome aggiornato!
            </div>
          )}

          <form onSubmit={handleUpdateName} className="space-y-4">
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Il tuo nome" className={INPUT_CLASS} />
            <button type="submit" disabled={loadingName} className={BTN_CLASS}>
              {loadingName ? "Salvataggio..." : "Salva nome"}
            </button>
          </form>
        </div>

        {/* Modifica email — solo utenti email */}
        {!isGoogleUser && (
          <div className={`bg-bg-surface rounded-2xl border border-border p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "180ms" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-2xl text-text-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Modifica email</h2>
            </div>
            <p className="text-sm text-text-secondary mb-4">Riceverai una email di verifica al nuovo indirizzo prima che la modifica diventi effettiva.</p>
            <EmailChangeForm user={user} />
          </div>
        )}

        {/* Cambio password — solo utenti email */}
        {!isGoogleUser && (
          <div className={`bg-bg-surface rounded-2xl border border-border p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "240ms" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2 className="text-2xl text-text-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Cambia password</h2>
            </div>

            {successPassword && (
              <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-success flex items-center justify-center text-white text-xs">✓</span>
                Password aggiornata!
              </div>
            )}

            {errorPassword && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-md text-error text-sm">{errorPassword}</div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Password attuale" required className={INPUT_CLASS} />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nuova password (min. 6 caratteri)" required className={INPUT_CLASS} />
              <button type="submit" disabled={loadingPassword} className={BTN_CLASS}>
                {loadingPassword ? "Aggiornamento..." : "Cambia password"}
              </button>
            </form>
          </div>
        )}

        {/* Push notifications opt-in */}
        <PushOptInCard user={user} />

        {/* Mini suoni discreti */}
        <SoundToggleCard />

        {/* Gestisci dispositivi collegati */}
        <DevicesSection user={user} isGoogleUser={isGoogleUser} mounted={mounted} />

        {/* Elimina account */}
        <DeleteAccountSection user={user} isGoogleUser={isGoogleUser} mounted={mounted} />

      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MiniStat — tile compatto per riassunto sul profilo
   ═══════════════════════════════════════════════════════════════ */
function MiniStat({ label, value, accent }) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        accent
          ? "bg-accent/10 border-accent/30"
          : "bg-bg-elevated border-border"
      }`}
    >
      <div className="text-[9px] uppercase tracking-[0.22em] text-text-muted font-bold">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-black tabular-nums leading-none ${
          accent ? "text-accent" : "text-text-primary"
        }`}
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BadgeGrid — mostra badge sbloccati + locked
   ═══════════════════════════════════════════════════════════════ */
function BadgeGrid({ unlockedIds }) {
  // Usa lo STESSO set passato dal Profile → conteggio header e griglia
  // sono SEMPRE coerenti (era questo il bug del "2/12").
  const unlocked = new Set(unlockedIds || []);
  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      {BADGES.map((b) => (
        <BadgeChip key={b.id} badge={b} locked={!unlocked.has(b.id)} size="sm" />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ELIMINA ACCOUNT — richiede conferma email + password (o Google)
   ═══════════════════════════════════════════════════════════════ */
function DeleteAccountSection({ user, isGoogleUser, mounted }) {
  const [open, setOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailMatches =
    emailInput.trim().toLowerCase() === (user.email || "").toLowerCase();
  const canSubmit = emailMatches && (isGoogleUser || password.length > 0);

  const reset = () => {
    setOpen(false);
    setEmailInput("");
    setPassword("");
    setError("");
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      // 1) Re-autenticazione (richiesta da Firebase per operazioni sensibili)
      if (isGoogleUser) {
        await reauthenticateWithPopup(auth.currentUser, googleProvider);
      } else {
        const cred = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(auth.currentUser, cred);
      }
      // 2) Rimuove il documento utente da Firestore (best-effort)
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (e2) {
        console.warn("Impossibile eliminare il doc utente:", e2);
      }
      // 3) Elimina l'account di autenticazione → logout automatico + redirect
      await deleteUser(auth.currentUser);
      // Da qui in poi AuthContext rileva user=null e reindirizza al login.
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Password non corretta.");
      } else if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        setError("Conferma con Google annullata.");
      } else if (err.code === "auth/requires-recent-login") {
        setError("Per sicurezza esci e rientra, poi riprova a eliminare l'account.");
      } else {
        setError("Errore durante l'eliminazione. Riprova.");
        console.error(err);
      }
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-error/40 bg-error/5 p-8 shadow-sm transition-all duration-700 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: "300ms" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-error/15 border border-error/40 flex items-center justify-center">
          <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </div>
        <h2 className="text-2xl text-error" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          Elimina account
        </h2>
      </div>

      <p className="text-sm text-text-secondary mb-4">
        L'eliminazione è <span className="font-bold text-text-primary">definitiva e irreversibile</span>:
        verranno rimossi il tuo profilo e l'accesso. Per sicurezza devi confermare con la tua
        email{isGoogleUser ? " e l'account Google" : " e la tua password"}.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-5 py-2.5 rounded-md border border-error/50 text-error text-sm font-bold hover:bg-error/10 transition"
        >
          Elimina il mio account
        </button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
              Scrivi la tua email per confermare
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </div>

          {!isGoogleUser && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                Conferma la password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="La tua password"
                className={INPUT_CLASS}
              />
            </div>
          )}

          {isGoogleUser && (
            <p className="text-xs text-text-muted">
              Cliccando "Elimina definitivamente" si aprirà la finestra di Google per confermare la tua identità.
            </p>
          )}

          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-sm">{error}</div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="px-5 py-2.5 rounded-md bg-error text-white text-sm font-bold transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Elimina definitivamente
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={loading}
              className="px-5 py-2.5 rounded-md border border-border text-text-secondary text-sm font-semibold hover:bg-bg-elevated hover:text-text-primary transition"
            >
              Annulla
            </button>
          </div>
          {!emailMatches && emailInput.length > 0 && (
            <p className="text-[11px] text-error">L'email non corrisponde al tuo account.</p>
          )}
        </form>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BANNER MODERAZIONE (sospensione + ricorso)
   ═══════════════════════════════════════════════════════════════ */
function ModerationBanner({ status, appeal, user, onAppealSubmitted, mounted }) {
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState(false);
  const [, force] = useState(0);

  // Countdown ticker (solo se sospensione)
  useEffect(() => {
    if (status?.accountDisabled) return;
    const t = setInterval(() => force((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [status?.accountDisabled]);

  const handleAppealSubmit = async (e) => {
    e.preventDefault();
    if (appealText.trim().length === 0) {
      setSubmitError("Scrivi una motivazione per il tuo ricorso.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await submitAppeal(user, status, appealText.trim());
      setSubmitOk(true);
      setShowAppealForm(false);
      setAppealText("");
      if (onAppealSubmitted) onAppealSubmitted();
      setTimeout(() => setSubmitOk(false), 5000);
    } catch (err) {
      setSubmitError(err.message || "Errore invio ricorso. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = !!status.accountDisabled;
  const isSuspended = !!status.isSuspended;
  // Solo avviso: ha già ricevuto una violazione (banCount > 0) ma
  // non è sospeso né disabilitato. È un PROMEMORIA: alla prossima
  // scatta la sospensione di 24 ore.
  const isWarningOnly = !isDisabled && !isSuspended && (status.banCount || 0) > 0;
  const remaining = status.suspendedUntil ? formatRemainingTime(status.suspendedUntil) : null;

  // Palette: arancione "warning" per il solo avviso, rossa per ban/disable
  const tone = isWarningOnly
    ? {
        border: "border-warning/40",
        bg: "bg-warning/5",
        stripe: "from-warning via-amber-500 to-warning",
        iconBg: "bg-warning/15 border-warning/40",
        iconColor: "text-warning",
        labelColor: "text-warning",
        cardBorder: "border-warning/30",
        innerBorder: "border-warning/20",
      }
    : {
        border: "border-error/40",
        bg: "bg-error/5",
        stripe: "from-error via-red-500 to-error",
        iconBg: "bg-error/15 border-error/40",
        iconColor: "text-error",
        labelColor: "text-error",
        cardBorder: "border-error/30",
        innerBorder: "border-error/20",
      };

  return (
    <div
      className={`relative rounded-2xl border ${tone.border} ${tone.bg} shadow-lg overflow-hidden transition-all duration-700 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* Stripe colorata in alto */}
      <div className={`h-1.5 bg-gradient-to-r ${tone.stripe}`} />

      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-xl ${tone.iconBg} border flex items-center justify-center`}>
            <svg className={`w-6 h-6 ${tone.iconColor}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-[0.3em] font-black ${tone.labelColor}`}>
              {isDisabled
                ? "Account disattivato"
                : isWarningOnly
                ? "Primo avviso registrato"
                : "Account sospeso"}
            </div>
            <h2
              className="mt-1 text-3xl text-text-primary leading-none"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {isDisabled
                ? "Non puoi più usare questo account"
                : isWarningOnly
                ? "Hai preso il primo avviso"
                : "La chat è bloccata per te"}
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {isDisabled
                ? "Hai raggiunto la 4ª violazione del regolamento. L'account è stato disattivato in modo permanente. Puoi presentare ricorso e verrà valutato dall'admin."
                : isWarningOnly
                ? "Hai violato il regolamento della chat per la prima volta. Stavolta è solo un richiamo, puoi continuare a scrivere. Stai però attento: alla prossima scatta la sospensione di 24 ore in automatico."
                : `Sei stato sospeso per ${suspensionDurationLabel(status.banCount)}. Non puoi scrivere in chat, ma puoi continuare a navigare sul sito.`}
            </p>

            {/* Preavviso "prossima sanzione" — solo per il warning */}
            {isWarningOnly && (
              <div className={`mt-4 p-3 rounded-lg bg-bg-surface border ${tone.cardBorder} flex items-center gap-3`}>
                <div className={`shrink-0 w-8 h-8 rounded-md ${tone.iconBg} border flex items-center justify-center ${tone.iconColor} font-black`}>
                  →
                </div>
                <div className="min-w-0 text-sm">
                  <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted">
                    Prossima sanzione
                  </div>
                  <div className="text-text-primary font-semibold leading-tight">
                    Sospensione automatica di{" "}
                    <span className={`${tone.labelColor} font-black`}>24 ore</span>
                  </div>
                </div>
              </div>
            )}

            {/* Countdown timer */}
            {!isDisabled && remaining && (
              <div className="mt-5 inline-flex items-center gap-4 p-4 rounded-xl bg-bg-surface border border-error/30 shadow-sm">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-error/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted">
                    Termina tra
                  </div>
                  <div className="text-2xl font-black tabular-nums text-error leading-tight" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {remaining}
                  </div>
                </div>
              </div>
            )}

            {/* Dettagli violazione */}
            <div className={`mt-5 p-4 rounded-lg bg-bg-base/50 border ${tone.innerBorder}`}>
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-1">
                {isWarningOnly ? "Motivo dell'avviso" : "Motivo della sospensione"}
              </div>
              <div className="text-sm font-semibold text-text-primary">
                {status.suspensionReason || "Violazione del regolamento"}
              </div>
              {status.flaggedMessages && status.flaggedMessages.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-text-muted mb-2">
                    Messaggi segnalati
                  </div>
                  <div className="space-y-1.5">
                    {status.flaggedMessages.slice(-3).map((m, i) => (
                      <div key={i} className={`text-xs bg-bg-elevated border ${tone.innerBorder} rounded px-3 py-2 text-text-secondary italic`}>
                        "{m.text}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stato ricorso */}
            {appeal && (
              <div className="mt-4">
                <AppealStatusCard appeal={appeal} />
              </div>
            )}

            {/* Successo invio ricorso */}
            {submitOk && (
              <div className="mt-4 p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm font-semibold">
                ✓ Ricorso inviato. Riceverai una notifica via email appena verrà valutato.
              </div>
            )}

            {/* Bottone / form ricorso */}
            {!appeal || appeal.status === "confirmed" ? (
              <div className="mt-5">
                {!showAppealForm ? (
                  <button
                    onClick={() => setShowAppealForm(true)}
                    className="px-5 py-3 rounded-md bg-accent text-text-inverse text-sm font-bold transition shadow-md hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)]"
                  >
                    {appeal?.status === "confirmed"
                      ? "Presenta nuovo ricorso"
                      : "Presenta ricorso →"}
                  </button>
                ) : (
                  <form onSubmit={handleAppealSubmit} className="mt-2 space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Perché ritieni che la sospensione sia ingiusta?
                    </label>
                    <textarea
                      value={appealText}
                      onChange={(e) => setAppealText(e.target.value)}
                      rows={5}
                      maxLength={2000}
                      placeholder="Spiega in modo educato. Il ricorso verrà letto dall'admin e riceverai una notifica con la decisione."
                      className={`${INPUT_CLASS} resize-none text-sm`}
                    />
                    <div className="text-[10px] text-text-muted text-right tabular-nums">
                      {appealText.length} / 2000
                    </div>
                    {submitError && (
                      <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-sm">
                        {submitError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-md bg-accent text-text-inverse text-sm font-bold transition disabled:opacity-50 hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)]"
                      >
                        {submitting ? "Invio..." : "Invia ricorso"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAppealForm(false);
                          setAppealText("");
                          setSubmitError("");
                        }}
                        className="px-5 py-2.5 rounded-md border border-border text-text-secondary text-sm font-semibold hover:bg-bg-elevated hover:text-text-primary transition"
                      >
                        Annulla
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppealStatusCard({ appeal }) {
  const statusMeta = {
    pending: {
      label: "In valutazione",
      bg: "bg-warning/10 border-warning/30",
      text: "text-warning",
      icon: "⏳",
      message: "Il tuo ricorso è in attesa di valutazione dall'admin.",
    },
    confirmed: {
      label: "Ricorso respinto",
      bg: "bg-error/10 border-error/30",
      text: "text-error",
      icon: "✕",
      message: "L'admin ha confermato la sospensione dopo aver letto il tuo ricorso.",
    },
    accepted: {
      label: "Ricorso accolto",
      bg: "bg-success/10 border-success/30",
      text: "text-success",
      icon: "✓",
      message: "L'admin ha accolto il tuo ricorso. La sospensione è stata annullata.",
    },
  };
  const meta = statusMeta[appeal.status] || statusMeta.pending;
  const submittedAt = appeal.createdAt?.toDate?.()?.toLocaleString("it-IT");
  const resolvedAt = appeal.resolvedAt?.toDate?.()?.toLocaleString("it-IT");

  return (
    <div className={`p-4 rounded-lg border ${meta.bg}`}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-bg-surface border border-border flex items-center justify-center text-lg">
          {meta.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] uppercase tracking-[0.22em] font-black ${meta.text}`}>
            {meta.label}
          </div>
          <div className="text-sm text-text-primary mt-1 font-semibold">
            {meta.message}
          </div>
          <div className="mt-2 text-[10px] text-text-muted space-x-2">
            {submittedAt && <span>Inviato: {submittedAt}</span>}
            {resolvedAt && <span>· Risolto: {resolvedAt}</span>}
          </div>
          {appeal.adminNote && (
            <div className="mt-3 p-2 bg-bg-base/60 border border-border rounded text-xs text-text-secondary">
              <span className="font-bold text-text-muted uppercase tracking-wider text-[9px]">Nota admin:</span>{" "}
              {appeal.adminNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GESTISCI DISPOSITIVI — lista device collegati + revoca + reset pwd
   ═══════════════════════════════════════════════════════════════ */
function DevicesSection({ user, isGoogleUser, mounted }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // deviceId in attesa di delete
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState("");
  const myDeviceId = getDeviceId();

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = subscribeDevices(
      user.uid,
      (list) => {
        setDevices(list);
        setLoading(false);
      },
      (e) => {
        setError("Errore caricamento dispositivi.");
        console.error(e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const handleRemove = async (deviceId) => {
    setBusy(deviceId);
    setError("");
    try {
      await removeDevice(user.uid, deviceId);
      setConfirmId(null);
    } catch (e) {
      console.error(e);
      setError("Non sono riuscito a rimuovere il dispositivo. Riprova.");
    } finally {
      setBusy(null);
    }
  };

  const handleChangePasswordHint = () => {
    // Scrolla alla sezione "Cambia password" già presente nel profilo
    const target = document.querySelector('input[type="password"]');
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => target.focus(), 600);
    }
  };

  return (
    <div
      className={`bg-bg-surface rounded-2xl border border-border p-8 shadow-sm transition-all duration-700 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: "260ms" }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
        </div>
        <h2 className="text-2xl text-text-primary" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          Gestisci dispositivi
        </h2>
      </div>

      <p className="text-sm text-text-secondary mb-5">
        Qui vedi tutti i dispositivi attualmente collegati al tuo account.
        Rimuovi quelli che non riconosci per disconnetterli all'istante.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-md text-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-6 rounded-xl border border-border bg-bg-base/40 text-sm text-text-muted">
          Nessun dispositivo tracciato. Apparirà tra pochi secondi.
        </div>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <DeviceItem
              key={d.id}
              device={d}
              isMine={d.id === myDeviceId}
              isConfirming={confirmId === d.id}
              busy={busy === d.id}
              onAskRemove={() => setConfirmId(d.id)}
              onCancel={() => setConfirmId(null)}
              onConfirmRemove={() => handleRemove(d.id)}
            />
          ))}
        </ul>
      )}

      {/* Warning + bottone cambio password */}
      <div className="mt-6 p-4 rounded-xl border border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-md bg-warning/15 border border-warning/40 flex items-center justify-center text-warning text-base font-black">
            ⚠
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-text-primary">
              Non riconosci un dispositivo?
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Per sicurezza{" "}
              <span className="font-semibold text-text-primary">cambia la password</span>{" "}
              subito. Tutti gli altri dispositivi verranno disconnessi e dovranno
              accedere di nuovo.
            </p>
            {isGoogleUser ? (
              <p className="mt-2 text-[11px] text-text-muted">
                Hai un account Google: cambia la password direttamente sul tuo
                account Google per proteggerti.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleChangePasswordHint}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-warning text-text-inverse text-xs font-black uppercase tracking-wider hover:brightness-110 transition"
              >
                Cambia password ora →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceItem({
  device,
  isMine,
  isConfirming,
  busy,
  onAskRemove,
  onCancel,
  onConfirmRemove,
}) {
  const lastSeen = device.lastSeen?.toDate?.();
  const lastSeenLabel = lastSeen ? formatRelativeTime(lastSeen) : "—";

  return (
    <li
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        isMine
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-bg-elevated"
      }`}
    >
      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
        isMine ? "bg-accent/15 text-accent border border-accent/30" : "bg-bg-base/60 text-text-secondary border border-border"
      }`}>
        <DeviceIcon kind={device.kind} className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-text-primary truncate">
          {device.label || "Dispositivo"}
          {isMine && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
              questo dispositivo
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-muted mt-0.5">
          Ultimo accesso: {lastSeenLabel}
        </div>
      </div>

      {/* Azioni */}
      {isMine ? (
        <span className="text-[10px] uppercase tracking-wider font-bold text-accent shrink-0">
          attivo
        </span>
      ) : isConfirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onConfirmRemove}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-bold bg-error text-white rounded-md hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Conferma
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-bold border border-border text-text-secondary rounded-md hover:bg-bg-base/60"
          >
            Annulla
          </button>
        </div>
      ) : (
        <button
          onClick={onAskRemove}
          className="shrink-0 px-3 py-1.5 text-xs font-bold border border-error/40 text-error rounded-md hover:bg-error/10 transition"
        >
          Rimuovi
        </button>
      )}
    </li>
  );
}

function DeviceIcon({ kind, className = "" }) {
  // Mobile (phone)
  if (kind === "mobile" || kind === "pwa") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="6" y="2" width="12" height="20" rx="2.5" />
        <line x1="11" y1="18" x2="13" y2="18" strokeLinecap="round" />
      </svg>
    );
  }
  // Tablet
  if (kind === "tablet") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="3" width="16" height="18" rx="2.5" />
        <line x1="11" y1="18.5" x2="13" y2="18.5" strokeLinecap="round" />
      </svg>
    );
  }
  // Desktop (default)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 20h8M12 17v3" strokeLinecap="round" />
    </svg>
  );
}

function formatRelativeTime(date) {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "ora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min fa`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h fa`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} g fa`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function EmailChangeForm({ user }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
      setSuccess(true);
      setNewEmail("");
      setPassword("");
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      if (err.code === "auth/wrong-password") setError("Password non corretta.");
      else if (err.code === "auth/email-already-in-use") setError("Email già in uso da un altro account.");
      else setError("Errore. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm font-semibold flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-success flex items-center justify-center text-white text-xs">✓</span>
          Email di verifica inviata. Controlla la nuova casella e clicca il link per confermare.
        </div>
      )}
      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-md text-error text-sm">{error}</div>
      )}
      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Nuova email" required className={INPUT_CLASS} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Conferma la tua password attuale" required className={INPUT_CLASS} />
      <button type="submit" disabled={loading} className={BTN_CLASS}>
        {loading ? "Aggiornamento..." : "Aggiorna email"}
      </button>
    </form>
  );
}
