// FILE: routes/webhook-pago.js
import express from "express";
import axios from "axios";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================================
   TOKEN DE CADA CUENTA
============================================================ */
function getToken(mpCuenta) {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
    : process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ============================================================
   LEE UN PAYMENT USANDO EL TOKEN CORRECTO
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
   LEE UNA MERCHANT ORDER Y BUSCA PAGOS APROBADOS
============================================================ */
async function leerMerchantOrder(resource, mpCuenta) {
  try {
    const token = getToken(mpCuenta);

    const { data } = await axios.get(resource, {
      headers: { Authorization: `Bearer ${token}` },
    });

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
   WEBHOOK OFICIAL
============================================================ */
router.post("/", async (req, res) => {
  console.log("📥 Webhook recibido:", JSON.stringify(req.body, null, 2));

  try {
    let paymentId = null;

    /* -------------------------------------------------------
       🔵 Caso 1: type = "payment"
    --------------------------------------------------------*/
    if (req.body.type === "payment" && req.body.data?.id) {
      paymentId = req.body.data.id;
    }

    /* -------------------------------------------------------
       🟧 Caso 2: merchant_order (necesita buscar payment adentro)
    --------------------------------------------------------*/
    if (!paymentId && req.body.topic === "merchant_order") {
      const from1 = await leerMerchantOrder(req.body.resource, "1");
      const from2 = await leerMerchantOrder(req.body.resource, "2");
      paymentId = from1 || from2;
    }

    if (!paymentId) {
      console.log("⚠ No se pudo obtener paymentId → ignorado");
      return res.sendStatus(200);
    }

    /* -------------------------------------------------------
       🔥 LEER PAYMENT REAL USANDO MP1 Y MP2
    --------------------------------------------------------*/
    const pago1 = await leerPayment(paymentId, "1");
    const pago2 = await leerPayment(paymentId, "2");
    const payment = pago1 || pago2;

    if (!payment) {
      console.log("❌ No se pudo leer payment");
      return res.sendStatus(200);
    }

    const meta = payment.metadata || {};

    if (!meta.sorteoId || !meta.compraId || !meta.cantidad) {
      console.log("⚠ metadata incompleta → ignorado");
      return res.sendStatus(200);
    }

    console.log("🔍 payment metadata:", meta);

    /* -------------------------------------------------------
       🔥 1) MARCAR COMPRA COMO PAGADA
    --------------------------------------------------------*/
    await db.collection("compras").doc(meta.compraId).update({
      status: "pagado",
      paymentId,
      mpCuenta: meta.mpCuenta || "1",
      updatedAt: new Date().toISOString(),
    });

    /* -------------------------------------------------------
       🔥 2) GENERAR CHANCES
    --------------------------------------------------------*/
    const sorteoRef = db.collection("sorteos").doc(meta.sorteoId);
    const sorteoSnap = await sorteoRef.get();
    const sorteo = sorteoSnap.data();

    const base = sorteo.chancesVendidas?.length || 0;
    const nuevas = [];

    for (let i = 0; i < meta.cantidad; i++) {
      const n = base + i + 1;
      const numero = `LXM-${String(n).padStart(5, "0")}`;

      const chanceObj = {
        sorteoId: meta.sorteoId,
        numero,
        telefono: meta.telefono,
        mpStatus: "approved",
        mpPaymentId: paymentId,
        createdAt: new Date().toISOString(),
      };

      nuevas.push(chanceObj);

      // 🔥 Guardar GLOBAL
      await db.collection("chances").add(chanceObj);
    }

    // 🔥 Guardar también dentro del sorteo (compatibilidad)
    await sorteoRef.update({
      chancesVendidas: [...(sorteo.chancesVendidas || []), ...nuevas],
    });

    console.log("🎉 Chances generadas:", nuevas.length);

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(200);
  }
});

export default router;
