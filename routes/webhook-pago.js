// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
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

function getAccessToken(mpCuenta) {
  if (!mpCuenta) return process.env.MERCADOPAGO_ACCESS_TOKEN_1;

  if (mpCuenta.startsWith("MERCADOPAGO_ACCESS_TOKEN_")) {
    return process.env[mpCuenta];
  }

  if (mpCuenta === "2") {
    return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  }

  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    // 🔒 Anti duplicados
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }
    await lockRef.set({ processedAt: new Date(), paymentId });

    // ⚠️ PRIMER LECTURA CON TOKEN 1 SOLO PARA OBTENER METADATA BÁSICA
    const tempClient = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });
    const tempPayment = await new Payment(tempClient).get({ id: paymentId });
    const meta = tempPayment.metadata || {};

    // 🧠 aceptar camelCase y snake_case
    const sorteoId = meta.sorteoId || meta.sorteo_id || null;
    const compraId = meta.compraId || meta.compra_id || null;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;
    const mpCuenta = meta.mpCuenta || meta.mp_cuenta || "1";

    if (!sorteoId || !compraId) {
      console.error("❌ ERROR: metadata incompleta", meta);
      return res.sendStatus(200);
    }

    // ✅ AHORA sí: token correcto según cuenta
    const accessToken = getAccessToken(mpCuenta);
    const client = new MercadoPagoConfig({ accessToken });
    const payment = await new Payment(client).get({ id: paymentId });

    // 🧾 actualizar compra
    await db.collection("compras").doc(compraId).update({
      status: payment.status === "approved" ? "pagado" : "pendiente",
      updatedAt: new Date().toISOString(),
    });

    // 🎟 crear chances
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

      console.log(`🎉 ${cantidad} chances creadas para sorteo ${sorteoId} (cuenta ${mpCuenta})`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
