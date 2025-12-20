// FILE: scripts/listar-pendientes.js
import { db } from "../config/firebase.js"; // 🔹 Ruta corregida
import dotenv from "dotenv";

dotenv.config();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const SERVER_URL = process.env.SERVER_URL || "https://sorteoslxm-server-clean.onrender.com";

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

    console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}\n`);

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const compraId = doc.id;
      const paymentId = data.mpPaymentId || "N/A";
      const merchantOrderId = data.merchant_order_id || "N/A";

      console.log(`Compra ID: ${compraId}`);
      console.log(`Sorteo ID: ${data.sorteoId}`);
      console.log(`Estado: ${data.mpStatus}`);
      console.log(`Payment ID: ${paymentId}`);
      console.log(`Merchant Order ID: ${merchantOrderId}`);
      console.log(`Cuenta MP: ${data.mpCuenta}`);
      console.log(`Link Reprocess Payment: ${SERVER_URL}/admin/reprocess-payment/${paymentId}?token=${ADMIN_TOKEN}`);
      console.log(`Link Reprocess Merchant Order: ${SERVER_URL}/admin/reprocess-merchant-order/${merchantOrderId}?token=${ADMIN_TOKEN}`);
      console.log("------------------------------------------------------");
    });
  } catch (err) {
    console.error("❌ Error listando pagos pendientes:", err.message);
  }
}

listarPendientes();
