// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// MercadoPago requiere RAW
router.use(express.raw({ type: "*/*" }));

// Unificar extracción de paymentId
function extractPaymentId(body) {
  // Caso 1: topic payment con resource = id directo
  if (body?.topic === "payment" && body?.resource && !isNaN(body.resource)) {
    return body.resource;
  }

  // Caso 2: payment.created con data.id
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

    // No es un evento de pago
    if (!paymentId) return res.sendStatus(200);

    // 🔒 BLOQUEO ANTI-DOBLE EJECUCIÓN
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

    // Cargar metadata REAL consultando el pago
    const prelimMpCuenta = body?.data?.metadata?.mpCuenta || "1";

    const token = prelimMpCuenta === "2"
      ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
      : process.env.MERCADOPAGO_ACCESS_TOKEN_1;

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    const meta = payment.metadata || {};

    const sorteoId = meta.sorteoId;
    const compraId = meta.compraId;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;

    // Actualizar compra
    const compraRef = db.collection("compras").doc(compraId);
    await compraRef.update({
      status: payment.status === "approved" ? "pagado" : "pendiente",
      updatedAt: new Date().toISOString(),
    });

    // Solo crear chances si esta aprobado
    if (payment.status === "approved") {
      const chancesRef = db.collection("chances");

      for (let i = 0; i < cantidad; i++) {
        await chancesRef.add({
          sorteoId,
          compraId,
          telefono,
          createdAt: new Date().toISOString(),
          mpStatus: "approved",
          mpPaymentId: paymentId,
        });
      }

      console.log(`🎉 ${cantidad} chances generadas para sorteo ${sorteoId}`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
