// FILE: scripts/aprobar-pendientes.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!firebaseServiceAccount) {
  throw new Error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT en las variables de entorno");
}

const serviceAccount = JSON.parse(firebaseServiceAccount);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function aprobarPendientes() {
  const snap = await db.collection("compras").where("status", "==", "pendiente").get();

  if (snap.empty) {
    console.log("✅ No hay pagos pendientes");
    return;
  }

  console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}`);

  for (const doc of snap.docs) {
    const data = doc.data();

    await doc.ref.update({
      status: "approved",
      mpStatus: "approved",
      recovered: true,
      reprocessedAt: new Date().toISOString(),
    });

    // ⚡ Crear chance si corresponde
    await db.collection("chances").add({
      sorteoId: data.sorteoId,
      compraId: doc.id,
      cantidad: data.cantidad || 1,
      mpStatus: "approved",
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ Pago aprobado y chance creado: ${doc.id}`);
  }
}

aprobarPendientes().catch((err) => console.error("❌ Error:", err.message));
