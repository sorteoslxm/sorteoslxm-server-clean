// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";

const router = express.Router();

// ⭐ Detectar token automáticamente desde cualquier variable
const ACCESS_TOKEN =
  process.env.MP_ACCESS_TOKEN ||
  process.env.MERCADOPAGO_ACCESS_TOKEN ||
  process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
  process.env.MP_TOKEN ||
  null;

if (!ACCESS_TOKEN) {
  console.error("❌ No se encontró ningún Access Token de MercadoPago en las variables de entorno.");
}

// ⭐ Cliente MP
const client = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN,
});

// ⭐ Crear preferencia
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, telefono, sorteoId } = req.body;

    const preference = await new Preference(client).create({
      body: {
        items: [
          {
            title: titulo,
            quantity: Number(cantidad),
            unit_price: Number(precio),
          },
        ],
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/error",
          pending: "https://sorteoslxm.com/pending",
        },
        auto_return: "approved",
        metadata: {
          sorteoId,
          telefono,
        },
      },
    });

    console.log("MP Preference creada:", preference);

    res.json({
      init_point: preference.init_point,
      preferenceId: preference.id,
    });

  } catch (error) {
    console.error("❌ ERROR CREAR PREFERENCIA:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

// ⭐ Webhook (opcional)
router.post("/webhook", (req, res) => {
  console.log("📩 Webhook recibido:", req.body);
  res.sendStatus(200);
});

export default router;
