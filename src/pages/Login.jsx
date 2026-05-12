import React, { useState, useEffect } from "react";
import { auth, googleProvider } from "../firebase/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(result.user);
        setVerificationSent(true);
        setLoading(false);
        return;
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Inserisci la tua email per reimpostare la password.");
      return;
    }
    setResetLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError("Email non trovata. Controlla di aver inserito l'indirizzo corretto.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white grid lg:grid-cols-2">
      {/* LATO SX — Form */}
      <section className="flex items-center justify-center p-6 sm:p-12 order-2 lg:order-1">
        <div
          className={`w-full max-w-md transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="inline-flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-300 to-sky-500 flex items-center justify-center shadow-sm shadow-sky-500/30">
              <span className="text-white font-black text-sm">NN</span>
            </div>
            <span
              className="text-xl tracking-wide text-slate-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}
            >
              NETFLAXT <span className="text-sky-500">NEWS</span>
            </span>
          </div>

          <div className="text-xs uppercase tracking-[0.3em] text-sky-500 font-semibold">
            {isRegistering ? "Nuovo account" : "Bentornato"}
          </div>
          <h1
            className="mt-2 text-4xl sm:text-5xl text-slate-900 leading-[0.95]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {isRegistering ? "CREA IL TUO ACCOUNT." : "ACCEDI AL TUO ACCOUNT."}
          </h1>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm animate-in">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs flex-shrink-0">✓</span>
              Email inviata! Controlla la tua casella di posta e clicca il link per reimpostare la password. Controlla anche la cartella SPAM se non la vedi nella principale.
            </div>
          )}

          {verificationSent && (
            <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-md text-sky-700 text-sm flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">✓</span>
              <div>
                <div className="font-bold mb-1">Account creato con successo!</div>
                Ti abbiamo inviato una email di verifica. Controlla la tua casella e clicca il link per attivare l'account. Controlla anche la cartella SPAM.
              </div>
            </div>
          )}

          {!verificationSent && (
            <form onSubmit={handleEmailAuth} className="mt-8 space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tuonome@esempio.it"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Password
                  </label>
                  {!isRegistering && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline transition disabled:opacity-50"
                    >
                      {resetLoading ? "Invio..." : "Password dimenticata?"}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-20 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-sky-600 transition"
                  >
                    {show ? "Nascondi" : "Mostra"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 bg-slate-900 text-white font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/20 disabled:opacity-50"
              >
                <span className="relative z-10 group-hover:text-slate-900 transition-colors duration-300">
                  {loading ? "Attendere..." : isRegistering ? "Registrati" : "Entra"}
                </span>
                <span className="absolute inset-0 bg-sky-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 tracking-widest">oppure</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className="w-full py-3 border border-slate-200 rounded-md font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 flex items-center justify-center gap-2 hover:-translate-y-0.5"
              >
                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500" />
                Continua con Google
              </button>
            </form>
          )}

          {!verificationSent && (
            <p className="mt-8 text-center text-sm text-slate-600">
              {isRegistering ? "Hai già un account?" : "Non hai un account?"}{" "}
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sky-600 font-semibold hover:underline transition"
              >
                {isRegistering ? "Accedi →" : "Registrati →"}
              </button>
            </p>
          )}

          {verificationSent && (
            <button
              onClick={() => { setVerificationSent(false); setIsRegistering(false); }}
              className="mt-6 w-full py-3 border border-slate-200 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Vai al login →
            </button>
          )}
        </div>
      </section>

      {/* LATO DX — invariato */}
      <section className="relative bg-slate-900 text-white overflow-hidden order-1 lg:order-2 min-h-[280px] lg:min-h-screen">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1200&q=80"
            alt=""
            className={`w-full h-full object-cover transition-all duration-[2000ms] ${
              mounted ? "opacity-40 scale-100" : "opacity-0 scale-110"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/30 via-slate-900/80 to-slate-900" />
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-sky-500/20 blur-3xl" />
        </div>
        <div
          className={`relative h-full flex flex-col justify-center p-8 sm:p-12 lg:p-16 transition-all duration-1000 delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="text-[11px] uppercase tracking-[0.3em] text-sky-300 font-semibold mb-6">
            Fan site indipendente
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-white text-balance"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            UNA <span className="text-sky-300">CURVA</span> <br />
            CHE NON DORME <br /> MAI.
          </h2>
          <p className="mt-6 max-w-md text-slate-300 leading-relaxed">
            Migliaia di tifosi connessi 24/7. News, pronostici e chat live — solo per chi
            crede al biancoceleste.
          </p>
          <div className="mt-10 flex gap-8">
            {[
              { n: "12k+", l: "Tifosi" },
              { n: "340", l: "Articoli/mese" },
              { n: "24/7", l: "Live" },
            ].map((s) => (
              <div key={s.l} className="border-l-2 border-sky-400/60 pl-3">
                <div className="text-2xl text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {s.n}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}