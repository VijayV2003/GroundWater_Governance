import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDun727LYqluLubppwFnbTPnGmrIR4P7qg",
  authDomain: "groundwater-46059.firebaseapp.com",
  projectId: "groundwater-46059",
  storageBucket: "groundwater-46059.firebasestorage.app",
  messagingSenderId: "1021777220471",
  appId: "1:1021777220471:web:6a4601030a3ff517a50772",
  measurementId: "G-1R9STF54CB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics if supported
export let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});
