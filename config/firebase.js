// 📁 web/sorteoslxm-server-clean/config/firebase.js
import admin from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccount) {
  console.error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY en el entorno");
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no está configurada");
}

const parsedAccount =
  typeof serviceAccount === "string"
    ? JSON.parse(serviceAccount)
    : serviceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(parsedAccount),
  });
  console.log("✅ Firebase Admin inicializado correctamente");
}

export default admin;
