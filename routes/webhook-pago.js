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

    // 🔒 Anti duplicados
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    if ((await lockRef.get()).exists) {
      console.log("⚠ Webhook duplicado:", paymentId);
      return res.sendStatus(200);
    }

    // ⚠ Buscar compra por external_reference (COMPRA REAL)
    const clientTmp = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    });
    const paymentTmp = await new Payment(clientTmp).get({ id: paymentId });

    const compraId = paymentTmp.external_reference;
    if (!compraId) {
      console.error("❌ Pago sin external_reference:", paymentId);
      return res.sendStatus(200);
    }

    const compraDoc = await db.collection("compras").doc(compraId).get();
    if (!compraDoc.exists) {
      console.error("❌ Compra no encontrada:", compraId);
      return res.sendStatus(200);
    }

    const compra = compraDoc.data();
    const {
      sorteoId,
      cantidad = 1,
      telefono = null,
      mpCuenta = "1",
    } = compra;

    // 🔑 Token correcto
    const client = new MercadoPagoConfig({
      accessToken: getAccessToken(mpCuenta),
    });
    const payment = await new Payment(client).get({ id: paymentId });

    // 🔒 Lock definitivo
    await lockRef.set({ processedAt: new Date() });

    if (payment.status === "approved") {
      await compraDoc.ref.update({
        status: "pagado",
        mpStatus: "approved",
        mpPaymentId: paymentId,
        updatedAt: new Date().toISOString(),
      });

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
    } else {
      await compraDoc.ref.update({
        status: "iniciada",
        mpStatus: payment.status,
        mpPaymentId: paymentId,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
