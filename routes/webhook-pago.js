// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment, MerchantOrder } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// MercadoPago requiere RAW
router.use(express.raw({ type: "*/*" }));

// Función segura para obtener paymentId desde body
function extractPaymentId(body) {
  if (body?.topic === "payment" && body.resource && !isNaN(body.resource)) {
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

    // 🔒 Anti-doble ejecución
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }
    await lockRef.set({ processedAt: new Date(), paymentId });

    // Cliente MP SIEMPRE con el token de lectura (cuenta 1)
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    const merchantOrderClient = new MerchantOrder(client);

    // ============================================================
    // 🔍 PRIORIDAD PARA ENCONTRAR compraId
    // ============================================================

    let compraId = null;

    // 1️⃣ PRIMERO: payment.metadata.compraId
    if (payment.metadata?.compraId) {
      compraId = payment.metadata.compraId;
      console.log("🟢 compraId desde metadata:", compraId);
    }

    // 2️⃣ SEGUNDO: merchant_order.preference_id
    if (!compraId && payment.order?.id) {
      const mo = await merchantOrderClient.get({ merchantOrderId: payment.order.id });
      if (mo.body.preference_id) {
        compraId = mo.body.preference_id;
        console.log("🟢 compraId desde merchant_order -> preference_id:", compraId);
      }
    }

    // 3️⃣ TERCERO: external_reference
    if (!compraId && payment.external_reference) {
      compraId = payment.external_reference;
      console.log("🟢 compraId desde external_reference:", compraId);
    }

    if (!compraId) {
      console.error("❌ No se encontró compraId desde ninguna fuente");
      return res.sendStatus(200);
    }

    // ============================================================
    // Información adicional
    // ============================================================

    const sorteoId =
      payment.metadata?.sorteoId ||
      payment.additional_info?.items?.[0]?.id ||
      null;

    const cantidad = Number(payment.metadata?.cantidad || 1);
    const telefono = payment.metadata?.telefono || null;
    const mpCuenta = payment.metadata?.mpCuenta || "1";

    // ============================================================
    // 📝 Actualizar compra
    // ============================================================

    const compraRef = db.collection("compras").doc(compraId);
    await compraRef.update({
      status: payment.status === "approved" ? "pagado" : "pendiente",
      updatedAt: new Date().toISOString(),
    });

    // ============================================================
    // 🎟 Crear chances SOLO si está aprobado
    // ============================================================

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
