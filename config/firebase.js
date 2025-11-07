import admin from "firebase-admin";
import fs from "fs";

let serviceAccount;

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

if (serviceAccountEnv) {
  try {
    serviceAccount = JSON.parse(serviceAccountEnv);
    console.log("✅ FIREBASE_SERVICE_ACCOUNT cargada desde variable de entorno");
  } catch (error) {
    console.error("❌ Error parseando FIREBASE_SERVICE_ACCOUNT:", error);
  }
} else {
  console.warn("⚠️ No se encontró FIREBASE_SERVICE_ACCOUNT en entorno, intentando leer archivo local...");
  try {
    serviceAccount = JSON.parse(
      fs.readFileSync("./config/serviceAccountKey.json", "utf8")
    );
  } catch (error) {
    console.error("❌ No se encontró archivo serviceAccountKey.json:", error);
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth }; // 👈 ESTA LÍNEA es lo que faltaba
