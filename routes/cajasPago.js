import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";

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
    const { cajaId, titulo, precio } = req.body;

    if (!precio) {
      return res.status(400).json({ error: "Precio requerido" });
    }

    const result = await preference.create({
      body: {
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
      },
    });

    res.json({
      init_point: result.init_point,
    });
  } catch (err) {
    console.error("❌ Error MP caja:", err);
    res.status(500).json({ error: "Error creando pago" });
  }
});

export default router;
