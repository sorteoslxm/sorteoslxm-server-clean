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

function getClientByCuenta(mpCuenta) {
  const token =
    mpCuenta === "2"
      ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
      : process.env.MERCADOPAGO_ACCESS_TOKEN_1;

  return new Payment(
    new MercadoPagoConfig({
      accessToken: token,
    })
  );
}

async function getPaymentFromCuenta2First(paymentId) {
  try {
    const payment2 = await getClientByCuenta("2").get({ id: paymentId });
    return { payment: payment2, mpCuenta: "2" };
  } catch (e) {
    try {
      const payment1 = await getClientByCuenta("1").get({ id: paymentId });
      return { payment: payment1, mpCuenta: "1" };
    } catch {
      return null;
    }
  }
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    // 🔒 LOCK GLOBAL POR PAYMENT
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    if ((await lockRef.get()).exists) {
      console.log("⚠ Webhook ya procesado:", paymentId);
      return res.sendStatus(200);
    }

    // 🔍 Leer pago (cuenta 2 primero)
    const result = await getPaymentFromCuenta2First(paymentId);
    if (!result) {
      console.warn("⏳ Payment todavía no disponible:", paymentId);
      return res.sendStatus(200);
    }

    const { payment, mpCuenta } = result;

    const compraId = payment.external_reference;
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
    } = compra;

    // 🧾 Actualizar compra
    await compraRef.update({
      mpPaymentId: paymentId,
      mpStatus: payment.status,
      status: payment.status === "approved" ? "pagado" : "iniciada",
      mpCuenta,
      updatedAt: new Date().toISOString(),
    });

    // 🎟️ Crear chances SOLO si aprobado
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

    // 🔐 Cerrar lock
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
