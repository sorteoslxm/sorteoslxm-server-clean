// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
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

    const sorteoSnap = await db.collection("sorteos").doc(sorteoId).get();
    if (!sorteoSnap.exists) return res.status(404).json({ error: "Sorteo no existe" });

    const sorteo = sorteoSnap.data();
    const mpCuenta = sorteo.mpCuenta || "1";     // ← LA CUENTA DEL SORTEO
    const precio = Number(sorteo.precio || 0);

    const token = getToken(mpCuenta);
    const mp = new MercadoPagoConfig({ accessToken: token });
    const prefClient = new Preference(mp);

    // crear compra preliminar
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date()
    });

    const compraId = compraRef.id;

    // crear preferencia
    const pref = await prefClient.create({
      body: {
        items: [
          {
            title: `Chances Sorteo ${sorteo.titulo || sorteoId}`,
            quantity: cantidad,
            unit_price: precio,
            currency_id: "ARS"
          }
        ],
        metadata: {
          sorteoId,
          compraId,
          cantidad,
          telefono,
          mpCuenta      // ← SUPER IMPORTANTE
        },
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending"
        },
        auto_return: "approved",
        notification_url: "https://sorteoslxm-server-clean.onrender.com/webhook-pago"
      }
    });

    await compraRef.update({ mpPreferenceId: pref.id });

    res.json({
      ok: true,
      id: pref.id,
      init_point: pref.init_point
    });
  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
