// FILE: scripts/aprobar-pendientes.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// 🔐 Cargar SERVICE ACCOUNT desde variable de entorno o archivo local
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Busca un archivo local serviceAccount.json en scripts/
  const localPath = path.resolve("./scripts/serviceAccount.json");
  if (fs.existsSync(localPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(localPath, "utf-8"));
    console.log("ℹ️ Service account cargado desde archivo local");
  } else {
    throw new Error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT ni archivo local serviceAccount.json");
  }
}

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function aprobarPendientes() {
  try {
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
  } catch (err) {
    console.error("❌ Error aprobando pendientes:", err.message);
  }
}

aprobarPendientes();
