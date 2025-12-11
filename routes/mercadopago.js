// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";

const router = express.Router();

// Inicialización nueva del SDK
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

router.post("/crear-preferencia", async (req, res) => {
  try {
    const { title, quantity, price } = req.body;

    const preference = await new Preference(client).create({
      body: {
        items: [
          {
            title,
            quantity,
            unit_price: Number(price),
          },
        ],
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending",
        },
        auto_return: "approved",
      },
    });

    return res.json({ preferenceId: preference.id });

  } catch (error) {
    console.error("❌ ERROR crear preferencia:", error);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
