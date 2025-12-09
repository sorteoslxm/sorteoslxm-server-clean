// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   TOKEN SEGÚN CUENTA
================================= */
function getToken(mpCuenta) {
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ================================
   CREAR PREFERENCIA
================================= */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad, telefono, mpCuenta } = req.body;

    if (!sorteoId || !cantidad) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // Seleccionar token según la cuenta
    const accessToken = getToken(mpCuenta);
    if (!accessToken) {
      return res.status(500).json({ error: "Falta token MP" });
    }

    const mpClient = new MercadoPagoConfig({ accessToken });
    const preferenceClient = new Preference(mpClient);

    /* ================================
        OBTENER PRECIO REAL DEL SORTEO
    ================================= */
    const sorteoSnap = await db.collection("sorteos").doc(sorteoId).get();
    if (!sorteoSnap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const sorteoData = sorteoSnap.data();
    const precio = Number(sorteoData.precio);

    if (!precio || precio <= 0) {
      return res.status(400).json({ error: "Precio inválido en el sorteo" });
    }

    /* ================================
        CREAR COMPRA PRELIMINAR
    ================================= */
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta: mpCuenta || "1",
      status: "pendiente",
      createdAt: new Date()
    });

    const compraId = compraRef.id;

    /* ================================
        CREAR PREFERENCIA MP
    ================================= */
    const pref = await preferenceClient.create({
      body: {
        items: [
          {
            title: `Chances Sorteo ${sorteoData.titulo || sorteoId}`,
            quantity: cantidad,
            unit_price: precio,
            currency_id: "ARS"
          }
        ],
        metadata: {
          sorteoId,
          cantidad,
          telefono,
          compraId,
          mpCuenta
        },
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending"
        },
        auto_return: "approved",
        notification_url:
          "https://sorteoslxm-server-clean.onrender.com/webhook-pago"
      }
    });

    await compraRef.update({
      mpPreferenceId: pref.id
    });

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
