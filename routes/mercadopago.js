// FILE: routes/mercadopago.js
import express from "express";
import { db } from "../config/firebase.js";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const router = express.Router();

/*
  Obtener access_token según sorteo
*/
async function getTokenBySorteo(sorteoId) {
  const snap = await db.collection("sorteos").doc(sorteoId).get();
  if (!snap.exists) return null;
  return snap.data().mpCuenta || null;
}

/*
  CREAR PREFERENCIA
--------------------------------------------------*/
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, titulo, precio, emailComprador } = req.body;

    const access_token = await getTokenBySorteo(sorteoId);

    if (!access_token) {
      return res.status(400).json({ error: "El sorteo no tiene cuenta MP configurada" });
    }

    // Crear cliente MercadoPago con el token correcto
    const mpClient = new MercadoPagoConfig({ accessToken: access_token });
    const preferenceClient = new Preference(mpClient);

    const result = await preferenceClient.create({
      body: {
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
      },
    });

    return res.json({
      ok: true,
      init_point: result.init_point,
      id: result.id,
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

    if (req.body.data?.id) paymentId = req.body.data.id;
    if (!paymentId && req.body.resource?.includes("/merchant_orders/")) {
      paymentId = req.body.resource.split("/").pop();
    }

    if (!paymentId) return res.sendStatus(200);

    // Leer pago con fallback (solo metadata)
    const fallbackClient = new MercadoPagoConfig({
      accessToken: process.env.MP_FALLBACK_TOKEN,
    });
    const fallbackPayment = new Payment(fallbackClient);

    let pagoInfo;
    try {
      pagoInfo = await fallbackPayment.get({ id: paymentId });
    } catch (err) {
      console.log("❌ No se pudo leer pago:", err);
      return res.sendStatus(200);
    }

    const sorteoId = pagoInfo?.metadata?.sorteoId;
    if (!sorteoId) return res.sendStatus(200);

    // Token correcto según sorteo
    const access_token = await getTokenBySorteo(sorteoId);
    if (!access_token) return res.sendStatus(200);

    // Leer pago con el token correcto
    const mpClient = new MercadoPagoConfig({ accessToken: access_token });
    const paymentClient = new Payment(mpClient);
    const pagoFinal = await paymentClient.get({ id: paymentId });

    if (pagoFinal.status === "approved") {
      console.log("💰 Pago aprobado para sorteo", sorteoId);

      await db.collection("sorteos").doc(sorteoId).update({
        chancesOcupadas: pagoFinal.transaction_details?.total_paid_amount || 1,
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
