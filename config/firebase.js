// config/firebase.js
import admin from "firebase-admin";

let serviceAccount = null;

// Intentamos leer el JSON completo desde FIREBASE_SERVICE_ACCOUNT
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("✅ Firebase: SERVICE_ACCOUNT cargado desde variable de entorno");
  } catch (error) {
    console.error("❌ Error al parsear FIREBASE_SERVICE_ACCOUNT:", error);
  }
}

if (!serviceAccount) {
  throw new Error("❌ No se pudo cargar FIREBASE_SERVICE_ACCOUNT. Verifica Render.");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // ej: sorteoslxm.appspot.com
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export const auth = admin.auth();

export default admin;
