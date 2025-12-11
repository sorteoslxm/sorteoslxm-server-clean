// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";

const router = express.Router();

function getMPClient() {
  if (!process.env.MP_ACCESS_TOKEN) {
    console.error("❌ No existe MP_ACCESS_TOKEN en .env");
    throw new Error("Falta MP_ACCESS_TOKEN");
  }

  // Cliente oficial MercadoPago v2
  return new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
  });
}

// Crear preferencia
router.post("/crear-preferencia", async (req, res) => {
  try {
    console.log("📥 Body recibido:", req.body);

    const { titulo, precio, emailComprador, sorteoId } = req.body;

    const client = getMPClient();
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: sorteoId,
            title: titulo,
            quantity: 1,
            unit_price: Number(precio),
          },
        ],
        payer: {
          email: emailComprador || "",
        },
        metadata: {
          sorteoId,
        },
        back_urls: {
          success: "https://sorteoslxm.com/gracias",
          failure: "https://sorteoslxm.com/error",
          pending: "https://sorteoslxm.com/pendiente",
        },
        auto_return: "approved",
      },
    });

    console.log("📤 MP Preference creada:", result);
    return res.json({ id: result.id });
  } catch (error) {
    console.error("❌ ERROR MP crear preferencia:", error);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
