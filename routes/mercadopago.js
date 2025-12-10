// FILE: routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   OBTENER TOKEN SEGÚN LA CUENTA
=========================================================== */
function getToken(mpCuenta) {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
    : process.env.MERCADAPAGO_ACCESS_TOKEN_1;
}

/* ===========================================================
   CREAR PREFERENCIA
=========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad, telefono } = req.body;

    const snap = await db.collection("sorteos").doc(sorteoId).get();
    if (!snap.exists) return res.status(404).json({ error: "Sorteo no encontrado" });

    const sorteo = snap.data();
    const mpCuenta = String(sorteo.mpCuenta || "1");
    const token = getToken(mpCuenta);

    if (!token) return res.status(500).json({ error: "TOKEN de MercadoPago no configurado" });

    // CONFIGURAR SDK
    mercadopago.configure({ access_token: token });

    // Crear pre-registro
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date(),
    });

    const compraId = compraRef.id;

    // Crear preferencia
    const preference = await mercadopago.preferences.create({
      items: [
        {
          title: `Chances Sorteo ${sorteo.titulo}`,
          quantity: Number(cantidad),
          unit_price: Number(sorteo.precio),
          currency_id: "ARS",
        },
      ],
      metadata: { sorteoId, compraId, cantidad, telefono, mpCuenta },
      back_urls: {
        success: "https://sorteoslxm.com/success",
        failure: "https://sorteoslxm.com/failure",
        pending: "https://sorteoslxm.com/pending",
      },
      auto_return: "approved",
      notification_url: "https://sorteoslxm-server-clean.onrender.com/mercadopago/webhook",
    });

    await compraRef.update({ mpPreferenceId: preference.response.id });

    res.json({
      ok: true,
      id: preference.response.id,
      init_point: preference.response.init_point,
    });

  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err);
    res.status(500).json({ error: "Error al crear la preferencia" });
  }
});

/* ===========================================================
   WEBHOOK
=========================================================== */
router.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(400);

    const mpCuenta = req.body?.data?.metadata?.mpCuenta || "1";
    const token = getToken(mpCuenta);

    mercadopago.configure({ access_token: token });

    const { response: payment } = await mercadopago.payment.get(paymentId);

    if (payment.status === "approved") {
      const compraId = payment.metadata?.compraId;

      if (compraId) {
        await db.collection("compras").doc(compraId).update({
          status: "pagado",
          paymentData: payment,
          updatedAt: new Date(),
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    res.sendStatus(500);
  }
});

export default router;
