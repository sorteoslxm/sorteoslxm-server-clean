// FILE: routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   OBTENER TOKEN SEGÚN LA CUENTA
=========================================================== */
function getToken(mpCuenta) {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
    : process.env.MERCADOPAGO_ACCESS_TOKEN_1; // 🔥 ARREGLADO (mercadoPago)
}

/* ===========================================================
   CREAR PREFERENCIA
=========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad, telefono } = req.body;

    // Obtener sorteo
    const snap = await db.collection("sorteos").doc(sorteoId).get();
    if (!snap.exists)
      return res.status(404).json({ error: "Sorteo no encontrado" });

    const sorteo = snap.data();

    // Cuenta MP asignada al sorteo
    const mpCuenta = String(sorteo.mpCuenta || "1");

    // Token según la cuenta
    const token = getToken(mpCuenta);

    if (!token) {
      console.error("❌ TOKEN no encontrado para mpCuenta =", mpCuenta);
      return res
        .status(500)
        .json({ error: "TOKEN de MercadoPago no configurado" });
    }

    // Configurar SDK
    mercadopago.configure({ access_token: token });

    // Crear la compra en la base
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date(),
    });

    const compraId = compraRef.id;

    // Crear preferencia de pago
    const preference = await mercadopago.preferences.create({
      items: [
        {
          title: `Chances Sorteo ${sorteo.titulo}`,
          quantity: Number(cantidad),
          unit_price: Number(sorteo.precio),
          currency_id: "ARS",
        },
      ],
      metadata: { sorteoId, compraId, cantidad, telefono, mpCuenta },

      back_urls: {
        success: "https://sorteoslxm.com/success",
        failure: "https://sorteoslxm.com/failure",
        pending: "https://sorteoslxm.com/pending",
      },
      auto_return: "approved",

      // 🔥 Webhook OFICIAL (lo maneja webhook-pago.js)
      notification_url:
        "https://sorteoslxm-server-clean.onrender.com/mercadopago/webhook",
    });

    // Guardar ID de preferencia en la compra
    await compraRef.update({
      mpPreferenceId: preference.response.id,
    });

    // Respuesta al frontend
    res.json({
      ok: true,
      id: preference.response.id,
      init_point: preference.response.init_point,
    });
  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err.response || err);
    res.status(500).json({ error: "Error al crear la preferencia" });
  }
});

export default router;
