import admin from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccount) {
  console.error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT_KEY en el entorno");
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no está configurada");
}

let parsedAccount;
try {
  parsedAccount =
    typeof serviceAccount === "string"
      ? JSON.parse(serviceAccount)
      : serviceAccount;
} catch (e) {
  console.error("❌ Error al parsear FIREBASE_SERVICE_ACCOUNT_KEY:", e);
  throw e;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(parsedAccount),
  });
  console.log("✅ Firebase Admin inicializado correctamente");
}

export default admin;
