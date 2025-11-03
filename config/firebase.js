// config/firebase.js
import admin from "firebase-admin";

// 🔥 Verificamos que la variable exista
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountString) {
  console.error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY en el entorno");
  process.exit(1);
}

let serviceAccount;

try {
  // Si Render guarda el JSON como string plano, lo parseamos
  serviceAccount = JSON.parse(serviceAccountString);
} catch (error) {
  console.error("❌ Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:", error);
  process.exit(1);
}

// Inicializa Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("🔥 Firebase conectado correctamente");
}

export const db = admin.firestore();
