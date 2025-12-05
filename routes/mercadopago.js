// FILE: routes/mercadopago.js
import express from "express";
import { db } from "../config/firebase.js";
import dotenv from "dotenv";

import MercadoPagoConfig from "mercadopago";
import Preference from "mercadopago/dist/clients/preference/index.js";

dotenv.config();
const router = express.Router();

router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, sorteoId, telefono, mpCuenta } = req.body;

    if (!sorteoId || !precio || !telefono || !cantidad)
      return res.status(400).json({ error: "Faltan datos obligatorios" });

    const sorteoDoc = await db.collection("sorteos").doc(sorteoId).get();
    if (!sorteoDoc.exists)
      return res.status(404).json({ error: "Sorteo no encontrado" });

    const accessToken =
      process.env[mpCuenta] ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2;

    if (!accessToken)
      return res.status(500).json({ error: "Token MP no encontrado" });

    console.log("🟢 Token MercadoPago usado:", accessToken);

    // 🔵 SDK CONFIG V2 === CORRECTO
    const mp = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(mp);

    // Crear preferencia
    const prefResponse = await preference.create({
      body: {
        items: [
          {
            title: titulo,
            unit_price: Number(precio),
            quantity: Number(cantidad),
          },
        ],
        metadata: { telefono, sorteoId, cantidad },
        back_urls: {
          success: `https://sorteoslxm.com/pago/exito?sorteo=${sorteoId}`,
          failure: `https://sorteoslxm.com/pago/error?sorteo=${sorteoId}`,
          pending: `https://sorteoslxm.com/pago/pendiente?sorteo=${sorteoId}`,
        },
        auto_return: "approved",
      },
    });

    // GUARDAR COMPRA PRELIMINAR
    await db.collection("compras").add({
      sorteoId,
      telefono,
      cantidad,
      precio,
      titulo,
      status: "pending",
      mpPreferenceId: prefResponse.id,
      createdAt: Date.now(),
    });

    return res.json({
      ok: true,
      preferenceId: prefResponse.id,
      init_point: prefResponse.init_point,
    });
  } catch (err) {
    console.error("❌ ERROR CREAR PREFERENCIA:", err);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
