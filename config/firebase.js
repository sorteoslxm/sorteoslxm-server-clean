import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  console.log("🔥 Firebase conectado correctamente");
} catch (error) {
  console.error("❌ No se pudo parsear FIREBASE_SERVICE_ACCOUNT_KEY", error);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();
export const auth = admin.auth();
