// FILE: scripts/aprobar-pendientes.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

// 🔐 FIREBASE SERVICE ACCOUNT desde variable de entorno
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT en .env");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function aprobarPendientes() {
  try {
    // 🔎 Buscar pagos pendientes por mpStatus
    const snap = await db.collection("compras").where("mpStatus", "==", "pendiente").get();

    if (snap.empty) {
      console.log("✅ No hay pagos pendientes");
      return;
    }

    console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}\n`);

    for (const doc of snap.docs) {
      const data = doc.data();

      // 🔁 Actualizar estado del pago
      await doc.ref.update({
        mpStatus: "approved",
        status: "approved",
        recovered: true,
        reprocessedAt: new Date().toISOString(),
      });

      // ⚡ Crear chance correspondiente
      await db.collection("chances").add({
        sorteoId: data.sorteoId,
        compraId: doc.id,
        cantidad: data.cantidad || 1,
        mpStatus: "approved",
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Pago aprobado y chance creado: ${doc.id}`);
    }

    console.log("\n🎉 Todos los pagos pendientes fueron aprobados y las chances creadas.");
  } catch (err) {
    console.error("❌ Error aprobando pagos pendientes:", err.message);
  }
}

// Ejecutar script
aprobarPendientes();
