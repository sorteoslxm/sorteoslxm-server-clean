// FILE: routes/webhook-pago.js
// WEBHOOK MERCADOPAGO – COMPATIBLE 100%

import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { type, data } = req.body;

    console.log("📥 Webhook recibido:", JSON.stringify(req.body, null, 2));

    if (type !== "payment") return res.sendStatus(200);

    // info del pago desde MP
    const payment = await mercadopago.payment.findById(data.id);
    const meta = payment.body.metadata || {};

    // aceptar ambas formas de metadata (v1 y v2)
    const sorteoId = meta.sorteoId || meta.sorteo_id;
    const compraId = meta.compraId || meta.compra_id;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || meta.tel || null;
    const mpCuenta = meta.mpCuenta || meta.mp_cuenta || "1";

    if (!sorteoId || !compraId || !cantidad) {
      console.log("⚠ metadata incompleta → ignorado", meta);
      return res.sendStatus(200);
    }

    // generar chances
    const chancesRef = db.collection("chances");
    const compraRef = db.collection("compras").doc(compraId);

    const compraSnap = await compraRef.get();
    if (!compraSnap.exists) {
      console.log("⚠ compra no encontrada:", compraId);
      return res.sendStatus(200);
    }

    const compra = compraSnap.data();

    for (let i = 0; i < cantidad; i++) {
      await chancesRef.add({
        sorteoId,
        compraId,
        usuario: compra.usuario || null,
        telefono,
        fecha: new Date(),
        mpCuenta,
      });
    }

    console.log(`✅ ${cantidad} chances generadas para sorteo ${sorteoId}`);

    return res.sendStatus(200);

  } catch (e) {
    console.error("❌ ERROR WEBHOOK:", e);
    return res.sendStatus(500);
  }
});

export default router;
