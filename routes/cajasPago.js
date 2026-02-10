// FILE: routes/cajasPago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/* ============================
   🔑 CONFIG MERCADOPAGO
============================ */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const preference = new Preference(mpClient);

/* ======================================
   💳 CREAR PAGO CAJA
   POST /cajas/pago
====================================== */
router.post("/pago", async (req, res) => {
  try {
    const { cajaId, packId, precio, telefono } = req.body;

    if (!cajaId || !packId || !precio) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // 🔐 id interno del pago
    const pagoId = uuidv4();

    // 🧾 guardamos pago pendiente
    await db.collection("pagosCajas").doc(pagoId).set({
      cajaId,
      packId,
      precio: Number(precio),
      telefono: telefono || null,
      estado: "pendiente",
      creadoEn: new Date(),
    });

    const result = await preference.create({
      body: {
        items: [
          {
            title: "Caja sorpresa",
            quantity: 1,
            unit_price: Number(precio),
          },
        ],
        metadata: {
          pagoId,
          cajaId,
          packId,
        },
        back_urls: {
          success: `${process.env.FRONT_URL}/abrir-caja/${cajaId}?pago=${pagoId}`,
          failure: `${process.env.FRONT_URL}/cajas`,
          pending: `${process.env.FRONT_URL}/cajas`,
        },
        auto_return: "approved",
      },
    });

    res.json({ init_point: result.init_point });
  } catch (err) {
    console.error("❌ Error MP caja:", err);
    res.status(500).json({ error: "Error creando pago" });
  }
});

export default router;
