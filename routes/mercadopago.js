// FILE: web/sorteoslxm-server-clean/routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import dotenv from "dotenv";
import { db } from "../config/firebase.js";

dotenv.config();
const router = express.Router();

/* ==========================================================
   🟦 Crear preferencia de pago
========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, sorteoId, telefono, mpCuenta } = req.body;

    if (!sorteoId || !precio || !telefono)
      return res.status(400).json({ error: "Faltan datos" });

    // Elegir cuenta segun admin
    const accessToken = process.env[mpCuenta] || process.env.MERCADOPAGO_ACCESS_TOKEN_1;

    mercadopago.configure({ access_token: accessToken });

    const preference = {
      items: [
        {
          title: titulo,
          unit_price: Number(precio),
          quantity: Number(cantidad || 1),
        },
      ],
      back_urls: {
        success: `https://sorteoslxm.com/success?sorteo=${sorteoId}`,
        failure: `https://sorteoslxm.com/failure?sorteo=${sorteoId}`,
        pending: `https://sorteoslxm.com/pending?sorteo=${sorteoId}`,
      },
      auto_return: "approved",

      metadata: {
        telefono,
        sorteoId,
      },
    };

    const preferenceResult = await mercadopago.preferences.create(preference);

    res.json({
      ok: true,
      preference: preferenceResult.body,
    });

  } catch (e) {
    console.error("❌ ERROR CREAR PREFERENCIA:", e);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
