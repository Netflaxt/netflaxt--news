/* ─────────────────────────────────────────────────────────────
   src/components/NewsletterCTA.jsx
   Form di iscrizione newsletter — salva email in Firestore
   (collection `newsletter/{auto-id}`).
   ───────────────────────────────────────────────────────────── */
import React, { useState } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { MailIcon } from "./icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterCTA({ variant = "card" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error | duplicate
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setErrorMsg("Inserisci un'email valida.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      // Controllo duplicati
      const existing = await getDocs(
        query(collection(db, "newsletter"), where("email", "==", trimmed))
      );
      if (!existing.empty) {
        setStatus("duplicate");
        return;
      }

      // Inserisce nuova iscrizione
      await addDoc(collection(db, "newsletter"), {
        email: trimmed,
        createdAt: serverTimestamp(),
        confirmed: false,
        source: window.location.pathname,
      });
      setStatus("success");
      setEmail("");
    } catch (err) {
      console.error("Errore iscrizione newsletter:", err);
      setStatus("error");
      setErrorMsg("Errore tecnico. Riprova tra qualche secondo.");
    }
  };

  /* ─── Stato: già iscritto ─── */
  if (status === "duplicate") {
    return (
      <div className="p-5 rounded-xl bg-accent/8 border border-accent/30 text-center">
        <div className="flex justify-center mb-2">
          <MailIcon className="w-7 h-7 text-accent" />
        </div>
        <div className="font-bold text-text-primary">
          Sei già iscritto!
        </div>
        <div className="text-xs text-text-secondary mt-1">
          La tua email è già nella nostra lista. Niente da fare 👍
        </div>
      </div>
    );
  }

  /* ─── Stato: successo ─── */
  if (status === "success") {
    return (
      <div className="p-5 rounded-xl bg-success/10 border border-success/40 text-center">
        <div className="text-2xl mb-2">🎉</div>
        <div className="font-bold text-text-primary">
          Iscrizione confermata!
        </div>
        <div className="text-xs text-text-secondary mt-1">
          Riceverai un'email a ogni nuovo articolo. Niente spam.
        </div>
      </div>
    );
  }

  /* ─── Form di default ─── */
  if (variant === "footer") {
    /* Variante compatta inline per footer */
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="La tua email"
          required
          disabled={status === "loading"}
          className="flex-1 px-3 py-2 bg-bg-base/60 border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-4 py-2 bg-accent text-text-inverse text-sm font-bold rounded-md hover:shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)] transition disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {status === "loading" ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Iscriviti</span>
              <span>→</span>
            </>
          )}
        </button>
      </form>
    );
  }

  /* ─── Card grande ─── */
  return (
    <div className="relative p-7 rounded-2xl bg-bg-surface border border-border overflow-hidden">
      {/* Glow di sfondo */}
      <div className="absolute -top-20 -right-10 w-48 h-48 bg-accent/15 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold mb-2">
          Newsletter biancoceleste
        </div>
        <h3
          className="text-3xl text-text-primary leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          NON PERDERE <br />
          <span className="text-gradient-accent">UNA NOTIZIA.</span>
        </h3>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          Ricevi via email gli articoli più importanti. Niente spam,
          puoi cancellarti in 1 click.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tua-email@esempio.it"
            required
            disabled={status === "loading"}
            className="flex-1 px-4 py-3 bg-bg-base/60 border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="group px-5 py-3 bg-accent text-text-inverse text-sm font-bold rounded-md hover:shadow-[0_0_24px_-4px_rgba(56,189,248,0.6)] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {status === "loading" ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Iscrizione...
              </>
            ) : (
              <>
                Iscrivimi
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </>
            )}
          </button>
        </form>

        {status === "error" && (
          <div className="mt-3 text-xs text-red-400 font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[10px] text-text-muted">
          <svg
            className="w-3 h-3 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          GDPR · Cancellabile in 1 click · Solo notizie Lazio
        </div>
      </div>
    </div>
  );
}
