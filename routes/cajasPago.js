import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

/* ======================================
   💳 CREAR PAGO CAJA
   POST /cajas/pago
====================================== */
router.post("/pago", async (req, res) => {
  try {
    const { cajaId, titulo, precio } = req.body;

    const preference = {
      items: [
        {
          title: titulo || "Caja sorpresa",
          quantity: 1,
          unit_price: Number(precio),
        },
      ],
      metadata: {
        cajaId,
      },
      back_urls: {
        success: `${process.env.FRONT_URL}/success`,
        failure: `${process.env.FRONT_URL}/pago/error`,
        pending: `${process.env.FRONT_URL}/pago/pendiente`,
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({
      init_point: response.body.init_point,
    });
  } catch (err) {
    console.error("❌ Error MP caja:", err);
    res.status(500).json({ error: "Error creando pago" });
  }
});

export default router;
