// FILE: routes/mercadopago.js
import express from "express";
import { db } from "../config/firebase.js";
import mercadopago from "mercadopago";

const router = express.Router();

/*
  Función para obtener el access_token correcto según el sorteo
*/
async function getTokenBySorteo(sorteoId) {
  const snap = await db.collection("sorteos").doc(sorteoId).get();
  if (!snap.exists) return null;

  const data = snap.data();
  return data.mpCuenta || null;
}

/*
  CREAR PREFERENCIA
--------------------------------------------------*/
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, titulo, precio, emailComprador } = req.body;

    // 🔥 tomar access_token según sorteo
    const access_token = await getTokenBySorteo(sorteoId);

    if (!access_token) {
      return res.status(400).json({ error: "El sorteo no tiene cuenta MP configurada" });
    }

    // configurar SDK con ese token
    mercadopago.configure({ access_token });

    const preference = {
      items: [
        {
          id: sorteoId,
          title: titulo,
          quantity: 1,
          unit_price: Number(precio),
        },
      ],
      metadata: {
        sorteoId,
        emailComprador,
      },
      back_urls: {
        success: "https://sorteoslxm.com/success",
        failure: "https://sorteoslxm.com/error",
        pending: "https://sorteoslxm.com/pending",
      },
      auto_return: "approved",
      notification_url: "https://sorteoslxm-server-clean.onrender.com/webhook-pago",
    };

    const result = await mercadopago.preferences.create(preference);

    return res.json({
      ok: true,
      init_point: result.body.init_point,
      id: result.body.id,
    });

  } catch (error) {
    console.error("❌ ERROR crear preferencia:", error);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

/*
  WEBHOOK
--------------------------------------------------*/
router.post("/webhook-pago", async (req, res) => {
  try {
    console.log("📥 Webhook recibido:", req.body);

    let paymentId = null;

    // topic=payment
    if (req.body.data?.id) {
      paymentId = req.body.data.id;
    }

    // topic=merchant_order
    if (req.body.resource && req.body.resource.includes("/merchant_orders/")) {
      const parts = req.body.resource.split("/");
      paymentId = parts[parts.length - 1];
    }

    if (!paymentId) {
      console.log("⚠ No se pudo obtener paymentId → ignorado");
      return res.sendStatus(200);
    }

    /*
      1️⃣ OBTENER METADATA DESDE LA API DE PAYMENT
      PERO usando EL TOKEN CORRECTO según sorteo.
    */

    // primero obtener el pago con token base (solo para leer metadata)
    mercadopago.configure({ access_token: process.env.MP_FALLBACK_TOKEN });

    let pagoInfo = null;

    try {
      const resp = await mercadopago.payment.get(paymentId);
      pagoInfo = resp.body;
    } catch (err) {
      console.log("❌ No se pudo leer pago:", err);
      return res.sendStatus(200);
    }

    const sorteoId = pagoInfo.metadata?.sorteoId;

    if (!sorteoId) {
      console.log("⚠ metadata incompleta → ignorado");
      return res.sendStatus(200);
    }

    // ahora sí → obtener access token del sorteo
    const access_token = await getTokenBySorteo(sorteoId);
    if (!access_token) {
      console.log("❌ sorteo sin access_token → ignorado");
      return res.sendStatus(200);
    }

    // reconfigurar SDK con token correcto
    mercadopago.configure({ access_token });

    /*
      2️⃣ LEER PAGO CON TOKEN CORRECTO (para evitar caller_collector_mismatch)
    */
    let pagoFinal;
    try {
      pagoFinal = (await mercadopago.payment.get(paymentId)).body;
    } catch (err) {
      console.log("❌ error leyendo pago con token correcto:", err);
      return res.sendStatus(200);
    }

    const estado = pagoFinal.status;

    /*
      3️⃣ SI ESTÁ APROBADO → MARCAR NÚMERO COMPRADO
    */
    if (estado === "approved") {
      console.log("💰 Pago aprobado para sorteo", sorteoId);

      await db.collection("sorteos").doc(sorteoId).update({
        chancesOcupadas: (pagoFinal.transaction_details?.total_paid_amount || 1),
        editedAt: new Date().toISOString(),
      });
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ ERROR webhook:", error);
    return res.sendStatus(500);
  }
});

export default router;
