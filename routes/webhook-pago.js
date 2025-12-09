// FILE: routes/webhook-pago.js
import express from "express";
import axios from "axios";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================================
   🔥 1) OBTENER TOKEN SEGÚN CUENTA
============================================================ */
function getToken(mpCuenta) {
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ============================================================
   🔥 2) LEER PAYMENT DIRECTO
============================================================ */
async function leerPayment(paymentId, mpCuenta) {
  try {
    const token = getToken(mpCuenta);
    const { data } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (err) {
    console.error("❌ Error leerPayment:", err.response?.data || err);
    return null;
  }
}

/* ============================================================
   🔥 3) LEER MERCHANT ORDER Y EXTRAER PAYMENT
============================================================ */
async function leerMerchantOrder(url, mpCuenta) {
  try {
    const token = getToken(mpCuenta);

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Buscar un pago aprobado
    const pagoAprobado = data.payments?.find(
      (p) => p.status === "approved"
    );

    return pagoAprobado ? pagoAprobado.id : null;

  } catch (err) {
    console.error("❌ Error leerMerchantOrder:", err.response?.data || err);
    return null;
  }
}

/* ============================================================
   🔥 4) WEBHOOK PRINCIPAL
============================================================ */
router.post("/", async (req, res) => {
  console.log("📥 Webhook recibido:", JSON.stringify(req.body, null, 2));

  try {
    let paymentId = null;

    /* -------------------------------------------------------
       🟦 Caso 1: MP manda { type: "payment", data.id }
    --------------------------------------------------------*/
    if (req.body.type === "payment" && req.body.data?.id) {
      paymentId = req.body.data.id;
      console.log("➡️ ID extraído directo:", paymentId);
    }

    /* -------------------------------------------------------
       🟧 Caso 2: MP manda "merchant_order"
    --------------------------------------------------------*/
    if (!paymentId && req.body.topic === "merchant_order") {
      const pago = await leerMerchantOrder(req.body.resource, "1");
      const pago2 = await leerMerchantOrder(req.body.resource, "2");
      paymentId = pago || pago2;

      console.log("🔁 ID desde merchant_order:", paymentId);
    }

    if (!paymentId) {
      console.log("⚠ No se pudo obtener paymentId → ignorado");
      return res.sendStatus(200);
    }

    /* -------------------------------------------------------
       🔥 Obtener payment REAL (con metadata)
    --------------------------------------------------------*/
    const payment =
      (await leerPayment(paymentId, "1")) ||
      (await leerPayment(paymentId, "2"));

    if (!payment) {
      console.log("❌ No se pudo leer payment");
      return res.sendStatus(200);
    }

    const meta = payment.metadata || {};
    console.log("🔍 payment metadata:", meta);

    if (!meta.sorteoId) {
      console.log("⚠ metadata incompleta → ignorado");
      return res.sendStatus(200);
    }

    const { sorteoId, cantidad, compraId, telefono, mpCuenta } = meta;

    /* -------------------------------------------------------
       🔥 5) Marcar compra como pagada
    --------------------------------------------------------*/
    await db.collection("compras").doc(compraId).update({
      status: "pagado",
      paymentId,
      mpCuenta,
      updatedAt: new Date()
    });

    /* -------------------------------------------------------
       🔥 6) Generar chances
    --------------------------------------------------------*/
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    const sorteoSnap = await sorteoRef.get();
    const sorteo = sorteoSnap.data();

    const offset = sorteo.chancesVendidas?.length || 0;
    const nuevas = [];

    for (let i = 0; i < cantidad; i++) {
      const n = offset + i + 1;
      nuevas.push({
        numero: `LXM-${String(n).padStart(5, "0")}`,
        telefono,
        fecha: new Date().toISOString()
      });
    }

    await sorteoRef.update({
      chancesVendidas: [...(sorteo.chancesVendidas || []), ...nuevas]
    });

    console.log("🎉 Chances generadas:", nuevas.length);

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(200);
  }
});

export default router;
