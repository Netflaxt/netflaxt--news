import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase/firebase";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

export default function Profile() {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [successName, setSuccessName] = useState(false);
  const [successPassword, setSuccessPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const getInitials = (name) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
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
        <div
          className={`relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Banner */}
          <div className="h-24 bg-gradient-to-br from-sky-400 via-sky-500 to-slate-900 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)",
              }}
            />
          </div>

          <div className="px-8 pb-8 -mt-12">
            <div className="flex items-end justify-between mb-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center text-3xl font-black text-white ring-4 ring-white shadow-xl">
                {getInitials(user.displayName || user.email)}
              </div>
              {isGoogleUser && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 font-semibold shadow-sm">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500" />
                  Google
                </span>
              )}
            </div>

            <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
              Il tuo profilo
            </div>
            <h1
              className="mt-1 text-4xl text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {user.displayName || "Utente"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-slate-400 mt-2 uppercase tracking-wider">
                Membro da {memberSince}
              </p>
            )}
          </div>
        </div>

        {/* Modifica nome */}
        <div
          className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "120ms" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <h2
              className="text-2xl text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Nome visualizzato
            </h2>
          </div>

          {successName && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
              Nome aggiornato con successo!
            </div>
          )}

          <form onSubmit={handleUpdateName} className="space-y-4">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Il tuo nome"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
            />
            <button
              type="submit"
              disabled={loadingName}
              className="group relative px-6 py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50"
            >
              <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                {loadingName ? "Salvataggio..." : "Salva nome"}
              </span>
              <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
          </form>
        </div>

        {/* Cambio password */}
        {!isGoogleUser && (
          <div
            className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "240ms" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2
                className="text-2xl text-slate-900"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                Cambia password
              </h2>
            </div>

            {successPassword && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
                Password aggiornata!
              </div>
            )}

            {errorPassword && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                {errorPassword}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Password attuale"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nuova password (min. 6 caratteri)"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
              />
              <button
                type="submit"
                disabled={loadingPassword}
                className="group relative px-6 py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg disabled:opacity-50"
              >
                <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                  {loadingPassword ? "Aggiornamento..." : "Cambia password"}
                </span>
                <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}