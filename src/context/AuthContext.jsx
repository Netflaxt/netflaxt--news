/* ─────────────────────────────────────────────────────────────
   src/context/AuthContext.jsx
   FIX EMAIL VERIFICATION:
   Se l'utente è loggato MA non ha verificato l'email,
   viene fatto il logout automatico e trattato come non loggato.

   Anche gli utenti che si registrano con Google devono confermare
   l'email: la prima volta che fanno login con Google, in Login.jsx
   creiamo un doc Firestore users/{uid} con requireEmailConfirm=true,
   inviamo l'email di verifica, e li signOut. Solo al secondo login
   (dopo che hanno cliccato il link nell'email) vengono fatti entrare.
   Il gate vive in Login.jsx perché Firebase considera già verificata
   l'email dei provider OAuth: serve un flag custom in Firestore.
   ───────────────────────────────────────────────────────────── */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Splash from "../components/Splash";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Due sorgenti INDIPENDENTI:
  //  - authUser: utente grezzo da Firebase Auth
  //  - profileData: doc Firestore users/{uid} (fonte di verità per foto/nome)
  // L'oggetto `user` esposto è il MERGE dei due (via useMemo).
  // Questo elimina il bug del "?? " che ripescava la foto Google dopo
  // una rimozione, perché il merge usa esplicitamente il valore Firestore
  // (anche se è null = foto rimossa).
  const [authUser, setAuthUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // ✨ FIX FASE 3.5 — blocca accesso se email non verificata
      if (currentUser && !currentUser.emailVerified) {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn("Errore signOut auto:", e);
        }
        setAuthUser(null);
        setProfileData(null);
        setLoading(false);
        return;
      }

      setAuthUser(currentUser ? { ...currentUser } : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ✨ REAL-TIME: ascolta il doc Firestore dell'utente. Quando cambia
  // (foto, nome) l'avatar si aggiorna ovunque all'istante.
  useEffect(() => {
    if (!authUser?.uid) {
      setProfileData(null);
      return;
    }
    const ref = doc(db, "users", authUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => setProfileData(snap.exists() ? snap.data() : null),
      (err) => console.warn("Errore listener profilo:", err)
    );
    return () => unsub();
  }, [authUser?.uid]);

  // MERGE: authUser + overlay Firestore (photoURL + displayName).
  const user = useMemo(() => {
    if (!authUser) return null;
    const merged = { ...authUser };
    if (profileData) {
      // Se il doc ha il campo photoURL (anche null = rimossa) → usa quello.
      if ("photoURL" in profileData) {
        merged.photoURL = profileData.photoURL || null;
      }
      if (profileData.displayName) merged.displayName = profileData.displayName;
    }
    return merged;
  }, [authUser, profileData]);

  const logout = () => signOut(auth);

  // Ricarica i dati Auth (es. dopo cambio nome). photoURL/displayName
  // vengono comunque sovrascritti dal listener Firestore.
  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setAuthUser({ ...auth.currentUser });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {loading ? <Splash /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
