import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase/firebase";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
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

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const getInitials = (name) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setLoadingName(true);
    setSuccessName(false);
    try {
      await updateProfile(auth.currentUser, { displayName });
      setSuccessName(true);
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

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-2xl px-4 space-y-8">

        {/* Header profilo */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-sky-400 flex items-center justify-center text-2xl font-bold text-slate-900 ring-4 ring-slate-900">
            {getInitials(user.displayName || user.email)}
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
              Il tuo profilo
            </div>
            <h1
              className="text-3xl text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {user.displayName || "Utente"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">{user.email}</p>
            {isGoogleUser && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
                Accesso con Google
              </span>
            )}
          </div>
        </div>

        {/* Modifica nome */}
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <h2
            className="text-2xl text-slate-900 mb-6"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Nome visualizzato
          </h2>

          {successName && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold">
              ✅ Nome aggiornato con successo!
            </div>
          )}

          <form onSubmit={handleUpdateName} className="space-y-4">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Il tuo nome"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
            />
            <button
              type="submit"
              disabled={loadingName}
              className="px-6 py-3 bg-slate-900 text-white font-bold rounded-md hover:bg-sky-500 hover:text-slate-900 transition disabled:opacity-50"
            >
              {loadingName ? "Salvataggio..." : "Salva nome"}
            </button>
          </form>
        </div>

        {/* Cambio password — solo per utenti email */}
        {!isGoogleUser && (
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <h2
              className="text-2xl text-slate-900 mb-6"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Cambia password
            </h2>

            {successPassword && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm font-semibold">
                ✅ Password aggiornata con successo!
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nuova password (min. 6 caratteri)"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              />
              <button
                type="submit"
                disabled={loadingPassword}
                className="px-6 py-3 bg-slate-900 text-white font-bold rounded-md hover:bg-sky-500 hover:text-slate-900 transition disabled:opacity-50"
              >
                {loadingPassword ? "Aggiornamento..." : "Cambia password"}
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  );
}