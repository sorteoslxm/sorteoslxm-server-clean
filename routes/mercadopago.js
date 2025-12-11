// FILE: routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   Obtener token según la cuenta guardada en el sorteo
   - sorteo.mpCuenta debe ser "1" o "2" OR the env key name (we accept both)
=========================================================== */
function getToken(mpCuenta) {
  // Si guardaste la variable directamente como "MERCADOPAGO_ACCESS_TOKEN_1"
  if (mpCuenta === "MERCADOPAGO_ACCESS_TOKEN_2" || mpCuenta === "2") {
    return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  }
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

/* ===========================================================
   POST /mercadopago/crear-preferencia
   Body: { sorteoId, cantidad, telefono, titulo, precio }
=========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad = 1, telefono, titulo, precio } = req.body;

    if (!sorteoId) return res.status(400).json({ error: "Falta sorteoId" });

    const snap = await db.collection("sorteos").doc(sorteoId).get();
    if (!snap.exists) return res.status(404).json({ error: "Sorteo no encontrado" });

    const sorteo = snap.data();
    const mpCuenta = sorteo.mpCuenta || req.body.mpCuenta || "1";
    const token = getToken(mpCuenta);

    if (!token) {
      console.error("❌ Token MP no encontrado para cuenta:", mpCuenta);
      return res.status(500).json({ error: "Token MP no configurado" });
    }

    // Configurar SDK con el token correspondiente
    mercadopago.configure({ access_token: token });

    // Crear pre-registro de compra (antes de redirigir)
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad: Number(cantidad),
      telefono: telefono || null,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const compraId = compraRef.id;

    // Crear preferencia en MercadoPago
    const prefBody = {
      items: [
        {
          id: sorteoId,
          title: titulo || `Chances Sorteo ${sorteo.titulo || ""}`,
          quantity: Number(cantidad),
          unit_price: Number(precio || sorteo.precio || 0),
          currency_id: "ARS",
        },
      ],
      metadata: {
        sorteoId,
        compraId,
        cantidad: Number(cantidad),
        telefono,
        mpCuenta,
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL || "https://sorteoslxm.com"}/success`,
        failure: `${process.env.FRONTEND_URL || "https://sorteoslxm.com"}/failure`,
        pending: `${process.env.FRONTEND_URL || "https://sorteoslxm.com"}/pending`,
      },
      auto_return: "approved",
      // punto de notificación público: (/webhook-pago está usado por el servidor)
      notification_url:
        `${process.env.BACKEND_URL || "https://sorteoslxm-server-clean.onrender.com"}/webhook-pago`,
    };

    const prefResp = await mercadopago.preferences.create(prefBody);

    // robustez: distintos formatos de respuesta según versión SDK
    const prefId =
      prefResp?.response?.id || prefResp?.body?.id || prefResp?.id || null;
    const initPoint =
      prefResp?.response?.init_point || prefResp?.body?.init_point || prefResp?.init_point || null;

    if (!prefId) {
      console.error("❌ Preferencia MP no creada:", prefResp);
      return res.status(500).json({ error: "No se pudo crear preferencia" });
    }

    // Guardar preference id en la compra preliminar
    await compraRef.update({
      mpPreferenceId: prefId,
      mpInitPoint: initPoint,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      id: prefId,
      init_point: initPoint,
      compraId,
    });
  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err?.response?.data || err);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
