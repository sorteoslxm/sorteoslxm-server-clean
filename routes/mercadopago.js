// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadapopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   TOKEN SEGÚN CUENTA
=========================================================== */
function getToken(mpCuenta) {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
    : process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ===========================================================
   CREAR PREFERENCIA
=========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad, telefono } = req.body;

    const snap = await db.collection("sorteos").doc(sorteoId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const sorteo = snap.data();
    const mpCuenta = String(sorteo.mpCuenta || "1");
    const token = getToken(mpCuenta);

    if (!token) {
      return res.status(500).json({ error: "No se encontró MERCADOPAGO_ACCESS_TOKEN" });
    }

    const client = new MercadoPagoConfig({
      accessToken: token
    });

    const preference = new Preference(client);

    // Guardar compra preliminar
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date(),
    });

    const compraId = compraRef.id;

    const pref = await preference.create({
      body: {
        items: [
          {
            title: `Chances Sorteo ${sorteo.titulo || "Sorteo"}`,
            quantity: Number(cantidad),
            unit_price: Number(sorteo.precio),
            currency_id: "ARS"
          }
        ],
        metadata: {
          sorteoId,
          compraId,
          cantidad,
          telefono,
          mpCuenta
        },
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending"
        },
        auto_return: "approved"
      }
    });

    await compraRef.update({
      mpPreferenceId: pref.id
    });

    return res.json({
      ok: true,
      id: pref.id,
      init_point: pref.init_point
    });

  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err.response?.data || err);
    return res.status(500).json({ error: "Error al crear preferencia" });
  }
});

export default router;
