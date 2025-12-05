// FILE: routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import dotenv from "dotenv";
import { db } from "../config/firebase.js";

dotenv.config();
const router = express.Router();

/* ==========================================================
   🟦 Crear preferencia + guardar compra preliminar
========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, sorteoId, telefono, mpCuenta } = req.body;

    // Validaciones básicas
    if (!sorteoId || !precio || !telefono || !cantidad)
      return res.status(400).json({ error: "Faltan datos obligatorios" });

    // Obtener sorteo
    const sorteoDoc = await db.collection("sorteos").doc(sorteoId).get();
    if (!sorteoDoc.exists) return res.status(404).json({ error: "Sorteo no encontrado" });

    // Selección de token según la cuenta
    const accessToken =
      process.env[mpCuenta] ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2;

    if (!accessToken) return res.status(500).json({ error: "No se encontró token de MercadoPago" });

    console.log("🟢 Token de MercadoPago usado:", mpCuenta, accessToken);

    // ✅ Versión 2.11.0: configurar MercadoPago
    mercadopago.configure({
      access_token: accessToken
    });

    // Crear preferencia
    const preference = {
      items: [
        { title: titulo, unit_price: Number(precio), quantity: Number(cantidad) },
      ],
      back_urls: {
        success: `https://sorteoslxm.com/pago/exito?sorteo=${sorteoId}`,
        failure: `https://sorteoslxm.com/pago/error?sorteo=${sorteoId}`,
        pending: `https://sorteoslxm.com/pago/pendiente?sorteo=${sorteoId}`,
      },
      auto_return: "approved",
      metadata: { telefono, sorteoId, cantidad },
    };

    const prefResponse = await mercadopago.preferences.create(preference);

    // Guardar compra preliminar en Firestore
    const newCompra = {
      sorteoId,
      telefono,
      cantidad,
      precio,
      titulo,
      status: "pending",
      mpPreferenceId: prefResponse.body.id,
      mpAccount: mpCuenta || "default",
      createdAt: Date.now(),
    };

    await db.collection("compras").add(newCompra);

    return res.json({
      ok: true,
      preferenceId: prefResponse.body.id,
      init_point: prefResponse.body.init_point,
    });

  } catch (e) {
    console.error("❌ ERROR CREAR PREFERENCIA:", e);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
