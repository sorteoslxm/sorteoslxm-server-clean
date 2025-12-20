// FILE: scripts/aprobar-pendientes.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

// 🔹 Inicializar Firebase usando variable de Render o localmente
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function aprobarPendientes() {
  try {
    // 🔹 Buscar compras pendientes
    const snap = await db.collection("compras").where("mpStatus", "==", "pendiente").get();

    if (snap.empty) {
      console.log("✅ No hay pagos pendientes");
      return;
    }

    console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}`);

    for (const doc of snap.docs) {
      const data = doc.data();

      // 🔹 Aprobar pago
      await doc.ref.update({
        status: "approved",
        mpStatus: "approved",
        recovered: true,
        reprocessedAt: new Date().toISOString(),
      });

      // 🔹 Crear chance correspondiente
      await db.collection("chances").add({
        sorteoId: data.sorteoId,
        compraId: doc.id,
        cantidad: data.cantidad || 1,
        mpStatus: "approved",
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Pago aprobado y chance creado: ${doc.id}`);
    }

    console.log("🎉 Todos los pagos pendientes fueron aprobados y las chances creadas.");
  } catch (err) {
    console.error("❌ Error aprobando pagos pendientes:", err.message);
  }
}

aprobarPendientes();
