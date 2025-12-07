// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";

const router = express.Router();

// Cargar ambas cuentas (si están definidas)
const TOKEN1 = process.env.MERCADOPAGO_ACCESS_TOKEN_1;
const TOKEN2 = process.env.MERCADOPAGO_ACCESS_TOKEN_2;

if (!TOKEN1) console.log("⚠ No se encontró MERCADOPAGO_ACCESS_TOKEN_1");
if (!TOKEN2) console.log("⚠ No se encontró MERCADOPAGO_ACCESS_TOKEN_2");

// Crear clientes separados
const client1 = TOKEN1 ? new MercadoPagoConfig({ accessToken: TOKEN1 }) : null;
const client2 = TOKEN2 ? new MercadoPagoConfig({ accessToken: TOKEN2 }) : null;

// Elegir cuenta según el sorteo
function seleccionarCliente(sorteoId) {
  if (String(sorteoId).endsWith("A")) return client1;  // ejemplo
  if (String(sorteoId).endsWith("B")) return client2;  // ejemplo

  // fallback
  return client1 || client2;
}

router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, telefono, sorteoId } = req.body;

    // Seleccionar automáticamente el cliente correcto
    const client = seleccionarCliente(sorteoId);

    if (!client) {
      return res.status(500).json({ error: "No hay cliente MP configurado." });
    }

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
          cantidad
        },
      },
    });

    console.log("✔ Preferencia creada:", preference.id);

    res.json({
      init_point: preference.init_point,
      preferenceId: preference.id,
    });

  } catch (error) {
    console.error("❌ ERROR CREAR PREFERENCIA:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
