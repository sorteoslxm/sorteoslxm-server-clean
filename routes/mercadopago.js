// FILE: routes/mercadopago.js
import express from "express";
import MercadoPagoConfig, { Preference } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// Tokens de cuentas
const MP_TOKENS = {
  MERCADOPAGO_ACCESS_TOKEN_1: process.env.MERCADOPAGO_ACCESS_TOKEN_1,
  MERCADOPAGO_ACCESS_TOKEN_2: process.env.MERCADOPAGO_ACCESS_TOKEN_2,
  default: process.env.MP_FALLBACK_TOKEN,
};

// 👉 Crear cliente según mpCuenta
function getMPClient(mpCuenta) {
  const token = MP_TOKENS[mpCuenta] || MP_TOKENS.default;
  return new MercadoPagoConfig({ accessToken: token });
}

/* ------------------------------------------------------- */
/*                CREAR PREFERENCIA DE PAGO                 */
/* ------------------------------------------------------- */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, titulo, precio, cantidad, telefono, mpCuenta } = req.body;

    if (!sorteoId || !titulo || !precio || !telefono) {
      console.log("❌ Faltan campos:", req.body);
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const client = getMPClient(mpCuenta);
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: sorteoId,
            title: titulo,
            quantity: cantidad || 1,
            unit_price: Number(precio),
          },
        ],
        metadata: {
          sorteoId,
          telefono,
        },
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending",
        },
        auto_return: "approved",
      },
    });

    return res.json({
      init_point: result.init_point,
      preferenceId: result.id,
    });

  } catch (err) {
    console.error("❌ ERROR MP crear preferencia:", err);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* ------------------------------------------------------- */
/*                        WEBHOOK MP                        */
/* ------------------------------------------------------- */
router.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    if (data.type !== "payment") return res.sendStatus(200);

    const paymentId = data.data.id;

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_FALLBACK_TOKEN}` },
    });

    const pago = await resp.json();

    if (pago.status !== "approved") return res.sendStatus(200);

    const sorteoId = pago.metadata?.sorteoId;
    const telefono = pago.metadata?.telefono;

    if (!sorteoId) return res.sendStatus(200);

    const docRef = db.collection("sorteos").doc(sorteoId);
    const doc = await docRef.get();

    if (!doc.exists) return res.sendStatus(200);

    const datos = doc.data();

    await docRef.update({
      chancesOcupadas: (datos.chancesOcupadas || 0) + 1,
      editedAt: new Date().toISOString(),
    });

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    res.sendStatus(500);
  }
});

export default router;
