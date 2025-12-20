// FILE: scripts/aprobar-pendientes-initpoint.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT en las variables de entorno");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function listarPendientes() {
  const snap = await db.collection("compras").where("status", "==", "pendiente").get();

  if (snap.empty) {
    console.log("✅ No hay pagos pendientes");
    return;
  }

  console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}\n`);

  snap.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`Compra ID: ${doc.id}`);
    console.log(`Sorteo ID: ${data.sorteoId}`);
    console.log(`Estado: ${data.status}`);
    console.log(`Telefono: ${data.telefono || "N/A"}`);
    console.log(`MP Init Point: ${data.mpInitPoint || "N/A"}`);
    console.log(
      `💡 Abrí este link en un navegador y completá el pago en sandbox o real`
    );
    console.log("------------------------------------------------------");
  });
}

listarPendientes().catch((err) => console.error("❌ Error:", err.message));
