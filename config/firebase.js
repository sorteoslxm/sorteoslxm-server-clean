// config/firebase.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

// ✅ Usa la variable del entorno (Render → Environment → FIREBASE_SERVICE_ACCOUNT_KEY)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

initializeApp({
  credential: cert(serviceAccount),
});

export const db = getFirestore();
