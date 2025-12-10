// FILE: routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";
import axios from "axios";

const router = express.Router();

// 🔐 Configurar Mercado Pago
mercadopago.configure({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

// 📌 ENDPOINT: WEBHOOK MP
router.post("/webhook", async (req, res) => {
  try {
    console.log("📥 Webhook recibido:", JSON.stringify(req.body, null, 2));

    const { data, type, resource } = req.body;

    let paymentId = null;

    if (type === "payment" && data?.id) {
      paymentId = data.id;
    }

    if (type === "merchant_order" && data?.id) {
      paymentId = data.id; // Merchant order ID
    }

    if (!paymentId) {
      console.log("⚠ No se pudo obtener paymentId → ignorado");
      return res.status(200).send("OK");
    }

    // 🔍 Obtener detalles actuales desde MercadoPago
    const mpRes = await axios.get(
      `${resource}?access_token=${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
    );

    const mpData = mpRes.data;

    console.log("🔎 MP Payment Data: ", JSON.stringify(mpData, null, 2));

    // Buscar pago aprobado dentro de payments[]
    const pagoAprobado = mpData.payments?.find(p => p.status === "approved");

    if (!pagoAprobado) {
      console.log("❌ No hay pagos aprobados aún. Se espera próximo webhook.");
      return res.status(200).send("OK");
    }

    // Extraer metadata correcta
    const dataMetadata = pagoAprobado.metadata;
    if (!dataMetadata) {
      console.log("⚠ metadata vacía, no se puede registrar.");
      return res.status(200).send("OK");
    }

    const { sorteoId, numero } = dataMetadata;

    if (!sorteoId || !numero) {
      console.log("⚠ metadata incompleta → ignorado");
      return res.status(200).send("OK");
    }

    // Guardar chance aprobada
    console.log("💾 GUARDANDO CHANCE CON METADATA:", dataMetadata);

    await db
      .collection("sorteos")
      .doc(sorteoId)
      .collection("chances")
      .doc(numero.toString())
      .set({
        numero,
        comprador: pagoAprobado.payer.email,
        fecha: new Date().toISOString(),
        paymentId: pagoAprobado.id,
      });

    console.log("✅ Chance guardada correctamente");

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Error leerMerchantOrder:", error);
    return res.status(500).send("Error");
  }
});

export default router;
