// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   TOKEN SEGÚN CUENTA
================================= */
function getToken(mpCuenta) {
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ================================
   WEBHOOK
================================= */
router.post("/", async (req, res) => {
  console.log("📥 Webhook recibido:", JSON.stringify(req.body, null, 2));

  try {
    const paymentId =
      req.body?.data?.id ||
      (req.body?.resource && req.body.resource.includes("/payments/")
        ? req.body.resource.split("/").pop()
        : null);

    if (!paymentId) {
      console.log("⚠ Webhook sin paymentId → ignorado");
      return res.sendStatus(200);
    }

    /* ------------------------------
       1. LEER PAYMENT BÁSICO
    --------------------------------*/
    const tmpClient = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN_1
    });
    const tmpPayment = new Payment(tmpClient);
    const raw = await tmpPayment.get({ id: paymentId });

    const metadata = raw?.metadata || {};

    const { mpCuenta, sorteoId, cantidad, telefono, compraId } = metadata;

    if (!mpCuenta) {
      console.log("❌ No vino mpCuenta → no sabemos qué cuenta usó");
      return res.sendStatus(200);
    }

    /* ------------------------------
       2. LEER PAYMENT CON TOKEN REAL
    --------------------------------*/
    const realToken = getToken(mpCuenta);
    const realClient = new MercadoPagoConfig({ accessToken: realToken });
    const realPayment = new Payment(realClient);

    const pago = await realPayment.get({ id: paymentId });

    console.log("🔍 Payment leído:", pago);

    if (pago.status !== "approved") {
      console.log("⚠ Pago no aprobado → ignorado");
      return res.sendStatus(200);
    }

    if (!sorteoId || !cantidad || !compraId) {
      console.log("❌ Falta metadata necesaria → no se procesa");
      return res.sendStatus(200);
    }

    /* ------------------------------
       3. GENERAR CHANCES
    --------------------------------*/
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    const sorteoSnap = await sorteoRef.get();

    if (!sorteoSnap.exists) {
      console.log("❌ Sorteo no existe");
      return res.sendStatus(200);
    }

    const sorteo = sorteoSnap.data();
    const offset = sorteo.chancesVendidas?.length || 0;

    const nuevasChances = [];

    for (let i = 0; i < cantidad; i++) {
      const numero = offset + 1 + i;
      nuevasChances.push({
        numero,
        telefono,
        sorteoId,
        createdAt: new Date().toISOString()
      });
    }

    await sorteoRef.update({
      chancesVendidas: [...(sorteo.chancesVendidas || []), ...nuevasChances]
    });

    await db.collection("compras").doc(compraId).update({
      status: "approved",
      chances: nuevasChances,
      mpPaymentId: paymentId
    });

    console.log("✔ Chances asignadas correctamente");

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Error webhook:", err);
    res.sendStatus(500);
  }
});

export default router;
