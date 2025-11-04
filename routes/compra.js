// server/routes/compra.js
import express from "express";
import admin from "../config/firebase.js";
import fetch from "node-fetch";

const router = express.Router();

// POST /compra
router.post("/", async (req, res) => {
  try {
    const { sorteoId, cantidad, usuario } = req.body;

    if (!sorteoId || !cantidad || !usuario) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // Guardar intención de compra en Firebase
    const docRef = admin.firestore().collection("compras").doc();
    await docRef.set({
      sorteoId,
      cantidad,
      usuario,
      estado: "pendiente",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Crear preferencia de pago con MercadoPago
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: `Tickets Sorteo ${sorteoId}`,
            quantity: cantidad,
            currency_id: "ARS",
            unit_price: 100, // ajustar según precio
          },
        ],
        back_urls: {
          success: "https://tu-frontend.com/pago-exitoso",
          failure: "https://tu-frontend.com/pago-fallido",
          pending: "https://tu-frontend.com/pago-pendiente",
        },
        auto_return: "approved",
      }),
    });

    const mpData = await mpResponse.json();

    res.json({ id: docRef.id, mpPreferenceId: mpData.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear compra" });
  }
});

export default router;
