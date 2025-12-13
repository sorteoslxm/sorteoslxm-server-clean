// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// MP requiere RAW
router.use(express.raw({ type: "*/*" }));

function extractPaymentId(body) {
  if (body?.type === "payment" && body?.data?.id) {
    return body.data.id;
  }
  if (body?.topic === "payment" && !isNaN(body?.resource)) {
    return body.resource;
  }
  return null;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    // ===== LOCK anti-duplicado =====
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }
    await lockRef.set({ paymentId, processedAt: new Date() });

    // ===== Cliente MP =====
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    if (payment.status !== "approved") {
      console.log(`⏳ Pago no aprobado (${payment.status})`);
      return res.sendStatus(200);
    }

    const meta = payment.metadata || {};

    const sorteoId = meta.sorteoId;
    const compraId = meta.compraId;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;
    const mpCuenta = meta.mpCuenta || "1";

    if (!sorteoId || !compraId) {
      console.error("❌ ERROR: metadata incompleta", meta);
      return res.sendStatus(200);
    }

    // ===== Actualizar compra =====
    await db.collection("compras").doc(compraId).update({
      status: "pagado",
      updatedAt: new Date().toISOString(),
    });

    // ===== Crear chances =====
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

    console.log(`🎉 ${cantidad} chances creadas para sorteo ${sorteoId}`);
    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
