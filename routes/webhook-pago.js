// FILE: routes/webhook-pago.js
import express from "express";
import axios from "axios";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================================
   Mapear token según mpCuenta (acepta "1"/"2" o el nombre env)
============================================================ */
function getToken(mpCuenta) {
  if (!mpCuenta) return null;

  if (mpCuenta === "2" || mpCuenta === "MERCADOPAGO_ACCESS_TOKEN_2")
    return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ============================================================
   Leer payment por id usando axios y token
============================================================ */
async function leerPayment(paymentId, token) {
  try {
    const { data } = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (e) {
    // devuelve null si no pudo
    return null;
  }
}

/* ============================================================
   Leer merchant_order y devolver payment aprobado id
   (usa resource URL que Mercadolibre envía)
============================================================ */
async function leerMerchantOrder(resourceUrl, token) {
  try {
    const { data } = await axios.get(resourceUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const pagoAprobado = data.payments?.find((p) => p.status === "approved");
    return pagoAprobado ? pagoAprobado.id : null;
  } catch (e) {
    return null;
  }
}

/* ============================================================
   Endpoint webhook: recibe both payment y merchant_order
============================================================ */
router.post("/", async (req, res) => {
  console.log("📥 Webhook recibido:", JSON.stringify(req.body, null, 2));

  try {
    let paymentId = null;

    // 1) Si vino directo tipo "payment"
    if (req.body.type === "payment" && req.body.data?.id) {
      paymentId = req.body.data.id;
    }

    // 2) Si vino merchant_order (resource url)
    if (!paymentId && req.body.topic === "merchant_order" && req.body.resource) {
      // intentamos con ambas cuentas: MP1 y MP2
      const t1 = process.env.MERCADOPAGO_ACCESS_TOKEN_1;
      const t2 = process.env.MERCADOPAGO_ACCESS_TOKEN_2;

      const from1 = await leerMerchantOrder(req.body.resource, t1);
      const from2 = await leerMerchantOrder(req.body.resource, t2);

      paymentId = from1 || from2;
    }

    if (!paymentId) {
      console.log("⚠ No se pudo obtener paymentId → ignorado");
      return res.sendStatus(200);
    }

    // 3) Intentar leer el payment con ambos tokens (para obtener metadata, status)
    const t1 = process.env.MERCADOPAGO_ACCESS_TOKEN_1;
    const t2 = process.env.MERCADOPAGO_ACCESS_TOKEN_2;

    const p1 = await leerPayment(paymentId, t1);
    const p2 = await leerPayment(paymentId, t2);
    const payment = p1 || p2;

    if (!payment) {
      console.log("❌ No se pudo leer payment:", paymentId);
      return res.sendStatus(200);
    }

    // 4) metadata
    const meta = payment.metadata || {};
    if (!meta.sorteoId || !meta.compraId || !meta.cantidad) {
      console.log("⚠ metadata incompleta → ignorado", meta);
      return res.sendStatus(200);
    }

    const sorteoId = meta.sorteoId;
    const compraId = meta.compraId;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;
    const mpCuenta = meta.mpCuenta || "1";

    // 5) Si aprobado → marcar compra y generar chances
    if (payment.status === "approved") {
      // marcar compra
      try {
        await db.collection("compras").doc(compraId).update({
          status: "pagado",
          paymentId,
          mpCuenta,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("⚠ No se pudo actualizar compra:", e);
      }

      // generar objects de chances y guardarlos tanto en collection 'chances' como dentro del sorteo
      const sorteoRef = db.collection("sorteos").doc(sorteoId);
      const sorteoSnap = await sorteoRef.get();
      const sorteoData = sorteoSnap.exists ? sorteoSnap.data() : null;
      const base = sorteoData?.chancesVendidas?.length || 0;

      const nuevas = [];
      for (let i = 0; i < cantidad; i++) {
        const n = base + i + 1;
        const numero = `LXM-${String(n).padStart(5, "0")}`;
        const chanceObj = {
          sorteoId,
          numero,
          telefono,
          mpStatus: "approved",
          mpPaymentId: paymentId,
          createdAt: new Date().toISOString(),
        };

        // guardar global
        await db.collection("chances").add(chanceObj);
        nuevas.push(chanceObj);
      }

      // actualizar sorteo.chancesVendidas (mantener compatibilidad)
      try {
        await sorteoRef.update({
          chancesVendidas: [...(sorteoData?.chancesVendidas || []), ...nuevas],
          chancesOcupadas: (sorteoData?.chancesOcupadas || 0) + nuevas.length,
          editedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("⚠ No se pudo actualizar sorteo con nuevas chances:", e);
      }

      console.log("🎉 Chances generadas:", nuevas.length);
    } else {
      console.log("ℹ Pago no aprobado (status):", payment.status);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(200);
  }
});

export default router;
