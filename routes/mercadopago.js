// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";

const router = express.Router();

router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, mpCuenta } = req.body;

    // Elegimos el token según el campo mpCuenta
    let accessToken;
    if (mpCuenta === "CUENTA_1") accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN_1;
    else if (mpCuenta === "CUENTA_2") accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN_2;
    else return res.status(400).json({ error: "Cuenta de MercadoPago inválida" });

    mercadopago.configurations.setAccessToken(accessToken);

    const preference = {
      items: [
        {
          title: titulo,
          quantity: 1,
          unit_price: Number(precio),
        },
      ],
      back_urls: {
        success: "https://sorteoslxm.com/pago-exito",
        pending: "https://sorteoslxm.com/pago-pendiente",
        failure: "https://sorteoslxm.com/pago-error",
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({ id: response.body.id, init_point: response.body.init_point });
  } catch (err) {
    console.error("❌ Error al crear preferencia:", err);
    res.status(500).json({ error: "Error al crear preferencia" });
  }
});

export default router;
