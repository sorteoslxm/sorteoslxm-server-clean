// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// MercadoPago requiere RAW
router.use(express.raw({ type: "*/*" }));

// Unificar extracción de paymentId
function extractPaymentId(body) {
  if (body?.topic === "payment" && body?.resource && !isNaN(body.resource)) {
    return body.resource;
  }
  if (body?.type === "payment" && body?.data?.id) {
    return body.data.id;
  }
  return null;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    // 🔒 ANTI-DOBLE EJECUCIÓN
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }

    await lockRef.set({
      processedAt: new Date(),
      paymentId,
    });

    // --- SIEMPRE TOKEN 1 PARA LEER DATOS ---
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    // METADATA REAL
    const meta = payment.metadata || {};

    const sorteoId = meta.sorteoId || null;
    const compraId = meta.compraId || null;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;
    const mpCuenta = meta.mpCuenta || "1";

    if (!compraId) {
      console.error("❌ ERROR: metadata SIN compraId");
      return res.sendStatus(200);
    }

    // Actualizar compra
    const compraRef = db.collection("compras").doc(compraId);
    await compraRef.update({
      status: payment.status === "approved" ? "pagado" : "pendiente",
      updatedAt: new Date().toISOString(),
    });

    // Crear chances SOLO SI APROBADO
    if (payment.status === "approved") {
      for (let i = 0; i < cantidad; i++) {
        await db.collection("chances").add({
          sorteoId,
          compraId,
          telefono,
          createdAt: new Date().toISOString(),
          mpStatus: "approved",
          mpPaymentId: paymentId,
          mpCuenta,
        });
      }

      console.log(`🎉 ${cantidad} chances generadas para sorteo ${sorteoId}`);
    } else {
      console.log(`⚠ Pago recibido pero no aprobado (${payment.status})`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
