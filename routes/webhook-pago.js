// FILE: routes/webhook-pago.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ======================================================
   🟧 WEBHOOK MERCADOPAGO (SDK nueva)
====================================================== */
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    // ⛔ MercadoPago manda esto cuando se aprueba el pago
    if (data.type !== "payment") return res.sendStatus(200);

    const paymentId = data.data.id;
    if (!paymentId) return res.sendStatus(200);

    // 🔵 Traer info del pago desde MP
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN_1}`,
        },
      }
    );
    const pago = await response.json();

    console.log("🔵 WEBHOOK PAGO:", pago.status, " - ID:", paymentId);

    if (pago.status !== "approved") return res.sendStatus(200);

    const { metadata } = pago;
    const { sorteoId, cantidad, telefono } = metadata;

    /* ======================================================
       🟢 1) MARCAR COMPRA COMO APROBADA
    ====================================================== */
    const comprasSnap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", pago.preference_id)
      .limit(1)
      .get();

    if (!comprasSnap.empty) {
      await comprasSnap.docs[0].ref.update({
        status: "approved",
        mpPaymentId: paymentId,
      });
    }

    /* ======================================================
       🟢 2) CREAR CHANCES NUMERADAS
    ====================================================== */
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    const sorteoDoc = await sorteoRef.get();

    if (!sorteoDoc.exists) return res.sendStatus(200);

    const { vendidos = 0 } = sorteoDoc.data();
    const nuevosVendidos = vendidos + cantidad;

    // actualizar vendidos
    await sorteoRef.update({ vendidos: nuevosVendidos });

    // crear chances
    for (let i = 0; i < cantidad; i++) {
      const numero = (vendidos + i + 1).toString().padStart(5, "0");

      await db.collection("chances").add({
        sorteoId,
        telefono,
        numero,
        createdAt: Date.now(),
        paymentId,
      });
    }

    console.log("🟢 Chances generadas:", cantidad);

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
