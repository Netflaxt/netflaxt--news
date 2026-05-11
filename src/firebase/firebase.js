import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxEskCC29f_1i_kGSxS1SpCAAoQ84-wvw",
  authDomain: "netflaxt-news.firebaseapp.com",
  projectId: "netflaxt-news",
  storageBucket: "netflaxt-news.firebasestorage.app",
  messagingSenderId: "180313929316",
  appId: "1:180313929316:web:84ce5584a616e221585171"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;