import React, { useState, useEffect } from "react";
import { setSEO, resetSEO } from "../utils/seo";
import { Link, useNavigate } from "react-router-dom";
import { auth, googleProvider, db } from "../firebase/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  verificaDispositivo,
  inviaEmailApprovazione,
  dispositivoApprovato,
} from "../utils/deviceApproval";
import { ShieldIcon } from "../components/icons";

/* Conferma email per utenti Google.
   - 1° login Google: doc Firestore con requireEmailConfirm=true → invio email
     verifica con continueUrl che porta a /login?emailConfirmed=true&email=...
     → signOut → schermata "controlla la tua email"
   - Quando l'utente clicca il link nell'email atterra di nuovo su /login
     con i parametri, e noi salviamo in localStorage che QUESTA email è stata
     confermata in questo browser.
   - 2° login Google: matching tra email loggata e flag in localStorage →
     se ok azzera requireEmailConfirm e fa entrare. */
const EMAIL_CONFIRMED_LS_KEY = "netflaxt:emailConfirmed";

/* Quando conviene abbandonare la finestra di Google e passare
   all'accesso a pagina intera.

   Sono i casi in cui la finestra NON ha funzionato, non quelli in cui
   l'utente ha scelto di annullare. Una finestra che si chiude da sola
   in meno di due secondi non è una scelta di nessuno: nessuno fa in
   tempo a leggere, figurarsi a scegliere un account. È il guasto
   segnalato più volte ("si apre, non carica e si chiude", "alla prima
   volta non fa niente, alla seconda va"): la finestra dipende da troppe
   cose fuori dal nostro controllo — blocchi popup, estensioni, il
   collegamento con Google non ancora pronto al primo click. */
function ripiegoNecessario(err, durataMs) {
  const c = err?.code;
  if (c === "auth/popup-blocked") return true;
  if (c === "auth/cancelled-popup-request") return true;
  if (c === "auth/internal-error") return true;
  if (c === "auth/popup-closed-by-user") return durataMs < 2000;
  return false;
}

const IG_POPUP_LS_KEY = "netflaxt_ig_popup_dismissed";
const IG_URL = "https://www.instagram.com/netflaxt";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verifiedScreen, setVerifiedScreen] = useState(false);
  // Accesso sospeso: dispositivo in attesa di conferma via email
  const [attesaDispositivo, setAttesaDispositivo] = useState(null);
  // ✨ FIX FASE 3.5 — gestione email non verificata al login
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Popup Instagram
  const [igPopupVisible, setIgPopupVisible] = useState(false);
  const [igPopupClosing, setIgPopupClosing] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setSEO({
      title: mode === "register" ? "Registrati" : "Accedi",
      description:
        "Entra in Netflaxt News: chat live, pronostici e quiz per i tifosi della Lazio.",
      type: "website",
    });
    return () => resetSEO();
  }, [mode]);

  /* Prepara il terreno per l'accesso con Google.

     Appena la pagina si apre, il "custode" che fa funzionare il sito
     offline si sta ancora avviando: una finestra di Google aperta
     proprio in quell'istante ha più probabilità di non funzionare.
     Non è una garanzia — se fallisce comunque c'è il ripiego a pagina
     intera — ma riduce le volte in cui serve ricorrervi.

     L'attesa va fatta QUI, mentre l'utente legge la pagina, e non al
     momento del click: i browser aprono una finestra solo se il click è
     appena avvenuto, e un'attesa in mezzo la farebbe chiudere subito. */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.catch(() => {});
  }, []);

  // ✨ Gestione ritorno dal link di conferma email (Google flow).
  // Quando l'utente clicca il link nell'email arriva qui con
  // ?emailConfirmed=true&email=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("emailConfirmed") === "true") {
        const confirmedEmail = params.get("email");
        if (confirmedEmail) {
          localStorage.setItem(EMAIL_CONFIRMED_LS_KEY, confirmedEmail);
        }
        setSuccess(
          "Email confermata! Accedi di nuovo con Google per entrare nel sito."
        );
        // Pulisce la URL così non resta sporca
        window.history.replaceState({}, "", "/login");
      }
    } catch (e) {
      /* localStorage o URL non disponibili */
    }
  }, []);

  // Mostra popup IG dopo 3 secondi (se non già dismissed)
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(IG_POPUP_LS_KEY) === "1";
    } catch (e) {
      /* localStorage non disponibile */
    }
    if (dismissed) return;
    const t = setTimeout(() => setIgPopupVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const closeIgPopup = () => {
    setIgPopupClosing(true);
    setTimeout(() => {
      setIgPopupVisible(false);
      setIgPopupClosing(false);
      try {
        localStorage.setItem(IG_POPUP_LS_KEY, "1");
      } catch (e) {
        /* localStorage non disponibile */
      }
    }, 320);
  };

  const isRegister = mode === "register";

  const switchMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setError("");
    setSuccess("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  const passwordTooShort = password.length > 0 && password.length < 6;
  const passwordsMatch =
    isRegister &&
    password.length >= 6 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;
  const passwordsMismatch =
    isRegister && confirmPassword.length > 0 && password !== confirmPassword;

  const mapFirebaseError = (err) => {
    // Senza questa riga un errore inatteso diventa un generico "Riprova"
    // e non resta traccia di cosa sia andato storto: impossibile capirlo
    // a distanza quando un tifoso segnala "non riesco ad accedere".
    console.error("Accesso non riuscito:", err?.code, err?.message);

    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      return "Email o password non corretti. Riprova o usa 'Password dimenticata?'.";
    }
    if (err.code === "auth/user-not-found") return "Nessun account trovato con questa email.";
    if (err.code === "auth/email-already-in-use") return "Esiste già un account con questa email.";
    if (err.code === "auth/invalid-email") return "Email non valida.";
    if (err.code === "auth/weak-password") return "Password troppo debole (minimo 6 caratteri).";
    if (err.code === "auth/too-many-requests") return "Troppi tentativi. Attendi qualche minuto.";
    if (err.code === "auth/popup-closed-by-user") return "Accesso Google annullato.";
    if (err.code === "auth/cancelled-popup-request") return "Accesso Google annullato.";
    if (err.code === "auth/popup-blocked") {
      return "Il browser ha bloccato la finestra di Google. Consenti i popup per questo sito e riprova.";
    }
    if (err.code === "auth/unauthorized-domain") {
      // Capita dopo un cambio di indirizzo del sito: l'indirizzo va
      // autorizzato in Firebase (Authentication → Impostazioni → Domini).
      return "Accesso Google non disponibile da questo indirizzo. Avvisa l'amministratore del sito.";
    }
    if (err.code === "auth/network-request-failed") {
      return "Connessione assente o instabile. Controlla la rete e riprova.";
    }
    if (err.code === "auth/operation-not-allowed") {
      return "L'accesso con Google non è attivo. Avvisa l'amministratore del sito.";
    }
    return "Errore. Riprova.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUnverifiedEmail(null);

    if (isRegister) {
      if (!name.trim()) return setError("Inserisci il tuo nome.");
      if (passwordTooShort) return setError("La password deve avere almeno 6 caratteri.");
      if (passwordsMismatch) return setError("Le due password non coincidono.");
    }

    setLoading(true);
    try {
      if (isRegister) {
        // ✨ FIX FASE 3.5 — Registrazione:
        // 1. Crea account
        // 2. Aggiorna profilo + manda email verifica
        // 3. LOGOUT immediato (così l'utente NON entra finché non verifica)
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setVerifiedScreen(true);
      } else {
        // ✨ FIX FASE 3.5 — Login:
        // 1. Tenta login
        // 2. Se email NON verificata → logout + mostra schermata "verifica prima"
        // 3. Se verificata → entra
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          await signOut(auth);
          setUnverifiedEmail(email);
          setError(
            "L'email non è ancora verificata. Controlla la tua casella di posta (anche SPAM) e clicca il link che ti abbiamo mandato."
          );
          return;
        }
        // Dispositivo mai visto? L'accesso resta sospeso finché non
        // viene confermato dall'email dell'account.
        const controllo = await verificaDispositivo(cred.user);
        if (controllo.esito === "attesa") {
          const credenziali = { email, password };
          await signOut(auth);
          setAttesaDispositivo({
            uid: cred.user.uid,
            email: cred.user.email,
            // Rientro automatico appena arriva la conferma: le
            // credenziali restano solo in memoria, per il tempo
            // dell-attesa, e non vengono mai salvate da nessuna parte.
            rientra: () =>
              signInWithEmailAndPassword(auth, credenziali.email, credenziali.password),
          });
          return;
        }
        navigate("/");
      }
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ✨ FIX FASE 3.5 — Reinvia email di verifica
  const handleResendVerification = async () => {
    if (!unverifiedEmail || !password) {
      setError("Inserisci di nuovo email e password per reinviare l'email di verifica.");
      return;
    }
    setResending(true);
    setError("");
    try {
      // Per mandare di nuovo l'email, dobbiamo prima rifare il login temporaneo
      const cred = await signInWithEmailAndPassword(auth, unverifiedEmail, password);
      if (cred.user.emailVerified) {
        // Nel frattempo l'utente l'ha verificata!
        navigate("/");
        return;
      }
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setSuccess(
        "Email di verifica reinviata! Controlla la tua casella di posta (anche SPAM)."
      );
      setUnverifiedEmail(null);
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setResending(false);
    }
  };

  /* Avvia l'accesso con Google.

     Prova prima con la finestra di Google, più comoda perché non fa
     perdere la pagina. Se la finestra non funziona si ripiega
     sull'accesso a pagina intera: è più lento, ma nessun browser lo
     blocca, quindi l'accesso riesce comunque invece di fallire e
     costringere a riprovare.
     Restituisce le credenziali, oppure null se si sta uscendo dalla
     pagina per andare su Google (in quel caso si prosegue al ritorno). */
  const avviaAccessoGoogle = async () => {
    const apertoIl = Date.now();
    try {
      /* ⚠️ NON mettere attese prima di questa riga.
         I browser aprono una finestra solo se il click dell'utente è
         appena avvenuto: qualsiasi attesa qui in mezzo fa "scadere" il
         click e la finestra viene chiusa subito dopo essersi aperta
         (provato il 24/08/2026: così l'accesso smetteva del tutto di
         funzionare). */
      return await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (!ripiegoNecessario(err, Date.now() - apertoIl)) throw err;
      console.warn("Finestra Google non utilizzabile, passo alla pagina intera:", err?.code);
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
  };

  /* Cosa succede DOPO che Google ci ha riconosciuti.
     Sta in una funzione a parte perché ci si arriva da due strade: la
     finestra di Google e il ritorno dall'accesso a pagina intera. */
  const completaAccessoGoogle = async (cred) => {
    const userRef = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;

      // Utente esistente e già confermato → entra subito
      if (userData && userData.requireEmailConfirm !== true) {
        const controllo = await verificaDispositivo(cred.user);
        if (controllo.esito === "attesa") {
          await signOut(auth);
          setAttesaDispositivo({
            uid: cred.user.uid,
            email: cred.user.email,
            // Con Google non abbiamo credenziali da riusare: il rientro
            // richiede un click, perche il browser blocca le finestre
            // di accesso aperte senza un gesto dell-utente.
            conGoogle: true,
            rientra: avviaAccessoGoogle,
          });
          return;
        }
        navigate("/");
        return;
      }

      // Controlla se l'utente ha appena cliccato il link di conferma
      // in questo browser (vedi useEffect sopra).
      let confirmedEmail = null;
      try {
        confirmedEmail = localStorage.getItem(EMAIL_CONFIRMED_LS_KEY);
      } catch (e) {
        /* localStorage non disponibile */
      }

      if (confirmedEmail && confirmedEmail === cred.user.email) {
        // Ha cliccato il link → marca come confermato e fa entrare
        await setDoc(
          userRef,
          {
            displayName: cred.user.displayName || "",
            photoURL: cred.user.photoURL || null,
            requireEmailConfirm: false,
            emailConfirmedAt: serverTimestamp(),
          },
          { merge: true }
        );
        try {
          localStorage.removeItem(EMAIL_CONFIRMED_LS_KEY);
        } catch (e) {
          /* localStorage non disponibile */
        }
        navigate("/");
        return;
      }

      // Nuovo utente Google o non ancora confermato → invia email + signOut
      await setDoc(
        userRef,
        {
          displayName: cred.user.displayName || "",
          photoURL: cred.user.photoURL || null,
          requireEmailConfirm: true,
          emailConfirmSentAt: serverTimestamp(),
        },
        { merge: true }
      );

      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/login?emailConfirmed=true&email=${encodeURIComponent(
          cred.user.email
        )}`,
      });

      await signOut(auth);
      setVerifiedScreen(true);
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);

    /* Se Google non torna indietro (finestra chiusa a metà, rete che
       cade), il pulsante resterebbe a caricare all'infinito senza
       spiegazioni. Dopo un minuto lo sblocchiamo dicendo cosa fare. */
    const sbloccoDiSicurezza = setTimeout(() => {
      setLoading(false);
      setError(
        "Google non ha risposto. Riprova, oppure accedi con email e password."
      );
    }, 60000);

    try {
      const cred = await avviaAccessoGoogle();
      if (!cred) return; // si sta passando alla pagina di Google
      await completaAccessoGoogle(cred);
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      clearTimeout(sbloccoDiSicurezza);
      setLoading(false);
    }
  };

  /* Ritorno dall'accesso a pagina intera.

     Quando si ripiega su quella strada il sito viene lasciato e poi
     riaperto da Google: senza questo controllo l'utente tornerebbe alla
     schermata di accesso come se non fosse successo nulla, pur essendo
     ormai riconosciuto. Qui riprendiamo esattamente da dove eravamo. */
  useEffect(() => {
    let abbandonato = false;
    (async () => {
      let cred;
      try {
        cred = await getRedirectResult(auth);
      } catch (err) {
        if (!abbandonato) setError(mapFirebaseError(err));
        return;
      }
      if (!cred || abbandonato) return; // arrivo normale, non da Google
      setLoading(true);
      try {
        await completaAccessoGoogle(cred);
      } catch (err) {
        if (!abbandonato) setError(mapFirebaseError(err));
      } finally {
        if (!abbandonato) setLoading(false);
      }
    })();
    return () => {
      abbandonato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email) {
      setError("Inserisci la tua email nel campo sopra prima di cliccare 'Password dimenticata?'.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Email inviata! Controlla la tua casella di posta e clicca il link per reimpostare la password. Controlla anche la cartella SPAM se non la vedi nella principale.");
    } catch (err) {
      setError(mapFirebaseError(err));
    }
  };

  // Schermata di conferma dopo registrazione
  // Accesso sospeso: si entra solo dopo aver aperto il link ricevuto
  // via email. La schermata controlla da sola quando è stato fatto, così
  // non c'è bisogno di accedere di nuovo a mano.
  if (attesaDispositivo) {
    return (
      <AttesaConferma
        dati={attesaDispositivo}
        onEntrato={() => {
          setAttesaDispositivo(null);
          navigate("/");
        }}
        onFallito={(messaggio) => {
          setAttesaDispositivo(null);
          setSuccess("Dispositivo confermato! Accedi pure.");
          if (messaggio) setError(messaggio);
        }}
      />
    );
  }

  if (verifiedScreen) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-bg-base text-text-primary flex items-center justify-center px-6 relative overflow-hidden">
        {/* Glow di sfondo */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/12 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-deep/8 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-md w-full text-center">
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-success/15 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 rounded-full bg-success/10 border-2 border-success/40 flex items-center justify-center">
              <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="text-[11px] uppercase tracking-[0.3em] text-accent font-bold mb-3">
            Benvenuto in curva
          </div>
          <h1 className="text-5xl mb-4" style={{ fontFamily: "var(--font-display)" }}>
            ACCOUNT CREATO!
          </h1>
          <p className="text-text-secondary mb-3 leading-relaxed">
            Ti abbiamo inviato un'email di verifica.
          </p>
          <p className="text-text-secondary mb-8 leading-relaxed text-sm">
            Controlla la tua casella (anche la cartella <span className="text-text-primary font-semibold">SPAM</span>) e clicca il link per attivare l'account.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setVerifiedScreen(false);
                setMode("login");
                setPassword("");
                setConfirmPassword("");
              }}
              className="group relative px-6 py-3 bg-accent text-text-inverse font-bold rounded-md overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5"
            >
              <span className="relative z-10 inline-flex items-center gap-2">
                Vai al login
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
            </button>
            <a
              href={IG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-md border border-border hover:border-accent/50 hover:bg-accent/5 text-text-primary font-semibold transition-all duration-300 inline-flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              Seguimi su Instagram
            </a>
          </div>

          <p className="mt-8 text-[11px] text-text-muted">
            Non ricevi l'email? Controlla lo SPAM o riprova tra qualche minuto.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-bg-base text-text-primary grid lg:grid-cols-12 overflow-hidden relative">

      {/* ═══════════════════ LATO SX — FORM ═══════════════════ */}
      <section className="lg:col-span-6 xl:col-span-5 relative flex items-center justify-center px-6 sm:px-12 py-12 order-2 lg:order-1">

        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]" />
        </div>

        <div
          className={`w-full max-w-md transition-all duration-700 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <Link to="/" className="inline-flex items-center gap-3 mb-10 group">
            <div className="relative">
              <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-bg-elevated to-bg-surface flex items-center justify-center ring-1 ring-accent/30 shadow-[0_0_24px_-6px_rgba(56,189,248,0.5)] group-hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.8)] group-hover:ring-accent/60 group-hover:scale-105 transition-all duration-300 overflow-hidden">
                <img src="/logo.png" alt="Netflaxt News" className="h-8 w-8 object-contain" draggable="false" />
              </div>
            </div>
            <div>
              <div
                className="text-2xl text-text-primary tracking-wide"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
              >
                NETFLAXT <span className="text-accent">NEWS</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-text-muted mt-0.5">
                Fan site · Biancoceleste
              </div>
            </div>
          </Link>

          <div className="relative rounded-2xl border border-border bg-bg-surface/60 backdrop-blur-sm p-7 sm:p-8 shadow-[0_0_40px_-12px_rgba(56,189,248,0.15)]">

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-base/60 border border-border">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-secondary">
                {isRegister ? "Nuovo account" : "Bentornato"}
              </span>
            </div>

            <h1
              className="mt-5 text-4xl sm:text-5xl text-text-primary leading-[0.95]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.005em" }}
            >
              {isRegister ? (
                <>UNISCITI ALLA <span className="text-gradient-accent">CURVA.</span></>
              ) : (
                <>BENTORNATO <span className="text-gradient-accent">IN CURVA.</span></>
              )}
            </h1>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {isRegister
                ? "Crea il tuo account in dieci secondi e accedi a tutto."
                : "Accedi al tuo account e riprendi da dove avevi lasciato."}
            </p>

            <div className="relative inline-flex w-full mt-7 p-1 rounded-lg bg-bg-base/60 border border-border">
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md bg-accent/10 border border-accent/30 shadow-[0_0_20px_-6px_rgba(56,189,248,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ transform: isRegister ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
              />
              {[
                { key: "login", label: "Accedi" },
                { key: "register", label: "Registrati" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchMode(t.key)}
                  className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-md transition-colors duration-300 ${
                    mode === t.key ? "text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {error && (
              <div
                className="mt-5 p-3 rounded-md bg-error/10 border border-error/30 text-error text-sm"
                style={{ animation: "slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
              >
                {error}
                {/* ✨ FIX FASE 3.5 — bottone "Reinvia email" quando l'email non è verificata */}
                {unverifiedEmail && (
                  <div className="mt-3 pt-3 border-t border-error/20 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      Non hai ricevuto l'email?
                    </span>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
                    >
                      {resending ? (
                        <>
                          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Invio in corso...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                            />
                          </svg>
                          Reinvia email di verifica
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {success && (
              <div
                className="mt-5 p-3 rounded-md bg-success/10 border border-success/30 text-success text-sm"
                style={{ animation: "slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
              >
                {success}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
              key={mode}
              style={{ animation: "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both" }}
            >
              {isRegister && (
                <Field label="Nome">
                  <Input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Come ti chiami?"
                    required
                  />
                </Field>
              )}

              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tuonome@esempio.it"
                  required
                />
              </Field>

              <Field
                label="Password"
                right={
                  !isRegister ? (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] font-semibold uppercase tracking-wider text-text-muted hover:text-accent transition-colors"
                    >
                      Password dimenticata?
                    </button>
                  ) : null
                }
              >
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? "Minimo 6 caratteri" : "••••••••"}
                    className="pr-12"
                    required
                  />
                  <EyeBtn shown={showPassword} onClick={() => setShowPassword((v) => !v)} />
                </div>
                {isRegister && passwordTooShort && (
                  <p className="mt-1.5 text-[11px] text-warning">
                    La password deve essere di almeno 6 caratteri.
                  </p>
                )}
              </Field>

              {isRegister && (
                <Field
                  label="Conferma password"
                  right={
                    passwordsMatch ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Coincidono
                      </span>
                    ) : null
                  }
                >
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ripeti la password"
                      className={`pr-12 ${
                        passwordsMismatch ? "border-error/50 focus:border-error" : ""
                      }`}
                      required
                    />
                    <EyeBtn shown={showConfirm} onClick={() => setShowConfirm((v) => !v)} />
                  </div>
                  {passwordsMismatch && (
                    <p className="mt-1.5 text-[11px] text-error">
                      Le due password non coincidono.
                    </p>
                  )}
                </Field>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full mt-2 py-3.5 rounded-md font-bold text-text-inverse bg-accent overflow-hidden transition-all duration-300 hover:shadow-[0_0_32px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-text-inverse border-t-transparent rounded-full animate-spin" />
                      Attendere...
                    </>
                  ) : (
                    <>
                      {isRegister ? "Crea account" : "Accedi"}
                      <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-accent via-accent-hover to-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-bg-surface/60 backdrop-blur-sm text-[10px] uppercase tracking-[0.3em] text-text-muted">
                    oppure
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="group w-full py-3 rounded-md border border-border hover:border-border-strong hover:bg-bg-elevated text-text-primary font-semibold transition-all duration-300 flex items-center justify-center gap-3 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <GoogleIcon className="w-5 h-5" />
                <span>Continua con Google</span>
              </button>
            </form>

            {isRegister && (
              <p className="mt-6 text-[11px] text-text-muted leading-relaxed text-center">
                Registrandoti accetti le condizioni di Netflaxt News.
                <br />
                Nessuno spam, mai. Promessa da tifoso.
              </p>
            )}
          </div>

          <p className="mt-8 text-center text-sm text-text-secondary">
            {isRegister ? "Hai già un account?" : "Non hai un account?"}{" "}
            <button
              onClick={() => switchMode(isRegister ? "login" : "register")}
              className="text-accent hover:text-accent-hover font-semibold transition-colors"
            >
              {isRegister ? "Accedi →" : "Registrati →"}
            </button>
          </p>
        </div>
      </section>

      {/* ═══════════════════ LATO DX — VISUAL (CURVA) ═══════════════════ */}
      <section className="lg:col-span-6 xl:col-span-7 relative overflow-hidden order-1 lg:order-2 min-h-[300px] lg:min-h-[calc(100vh-4rem)] border-b lg:border-b-0 lg:border-l border-border-subtle">

        <div className="absolute inset-0">
          <img
            src="/login-curva.jpg"
            alt="Curva Nord biancoceleste"
            className={`w-full h-full object-cover transition-all duration-[2000ms] ease-out ${
              mounted ? "opacity-60 scale-100" : "opacity-0 scale-110"
            }`}
          />
          {/* Overlay scuro per leggibilità */}
          <div className="absolute inset-0 bg-gradient-to-br from-bg-base/85 via-bg-base/55 to-bg-base/90" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent" />

          {/* Glow */}
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[140px]" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-accent-deep/10 rounded-full blur-[120px]" />

          {/* Grid sottilissima */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
            }}
          />
        </div>

        <div
          className={`relative h-full flex flex-col justify-center p-8 sm:p-12 lg:p-20 transition-all duration-1000 delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full bg-bg-surface/60 backdrop-blur-sm border border-border">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-text-secondary">
              Fan site indipendente
            </span>
          </div>

          <h2
            className="mt-7 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl leading-[0.92] text-text-primary text-balance"
            style={{ fontFamily: "var(--font-display)" }}
          >
            UNA <span className="text-gradient-accent">PASSIONE</span> <br />
            CHE NON MUORE <br />
            MAI!
          </h2>

          <p className="mt-7 text-lg lg:text-xl text-text-secondary leading-relaxed max-w-lg text-pretty">
            Migliaia di tifosi connessi 24/7. News, pronostici, chat live — tutto
            in un unico posto, fatto da chi la vive ogni domenica.
          </p>
        </div>
      </section>

      {/* ═══════════════════ POPUP INSTAGRAM ═══════════════════ */}
      {igPopupVisible && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-[340px] sm:max-w-[380px] ${
            igPopupClosing ? "ig-popup-out" : "ig-popup-in"
          }`}
          role="dialog"
          aria-label="Seguimi su Instagram"
        >
          <div className="relative rounded-2xl overflow-hidden border border-accent/40 bg-bg-surface shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6),0_0_40px_-10px_rgba(56,189,248,0.4)]">
            {/* Pulsante chiusura */}
            <button
              type="button"
              onClick={closeIgPopup}
              aria-label="Chiudi popup"
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-bg-base/80 backdrop-blur-sm border border-border hover:border-accent/60 hover:bg-accent/10 text-text-secondary hover:text-text-primary flex items-center justify-center transition-all duration-200 shadow-lg"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Contenuto popup */}
            <div className="p-4 pr-10">
              <div className="flex items-center gap-3">
                <span className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 flex items-center justify-center text-white shadow-lg">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-text-primary leading-tight">
                    Seguimi su Instagram
                  </div>
                  <a
                    href={IG_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    @netflaxt
                  </a>
                </div>
              </div>

              <p className="mt-3 text-[12px] text-text-secondary leading-snug">
                Seguimi su Instagram per non perderti nulla!
              </p>

              <a
                href={IG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold transition-all duration-300 hover:shadow-[0_0_20px_-4px_rgba(56,189,248,0.7)] hover:-translate-y-0.5"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                Seguimi
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Animazioni popup IG */}
      <style>{`
        @keyframes ig-popup-in {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes ig-popup-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
        }
        .ig-popup-in {
          animation: ig-popup-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ig-popup-out {
          animation: ig-popup-out 0.32s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

function Field({ label, right, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 bg-bg-base/60 border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 focus:bg-bg-base transition-all duration-200 ${className}`}
    />
  );
}

function EyeBtn({ shown, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-label={shown ? "Nascondi password" : "Mostra password"}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-accent transition-colors rounded"
    >
      {shown ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </button>
  );
}

function GoogleIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z"/>
      <path fill="#34A853" d="M12 21.6c2.7 0 5-.9 6.6-2.4l-3.2-2.4c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.5C4.7 19.4 8.1 21.6 12 21.6z"/>
      <path fill="#FBBC05" d="M6.4 13.7c-.2-.6-.3-1.2-.3-1.7 0-.6.1-1.2.3-1.7V7.8H3.1C2.4 9.1 2 10.5 2 12s.4 2.9 1.1 4.2l3.3-2.5z"/>
      <path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.3 14.7 2.4 12 2.4 8.1 2.4 4.7 4.6 3.1 7.8l3.3 2.5C7.2 7.9 9.4 6.2 12 6.2z"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Schermata mostrata quando si accede da un dispositivo mai visto.

   Controlla da sola, ogni pochi secondi, se il link nell'email è stato
   aperto: quando succede sblocca senza che l'utente debba accorgersene
   o rifare l'accesso. Il pulsante "Rimanda" copre il caso più comune,
   cioè l'email finita nello spam o mai arrivata.
   ───────────────────────────────────────────────────────────── */
function AttesaConferma({ dati, onEntrato, onFallito }) {
  const [rinvio, setRinvio] = useState('fermo'); // fermo | corso | fatto | errore
  const [confermato, setConfermato] = useState(false);
  const [entrando, setEntrando] = useState(false);

  // Controlla ogni pochi secondi se il link nell'email e stato aperto.
  useEffect(() => {
    let vivo = true;
    const t = setInterval(async () => {
      const ok = await dispositivoApprovato(dati.uid);
      if (!ok || !vivo) return;
      clearInterval(t);
      setConfermato(true);

      // Con email e password rientriamo da soli: l'utente non deve
      // ridigitare nulla ne accorgersi del passaggio.
      if (dati.rientra && !dati.conGoogle) {
        setEntrando(true);
        try {
          await dati.rientra();
          if (vivo) onEntrato();
        } catch (e) {
          if (vivo) onFallito(e?.message ? null : null);
        }
      }
    }, 3000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [dati, onEntrato, onFallito]);

  const entraConGoogle = async () => {
    setEntrando(true);
    try {
      await dati.rientra();
      onEntrato();
    } catch {
      onFallito(null);
    } finally {
      setEntrando(false);
    }
  };

  const rimanda = async () => {
    setRinvio('corso');
    const ok = await inviaEmailApprovazione(dati.uid);
    setRinvio(ok ? 'fatto' : 'errore');
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-bg-base text-text-primary flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/12 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-md text-center">
        <div
          className={`inline-flex w-14 h-14 rounded-xl items-center justify-center mb-5 border ${
            confermato
              ? "bg-success/10 border-success/30"
              : "bg-accent/10 border-accent/30"
          }`}
        >
          <ShieldIcon
            className={`w-6 h-6 ${confermato ? "text-success" : "text-accent"}`}
          />
        </div>

        {confermato ? (
          <>
            <h1 className="text-4xl sm:text-5xl text-text-primary leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              ACCESSO CONFERMATO
            </h1>
            <p className="mt-4 text-text-secondary text-sm">
              {dati.conGoogle
                ? 'Il dispositivo e stato autorizzato: entra pure.'
                : entrando
                ? 'Ti sto facendo entrare…'
                : 'Un attimo…'}
            </p>
            {dati.conGoogle && (
              <button
                onClick={entraConGoogle}
                disabled={entrando}
                className="mt-7 px-6 py-3 rounded-md bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-hover transition disabled:opacity-60"
              >
                {entrando ? 'Attendere…' : 'Entra ora'}
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-4xl sm:text-5xl text-text-primary leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              CONFERMA L'ACCESSO
            </h1>
            <p className="mt-4 text-text-secondary text-sm leading-relaxed">
              Stai entrando da un dispositivo che non abbiamo mai visto. Per
              sicurezza ti abbiamo mandato un'email a{' '}
              <strong className="text-text-primary">{dati.email}</strong>: aprila e
              clicca il pulsante di conferma.
            </p>

            <div className="mt-6 p-3 rounded-lg bg-bg-elevated border border-border text-xs text-text-muted">
              Questa pagina si sblocca da sola appena confermi. Puoi lasciarla
              aperta.
            </div>

            <div className="mt-6">
              {rinvio === 'fatto' ? (
                <p className="text-xs text-success font-semibold">
                  Email rimandata. Controlla anche nello spam.
                </p>
              ) : (
                <button
                  onClick={rimanda}
                  disabled={rinvio === 'corso'}
                  className="px-5 py-2.5 rounded-md bg-bg-elevated border border-border text-text-primary text-xs font-bold uppercase tracking-wider hover:border-accent/40 transition disabled:opacity-60"
                >
                  {rinvio === 'corso' ? 'Invio…' : 'Non e arrivata? Rimanda'}
                </button>
              )}
              {rinvio === 'errore' && (
                <p className="mt-2 text-xs text-error">
                  Invio non riuscito. Riprova fra poco.
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-8">
          <Link to="/" className="text-xs uppercase tracking-wider text-text-muted hover:text-accent transition">
            Torna alla home
          </Link>
        </div>
      </div>
    </main>
  );
}
