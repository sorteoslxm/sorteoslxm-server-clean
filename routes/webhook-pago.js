// FILE: web/sorteoslxm-server-clean/routes/webhook-pago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * POST /webhook-pago
 * MercadoPago envía notificaciones de pago aquí.
 * Recomendado: en Render / domain la URL pública debe apuntar a /webhook-pago
 *
 * Lo que hacemos:
 * - Si llega payment.id -> consultamos mercadopago.payment.get(id) para obtener preference_id
 * - Buscamos compra con mpPreferenceId == preference_id o external_reference == compraId
 * - Actualizamos estado (approved, rejected, pending) y guardamos datos del pagador
 */

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // Manejo simple cuando MercadoPago manda { type: 'payment', data: { id: ... } }
    let paymentId = null;
    if (body.type === "payment" && body.data && body.data.id) {
      paymentId = body.data.id;
    } else if (body.id) {
      // alternativa
      paymentId = body.id;
    }

    if (!paymentId) {
      console.log("WEBHOOK: payload inesperado", body);
      return res.sendStatus(200);
    }

    // Para consultar el pago necesitamos un access_token.
    // Usamos MERCADOPAGO_ACCESS_TOKEN principal si existe.
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN || Object.values(process.env).find(k => k && k.includes("MERCADOPAGO"));
    if (!token) {
      console.error("No hay MERCADOPAGO_ACCESS_TOKEN en env");
      return res.sendStatus(500);
    }
    mercadopago.configure({ access_token: token });

    // obtener información del pago
    const mpPayment = await mercadopago.payment.get(paymentId);
    const payment = mpPayment && (mpPayment.body || mpPayment.response || mpPayment);

    const status = (payment.status || payment.status_detail || "").toLowerCase();
    const preference_id = payment.preference_id || payment.body?.preference_id || payment.external_reference || null;

    // buscar compra por preference id o por external_reference
    let snap = null;
    if (preference_id) {
      snap = await db.collection("compras").where("mpPreferenceId", "==", preference_id).limit(1).get();
      if (snap.empty) {
        // fallback: buscar external_reference (si el external_reference fue la compraId)
        snap = await db.collection("compras").where("external_reference", "==", preference_id).limit(1).get();
      }
    } else {
      snap = await db.collection("compras").where("mpPaymentId", "==", paymentId).limit(1).get();
    }

    if (!snap || snap.empty) {
      console.warn("WEBHOOK: compra no encontrada para preference/payment", preference_id, paymentId);
      return res.sendStatus(200);
    }

    const doc = snap.docs[0];
    const compraId = doc.id;

    const update = {
      status: (status.includes("approved") || status === "approved") ? "approved" : status,
      mpPaymentId: paymentId,
      mpPayer: payment.payer || payment.additional_info?.payer || null,
      updatedAt: Date.now(),
    };

    await db.collection("compras").doc(compraId).update(update);

    console.log("WEBHOOK: compra actualizada", compraId, update.status);
    res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(500);
  }
});

export default router;
