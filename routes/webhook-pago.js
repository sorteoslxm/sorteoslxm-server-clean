// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment, MerchantOrder } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();
router.use(express.raw({ type: "*/*" }));

function extractPaymentId(body) {
  if (body?.topic === "payment" && !isNaN(body?.resource)) {
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

    // ====== LOCK para evitar duplicados ======
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }
    await lockRef.set({ processedAt: new Date(), paymentId });

    // ====== CLIENTE MP TOKEN 1 ======
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });

    const paymentClient = new Payment(client);
    const moClient = new MerchantOrder(client);

    // ====== OBTENER PAYMENT ======
    const payment = await paymentClient.get({ id: paymentId });
    const meta = payment.metadata || {};

    let sorteoId = meta.sorteoId || null;
    let compraId = meta.compraId || null;
    let cantidad = Number(meta.cantidad || 1);
    let telefono = meta.telefono || null;
    let mpCuenta = meta.mpCuenta || "1";

    // ====== SI METADATA ESTÁ VACÍA → CARGAMOS merchant_order ======
    if (!compraId || !sorteoId) {
      if (payment?.order?.id) {
        const mo = await moClient.get({ merchant_order_id: payment.order.id });

        if (mo?.preference_id) {
          const prefData = JSON.parse(mo.additional_info || "{}");

          sorteoId = sorteoId || prefData.sorteoId || null;
          compraId = compraId || prefData.compraId || null;
          cantidad = cantidad || prefData.cantidad || 1;
          telefono = telefono || prefData.telefono || null;
          mpCuenta = mpCuenta || prefData.mpCuenta || "1";
        }
      }
    }

    if (!compraId) {
      console.error("❌ ERROR: SIN compraId");
      return res.sendStatus(200);
    }

    // ====== ACTUALIZAR COMPRA ======
    const compraRef = db.collection("compras").doc(compraId);
    await compraRef.update({
      status: payment.status === "approved" ? "pagado" : "pendiente",
      updatedAt: new Date().toISOString(),
    });

    // ====== CREAR CHANCES ======
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
      console.log(`🎉 ${cantidad} chances creadas para sorteo ${sorteoId}`);
    } else {
      console.log(`⚠ Pago no aprobado (${payment.status})`);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
