// 📁 web/sorteoslxm-server-clean/config/firebase.js
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// 🔐 Leer clave del env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// ✅ Inicializar Firebase solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
