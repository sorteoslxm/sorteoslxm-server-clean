// config/firebase.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export default admin;
