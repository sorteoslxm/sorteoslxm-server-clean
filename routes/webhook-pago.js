// FILE: routes/webhook-pago.js
import express from "express";
import axios from "axios";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   TOKEN SEGÚN CUENTA
=========================================================== */
function getToken(mpCuenta) {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
    : process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ===========================================================
   LEER PAYMENT
=========================================================== */
async function leerPayment(id, mpCuenta) {
  try {
    const token = getToken(mpCuenta);
    const { data } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (e) {
    return null;
  }
}

/* ===========================================================
   LEER MERCHANT ORDER
=========================================================== */
async function leerMerchantOrder(url, mpCuenta) {
  try {
    const token = getToken(mpCuenta);
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const pago = data.payments?.find((p) => p.status === "approved");
    return pago?.id || null;
  } catch (e) {
    return null;
  }
}

/* ===========================================================
   WEBHOOK MP
=========================================================== */
router.post("/", async (req, res) => {
  console.log("📥", JSON.stringify(req.body, null, 2));

  let paymentId = null;

  // Caso directo
  if (req.body.type === "payment" && req.body.data?.id) {
    paymentId = req.body.data.id;
  }

  // Caso merchant_order
  if (!paymentId && req.body.topic === "merchant_order") {
    const pago1 = await leerMerchantOrder(req.body.resource, "1");
    const pago2 = await leerMerchantOrder(req.body.resource, "2");
    paymentId = pago1 || pago2;
  }

  if (!paymentId) return res.sendStatus(200);

  // Obtener payment real
  const payment =
    (await leerPayment(paymentId, "1")) ||
    (await leerPayment(paymentId, "2"));

  if (!payment || !payment.metadata) return res.sendStatus(200);

  const { sorteoId, compraId, cantidad, telefono, mpCuenta } = payment.metadata;
  if (!sorteoId || !compraId) return res.sendStatus(200);

  /* ===========================================================
     1) MARCAR COMPRA PAGADA
  ============================================================ */
  await db.collection("compras").doc(compraId).update({
    status: "pagado",
    paymentId,
    updatedAt: new Date()
  });

  /* ===========================================================
     2) GENERAR CHANCES Y GUARDARLAS
  ============================================================ */
  const sorteoRef = db.collection("sorteos").doc(sorteoId);
  const sorteoSnap = await sorteoRef.get();
  const sorteo = sorteoSnap.data();

  const existentes = sorteo.chancesVendidas || [];
  const offset = existentes.length;

  const nuevas = [];

  for (let i = 0; i < cantidad; i++) {
    const n = `LXM-${String(offset + i + 1).padStart(5, "0")}`;

    const chance = {
      numero: n,
      sorteoId,
      telefono,
      compraId,
      fecha: new Date().toISOString()
    };

    nuevas.push(chance);

    // GUARDAR EN COLECCIÓN GLOBAL (para admin)
    await db.collection("chances").add({
      ...chance,
      createdAt: new Date()
    });
  }

  await sorteoRef.update({
    chancesVendidas: [...existentes, ...nuevas]
  });

  console.log("🎉 Chances generadas:", nuevas.length);

  return res.sendStatus(200);
});

export default router;
