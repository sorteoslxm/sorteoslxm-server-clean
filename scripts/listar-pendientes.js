// FILE: scripts/listar-pendientes.js
import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";

const {
  FIREBASE_PRIVATE_KEY,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  ADMIN_TOKEN,
  SERVER_URL = "https://sorteoslxm-server-clean.onrender.com",
} = process.env;

// Inicializar Firebase
if (!admin.apps.length) {
  if (!FIREBASE_PRIVATE_KEY || !FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL) {
    throw new Error("❌ Falta configuración de Firebase en variables de entorno");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

async function listarPendientes() {
  try {
    const snap = await db
      .collection("compras")
      .where("mpStatus", "==", "pendiente")
      .get();

    if (snap.empty) {
      console.log("✅ No hay pagos pendientes");
      return;
    }

    console.log(`✅ Pagos pendientes: ${snap.docs.length}\n`);
    console.log("🔗 Links listos para reprocesar:\n");

    snap.docs.forEach((doc, i) => {
      const data = doc.data();
      const paymentId = data.mpPaymentId || "N/A";
      const merchantOrderId = data.merchant_order_id || "N/A";

      console.log(`${i + 1}. Compra ID: ${doc.id}`);
      console.log(`   Payment: ${SERVER_URL}/admin/reprocess-payment/${paymentId}?token=${ADMIN_TOKEN}`);
      console.log(`   Merchant Order: ${SERVER_URL}/admin/reprocess-merchant-order/${merchantOrderId}?token=${ADMIN_TOKEN}`);
      console.log("------------------------------------------------------");
    });
  } catch (err) {
    console.error("❌ Error listando pagos pendientes:", err.message);
  }
}

listarPendientes();
