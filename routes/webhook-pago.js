// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();
router.use(express.raw({ type: "*/*" }));

function extractPaymentId(body) {
  if (body?.topic === "payment" && !isNaN(body?.resource)) return body.resource;
  if (body?.type === "payment" && body?.data?.id) return body.data.id;
  return null;
}

function getAccessToken(mpCuenta = "1") {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
    : process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    // 🔒 LOCK GLOBAL POR PAYMENT (idempotencia)
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    if ((await lockRef.get()).exists) {
      console.log("⚠ Webhook ya procesado:", paymentId);
      return res.sendStatus(200);
    }

    // 🔍 Leer pago (token 1 alcanza para leer external_reference)
    const tmpClient = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });
    const tmpPayment = await new Payment(tmpClient).get({ id: paymentId });

    const compraId = tmpPayment.external_reference;
    if (!compraId) {
      console.error("❌ Pago sin external_reference:", paymentId);
      return res.sendStatus(200);
    }

    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();
    if (!compraSnap.exists) {
      console.error("❌ Compra no encontrada:", compraId);
      return res.sendStatus(200);
    }

    const compra = compraSnap.data();
    const {
      sorteoId,
      cantidad = 1,
      telefono = null,
      mpCuenta = "1",
    } = compra;

    // 🔑 Token correcto según cuenta
    const client = new MercadoPagoConfig({
      accessToken: getAccessToken(mpCuenta),
    });
    const payment = await new Payment(client).get({ id: paymentId });

    // 🧾 Actualizar compra (siempre)
    await compraRef.update({
      mpPaymentId: paymentId,
      mpStatus: payment.status,
      status: payment.status === "approved" ? "pagado" : "iniciada",
      updatedAt: new Date().toISOString(),
    });

    // 🎟️ SOLO si está aprobado y NO existen chances
    if (payment.status === "approved") {
      const chancesSnap = await db
        .collection("chances")
        .where("mpPaymentId", "==", paymentId)
        .limit(1)
        .get();

      if (!chancesSnap.empty) {
        console.log("⚠ Chances ya creadas para:", paymentId);
        await lockRef.set({ processedAt: new Date() });
        return res.sendStatus(200);
      }

      for (let i = 0; i < cantidad; i++) {
        await db.collection("chances").add({
          sorteoId,
          compraId,
          telefono,
          mpPaymentId: paymentId,
          mpCuenta,
          mpStatus: "approved",
          createdAt: new Date().toISOString(),
        });
      }

      console.log(`🎉 ${cantidad} chances creadas (${compraId})`);
    }

    // 🔐 Cerrar lock al final (CRÍTICO)
    await lockRef.set({
      processedAt: new Date(),
      paymentId,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
