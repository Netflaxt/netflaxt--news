/* ─────────────────────────────────────────────────────────────
   src/hooks/useEnsureUserDoc.js
   Garantisce che esista un documento Firestore `users/{uid}`
   per ogni utente loggato. Aggiorna lastSeenAt ad ogni mount.

   USO:
     // in App.jsx, dentro AuthProvider:
     function AppShell() {
       const { user } = useAuth();
       useEnsureUserDoc(user);
       return <Routes>...</Routes>;
     }

   La collection `users/{uid}` è già usata dal moderationService;
   questo hook aggiunge i campi base (displayName, photoURL,
   createdAt, lastSeenAt) necessari per la pagina Admin → Utenti.
   L'indirizzo email sta invece in disparte, vedi utils/datiPrivati.js.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useRef } from "react";
import { db } from "../firebase/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  salvaIndirizzoAccount,
  migraStatoModerazione,
  migraDispositiviNotifiche,
} from "../utils/datiPrivati";
import { sincronizzaVoceClassifica } from "../utils/classifica";

export default function useEnsureUserDoc(user) {
  const lastSyncedUid = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    // Evita di riscrivere lo stesso uid più volte nello stesso mount
    if (lastSyncedUid.current === user.uid) return;
    lastSyncedUid.current = user.uid;

    (async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          // Primo accesso: crea il doc CON la foto iniziale (es. Google)
          // L'indirizzo email NON va qui: questo documento è pubblico.
          // Vedi salvaIndirizzoAccount più sotto.
          await setDoc(
            userRef,
            {
              uid: user.uid,
              displayName:
                user.displayName ||
                (user.email ? user.email.split("@")[0] : "Utente"),
              photoURL: user.photoURL || null,
              lastSeenAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          // Aggiorna SOLO i campi "tecnici". NON tocchiamo photoURL:
          // è gestita esplicitamente dal Profilo (upload/rimozione) ed è
          // la fonte di verità. Riscriverla qui re-aggiungerebbe la foto
          // Google dopo che l'utente l'ha rimossa ("torna da sola").
          await setDoc(
            userRef,
            {
              uid: user.uid,
              lastSeenAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        /* L'indirizzo va al riparo dalla lettura pubblica, e la voce di
           classifica si riallinea. Entrambe le cose ripuliscono da sole
           i profili creati prima di questa modifica, senza migrazioni
           da fare a mano. */
        await salvaIndirizzoAccount(user.uid, user.email);
        await migraStatoModerazione(user.uid);
        await migraDispositiviNotifiche(user.uid);
        await sincronizzaVoceClassifica(user.uid);
      } catch (e) {
        console.warn("useEnsureUserDoc error:", e);
      }
    })();
  }, [user?.uid, user?.email, user?.displayName, user?.photoURL]);
}
