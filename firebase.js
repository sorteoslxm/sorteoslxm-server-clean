import admin from "firebase-admin";


let serviceAccount;

try {
  if (process.env.FIREBASE_CONFIG) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    console.log("🌍 Credenciales Firebase cargadas desde variable de entorno.");
  } else {
    throw new Error("No se encontraron credenciales Firebase en variable de entorno.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    });
  }

} catch (error) {
  console.error("❌ Error inicializando Firebase:", error);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export { db, bucket };

import dotenv from "dotenv";

dotenv.config();

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
export { db };
