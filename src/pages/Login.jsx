import React, { useState } from "react";
import { auth, googleProvider } from "../firebase/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
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

  return (
    <main className="min-h-screen bg-white grid lg:grid-cols-2">
      {/* LATO SX — Form */}
      <section className="flex items-center justify-center p-6 sm:p-12 order-2 lg:order-1">
        <div className="w-full max-w-md">
          <div className="inline-flex items-center gap-2 mb-12">
            <div className="h-9 w-9 rounded-full bg-sky-400 ring-2 ring-slate-900 flex items-center justify-center">
              <span className="text-slate-900 font-bold text-sm">NN</span>
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
            className="mt-2 text-4xl sm:text-5xl text-slate-900 leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {isRegistering ? "CREA IL TUO ACCOUNT." : "ACCEDI AL TUO ACCOUNT."}
          </h1>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}

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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-sky-600"
                >
                  {show ? "Nascondi" : "Mostra"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-md hover:bg-sky-500 hover:text-slate-900 transition"
            >
              {isRegistering ? "Registrati" : "Entra"}
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
              className="w-full py-3 border border-slate-200 rounded-md font-semibold text-slate-700 hover:border-slate-400 transition flex items-center justify-center gap-2"
            >
              <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500" />
              Continua con Google
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            {isRegistering ? "Hai già un account?" : "Non hai un account?"}{" "}
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sky-600 font-semibold hover:underline"
            >
              {isRegistering ? "Accedi →" : "Registrati →"}
            </button>
          </p>
        </div>
      </section>

      {/* LATO DX */}
      <section className="relative bg-slate-900 text-white overflow-hidden order-1 lg:order-2 min-h-[280px] lg:min-h-screen">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1200&q=80"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/30 via-slate-900/80 to-slate-900" />
        </div>
        <div className="relative h-full flex flex-col justify-center p-8 sm:p-12 lg:p-16">
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl leading-[0.95] text-white"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            UNA <span className="text-sky-300">CURVA</span> <br />
            CHE NON DORME <br /> MAI.
          </h2>
          <p className="mt-6 max-w-md text-slate-300">
            Migliaia di tifosi connessi 24/7. News, pronostici e chat live.
          </p>
        </div>
      </section>
    </main>
  );
}