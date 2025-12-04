// FILE: routes/webhook-pago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * POST /webhook-pago
 * MercadoPago envía notificaciones de pago.
 */

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    let paymentId = null;

    if (body.type === "payment" && body.data?.id) {
      paymentId = body.data.id;
    } else if (body.id) {
      paymentId = body.id;
    }

    if (!paymentId) return res.sendStatus(200);

    // Configurar MP
    const token =
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      Object.values(process.env).find((k) => k && k.includes("MERCADOPAGO"));

    mercadopago.configure({ access_token: token });

    const mpPayment = await mercadopago.payment.get(paymentId);
    const payment = mpPayment.body;

    const preference_id = payment.preference_id;
    const status = payment.status;

    // Buscar compra
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preference_id)
      .limit(1)
      .get();

    if (snap.empty) return res.sendStatus(200);

    const compra = snap.docs[0];

    await compra.ref.update({
      status,
      mpPaymentId: paymentId,
      mpPayer: payment.payer,
      updatedAt: Date.now(),
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(500);
  }
});

export default router;
