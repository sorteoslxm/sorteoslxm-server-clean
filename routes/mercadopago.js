// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   TOKEN SEGÚN LA CUENTA
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
    if (!snap.exists)
      return res.status(404).json({ error: "Sorteo no encontrado" });

    const sorteo = snap.data();
    const mpCuenta = String(sorteo.mpCuenta || "1");

    const token = getToken(mpCuenta);
    if (!token) return res.status(500).json({ error: "Token MP no configurado" });

    // SDK v2
    const client = new MercadoPagoConfig({
      accessToken: token,
    });

    const preference = new Preference(client);

    // Crear registro compra
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date(),
    });

    const compraId = compraRef.id;

    // Crear preferencia
    const response = await preference.create({
      body: {
        items: [
          {
            title: `Chances Sorteo ${sorteo.titulo}`,
            quantity: Number(cantidad),
            unit_price: Number(sorteo.precio),
          },
        ],
        metadata: { sorteoId, compraId, cantidad, telefono, mpCuenta },
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending",
        },
        auto_return: "approved",
        notification_url:
          "https://sorteoslxm-server-clean.onrender.com/mercadopago/webhook",
      },
    });

    // Guardar preferenceId
    await compraRef.update({ mpPreferenceId: response.id });

    res.json({
      ok: true,
      id: response.id,
      init_point: response.init_point,
    });
  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
