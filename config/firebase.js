// config/firebase.js
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

let serviceAccount;

try {
  // ✅ Cargar las credenciales desde variable de entorno (Render)
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    serviceAccount = JSON.parse(serviceAccountEnv);
    console.log("✅ Clave de Firebase cargada desde variable de entorno");
  } else {
    // ✅ Fallback local (solo en tu Mac)
    serviceAccount = (await import("./serviceAccountKey.json", { assert: { type: "json" } })).default;
    console.log("✅ Clave de Firebase cargada desde archivo local");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("🔥 Firebase Admin inicializado correctamente");
} catch (error) {
  console.error("❌ Error inicializando Firebase Admin:", error);
}

export default admin;
