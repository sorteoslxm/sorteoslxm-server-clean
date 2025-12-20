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
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    // 🔒 Anti duplicados (por paymentId)
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }
    await lockRef.set({ processedAt: new Date(), paymentId });

    // 🔍 Buscar compra asociada al paymentId
    const compraSnap = await db
      .collection("compras")
      .where("mpPaymentId", "==", paymentId)
      .limit(1)
      .get();

    if (compraSnap.empty) {
      console.error("❌ No se encontró compra para paymentId:", paymentId);
      return res.sendStatus(200);
    }

    const compraDoc = compraSnap.docs[0];
    const compra = compraDoc.data();

    const {
      sorteoId,
      cantidad = 1,
      telefono = null,
      mpCuenta = "1",
    } = compra;

    // ✅ Token correcto desde el inicio
    const accessToken = getAccessToken(mpCuenta);
    const client = new MercadoPagoConfig({ accessToken });
    const payment = await new Payment(client).get({ id: paymentId });

    // 🧾 Actualizar estado de compra
    const nuevoEstado =
      payment.status === "approved" ? "pagado" : "pendiente";

    await compraDoc.ref.update({
      status: nuevoEstado,
      mpStatus: payment.status,
      updatedAt: new Date().toISOString(),
    });

    // 🎟 Crear chances SOLO si está aprobado
    if (payment.status === "approved") {
      for (let i = 0; i < cantidad; i++) {
        await db.collection("chances").add({
          sorteoId,
          compraId: compraDoc.id,
          telefono,
          createdAt: new Date().toISOString(),
          mpStatus: "approved",
          mpPaymentId: paymentId,
          mpCuenta,
        });
      }

      console.log(
        `🎉 ${cantidad} chances creadas para sorteo ${sorteoId} (cuenta ${mpCuenta})`
      );
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
