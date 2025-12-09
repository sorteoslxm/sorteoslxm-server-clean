// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   🔵 RESOLVER TOKEN SEGÚN CUENTA
================================= */
function resolveTokenForAccount(mpCuenta) {
  if (!mpCuenta) {
    return (
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
      null
    );
  }

  if (process.env[mpCuenta]) return process.env[mpCuenta];

  if (mpCuenta === "1") return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;

  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
    process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
    null
  );
}

/* ================================
   🟦 CREAR PREFERENCIA
================================= */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, telefono, sorteoId, mpCuenta } = req.body;

    if (!sorteoId || !precio || !telefono) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const token = resolveTokenForAccount(mpCuenta);
    if (!token) return res.status(500).json({ error: "Token MP no configurado" });

    const client = new MercadoPagoConfig({ accessToken: token });
    const preferenceClient = new Preference(client);

    const pref = await preferenceClient.create({
      body: {
        items: [
          {
            title: titulo,
            unit_price: Number(precio),
            quantity: Number(cantidad),
            currency_id: "ARS",
          },
        ],
        metadata: {
          telefono,
          sorteoId,
          cantidad,
          mpCuenta: mpCuenta || null,
        },
        back_urls: {
          success: "https://www.sorteoslxm.com/success",
          failure: "https://www.sorteoslxm.com/error",
          pending: "https://www.sorteoslxm.com/pending",
        },
        auto_return: "approved",
        notification_url: "https://sorteoslxm-server-clean.onrender.com/webhook-pago",
      },
    });

    // 🔵 GUARDAR PRECARGA
    const compraRef = await db.collection("compras").add({
      sorteoId,
      telefono,
      cantidad: Number(cantidad),
      precio: Number(precio),
      titulo,
      status: "pending",
      mpPreferenceId: pref.id,
      createdAt: Date.now(),
    });

    return res.json({
      ok: true,
      preferenceId: pref.id,
      init_point: pref.init_point,
    });

  } catch (e) {
    console.error("ERROR PREF:", e);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
