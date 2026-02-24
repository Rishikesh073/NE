// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyAnxfR5DRsF4Zo_EGot4qy57VtepcH_emE",
  authDomain: "nexus-61dcb.firebaseapp.com",
  projectId: "nexus-61dcb",
  storageBucket: "nexus-61dcb.appspot.com",
  messagingSenderId: "106829693223",
  appId: "1:106829693223:web:e532b90041cbc0e9e52902"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize & Export Core Services
export const auth = getAuth(app);
export const db = getFirestore(app);


// Setup & Export Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup, signOut };