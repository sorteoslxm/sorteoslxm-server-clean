// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * POST /mercadopago/crear-preferencia
 * Body: { titulo, precio, mpCuenta, sorteoId, telefono }
 *
 * Flujo:
 * 1) Creamos un documento en /compras (status: pending)
 * 2) Creamos la preferencia en MercadoPago con external_reference = purchaseId
 * 3) Actualizamos la compra con mpPreferenceId e init_point
 * 4) Respondemos init_point al frontend para redirigir al checkout
 */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, mpCuenta, sorteoId, telefono } = req.body;

    // 1) token según mpCuenta (ej: "MERCADOPAGO_ACCESS_TOKEN_1")
    const token = process.env[mpCuenta];
    if (!token) return res.status(400).json({ error: "Cuenta MercadoPago inválida" });

    // 2) crear documento compra PENDING en Firestore
    const compraRef = await db.collection("compras").add({
      sorteoId: sorteoId || null,
      precio: Number(precio) || 0,
      telefono: telefono || "",
      estado: "pending",
      createdAt: Date.now(),
    });

    const purchaseId = compraRef.id;

    // 3) configurar mercadopago con el token seleccionado
    mercadopago.configure({ access_token: token });

    // 4) crear preferencia con external_reference = purchaseId
    const preference = {
      items: [
        {
          title: titulo || "Sorteo",
          unit_price: Number(precio) || 0,
          quantity: 1,
        },
      ],
      external_reference: purchaseId,
      back_urls: {
        success: "https://sorteoslxm.com/pago-exito",
        pending: "https://sorteoslxm.com/pago-pendiente",
        failure: "https://sorteoslxm.com/pago-error",
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);

    // 5) guardar datos de preferencia en la compra
    await compraRef.update({
      mpPreferenceId: response.body.id,
      init_point: response.body.init_point,
      estado: "pending",
      mpAccount: mpCuenta || "",
    });

    // 6) responder init_point
    res.json({
      success: true,
      id: response.body.id,
      init_point: response.body.init_point,
      purchaseId,
    });
  } catch (err) {
    console.error("ERROR crear-preferencia:", err);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
