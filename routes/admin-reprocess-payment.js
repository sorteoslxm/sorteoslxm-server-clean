// FILE: routes/admin-reprocess-payment.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

function getAccessToken(mpCuenta) {
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/reprocess-payment/:paymentId", async (req, res) => {
  const { paymentId } = req.params;

  try {
    console.log("🔁 Reprocesando payment:", paymentId);

    // 🔍 Buscar compra asociada
    const compraSnap = await db
      .collection("compras")
      .where("mpPaymentId", "==", paymentId)
      .limit(1)
      .get();

    if (compraSnap.empty) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada para este paymentId",
      });
    }

    const compraDoc = compraSnap.docs[0];
    const compra = compraDoc.data();

    const {
      sorteoId,
      cantidad = 1,
      telefono = null,
      mpCuenta = "1",
    } = compra;

    // 🔒 Lock anti duplicados
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Payment ya procesado anteriormente:", paymentId);
    } else {
      await lockRef.set({ processedAt: new Date(), paymentId });
    }

    // 🔑 Token correcto
    const accessToken = getAccessToken(mpCuenta);
    const client = new MercadoPagoConfig({ accessToken });
    const payment = await new Payment(client).get({ id: paymentId });

    // 🧾 Actualizar compra
    const nuevoEstado =
      payment.status === "approved" ? "pagado" : "pendiente";

    await compraDoc.ref.update({
      status: nuevoEstado,
      mpStatus: payment.status,
      updatedAt: new Date().toISOString(),
    });

    // 🎟 Crear chances SOLO si está aprobado
    let chancesCreadas = 0;

    if (payment.status === "approved") {
      const chancesSnap = await db
        .collection("chances")
        .where("mpPaymentId", "==", paymentId)
        .get();

      if (chancesSnap.empty) {
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
          chancesCreadas++;
        }
      }
    }

    return res.json({
      ok: true,
      paymentId,
      mpStatus: payment.status,
      compraEstado: nuevoEstado,
      chancesCreadas,
    });
  } catch (err) {
    console.error("❌ Error reprocesando pago:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

export default router;
