import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDxEskCC29f_1i_kGSxS1SpCAAoQ84-wvw",
  /* Deve essere il NOSTRO indirizzo, non quello tecnico di Firebase.

     L'accesso con Google si appoggia a una pagina di servizio che, se
     ospitata altrove, per il browser è "un altro sito": i browser
     recenti bloccano i dati salvati dai siti terzi, e quel blocco fa
     fallire l'accesso in modo capriccioso — la finestra si apre, non
     conclude e si chiude, e magari al secondo tentativo va (segnalato
     più volte, agosto 2026). Servendo quella pagina dal nostro stesso
     indirizzo il problema non si pone.
     Nota: `netflaxt.it` deve restare fra i domini autorizzati in
     Firebase (Authentication → Impostazioni → Domini autorizzati). */
  authDomain: "netflaxt.it",
  projectId: "netflaxt-news",
  storageBucket: "netflaxt-news.firebasestorage.app",
  messagingSenderId: "180313929316",
  appId: "1:180313929316:web:84ce5584a616e221585171",
  databaseURL: "https://netflaxt-news-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export default app;