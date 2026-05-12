import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase/firebase";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import axios from "axios";
import i18n from "../i18n/index.js";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const LANGUAGES = [
  { code: "it", label: "🇮🇹 Italiano" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
];

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
  const [language, setLanguage] = useState("it");
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [successProfile, setSuccessProfile] = useState(false);
  const [errorProfile, setErrorProfile] = useState("");

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

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
          setLanguage(data.language || "it");
        }
      } catch (e) {
        console.error("Errore caricamento dati utente:", e);
      } finally {
        setLoadingUserData(false);
      }
    };
    loadUserData();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const getInitials = (name) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setPhotoPreview(localUrl);
    setLoadingPhoto(true);
    setSuccessPhoto(false);
    try {
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
      await refreshUser();
      setPhotoPreview(photoURL);
      setSuccessPhoto(true);
      setTimeout(() => setSuccessPhoto(false), 3000);
    } catch (error) {
      console.error("Errore upload foto:", error);
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

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("netflaxt_lang", lang);
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
      await setDoc(doc(db, "users", user.uid), {
        username: username.toLowerCase(),
        firstName,
        lastName,
        language,
        email: user.email,
        updatedAt: new Date(),
      }, { merge: true });
      setSuccessProfile(true);
      setTimeout(() => setSuccessProfile(false), 3000);
    } catch (e) {
      setErrorProfile("Errore nel salvataggio. Riprova.");
    } finally {
      setSavingProfile(false);
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40 py-12 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-sky-200/30 blur-3xl pointer-events-none" />
      <div className="relative mx-auto max-w-2xl px-4 space-y-6">

        {/* Header profilo */}
        <div className={`relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="h-24 bg-gradient-to-br from-sky-400 via-sky-500 to-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)" }} />
          </div>

          <div className="px-8 pb-8 -mt-12">
            <div className="flex items-end justify-between mb-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-2xl ring-4 ring-white shadow-xl overflow-hidden bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-white">
                      {getInitials(user.displayName || user.email)}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {loadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>

              {isGoogleUser && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 font-semibold shadow-sm">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500" />
                  Google
                </span>
              )}
            </div>

            {successPhoto && (
              <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px]">✓</span>
                Foto profilo aggiornata!
              </div>
            )}

            <p className="text-xs text-slate-400 mb-3">Clicca sulla foto per cambiarla</p>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">Il tuo profilo</div>
            <h1 className="mt-1 text-4xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              {user.displayName || "Utente"}
            </h1>
            {username && (
              <p className="text-sky-500 text-sm font-semibold mt-0.5">@{username}</p>
            )}
            <p className="text-slate-500 text-sm mt-1">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-slate-400 mt-2 uppercase tracking-wider">Membro da {memberSince}</p>
            )}
          </div>
        </div>

        {/* Username, nome, cognome, lingua */}
        <div className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "60ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h2 className="text-2xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Informazioni profilo</h2>
          </div>

          {loadingUserData ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {successProfile && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
                  Profilo aggiornato con successo!
                </div>
              )}
              {errorProfile && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">{errorProfile}</div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="il_tuo_username"
                    maxLength={20}
                    className="w-full pl-7 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">Lettere, numeri, punti e underscore. 3-20 caratteri.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Nome <span className="text-slate-400 font-normal normal-case">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Es. Mario"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Cognome <span className="text-slate-400 font-normal normal-case">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Es. Rossi"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Lingua preferita
                </label>
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="group relative px-6 py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50"
              >
                <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                  {savingProfile ? "Salvataggio..." : "Salva profilo"}
                </span>
                <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </form>
          )}
        </div>

        {/* Modifica nome */}
        <div className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "120ms" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <h2 className="text-2xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Nome visualizzato</h2>
          </div>

          {successName && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
              Nome aggiornato!
            </div>
          )}

          <form onSubmit={handleUpdateName} className="space-y-4">
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Il tuo nome" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200" />
            <button type="submit" disabled={loadingName} className="group relative px-6 py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50">
              <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">{loadingName ? "Salvataggio..." : "Salva nome"}</span>
              <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
          </form>
        </div>

        {/* Modifica email — solo utenti email */}
        {!isGoogleUser && (
          <div className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "180ms" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-2xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Modifica email</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Riceverai una email di verifica al nuovo indirizzo prima che la modifica diventi effettiva.</p>
            <EmailChangeForm user={user} />
          </div>
        )}

        {/* Cambio password — solo utenti email */}
        {!isGoogleUser && (
          <div className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "240ms" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2 className="text-2xl text-slate-900" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Cambia password</h2>
            </div>

            {successPassword && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
                Password aggiornata!
              </div>
            )}

            {errorPassword && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">{errorPassword}</div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Password attuale" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nuova password (min. 6 caratteri)" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200" />
              <button type="submit" disabled={loadingPassword} className="group relative px-6 py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50">
                <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">{loadingPassword ? "Aggiornamento..." : "Cambia password"}</span>
                <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  );
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
          Email di verifica inviata. Controlla la nuova casella e clicca il link per confermare.
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">{error}</div>
      )}
      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Nuova email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Conferma la tua password attuale" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200" />
      <button type="submit" disabled={loading} className="group relative px-6 py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50">
        <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">{loading ? "Aggiornamento..." : "Aggiorna email"}</span>
        <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </button>
    </form>
  );
}