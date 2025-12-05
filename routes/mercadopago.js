// FILE: routes/mercadopago.js
import express from "express";
import MercadoPago from "mercadopago";
import dotenv from "dotenv";
import { db } from "../config/firebase.js";

dotenv.config();
const router = express.Router();

router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad, sorteoId, telefono, mpCuenta } = req.body;

    if (!sorteoId || !precio || !telefono || !cantidad)
      return res.status(400).json({ error: "Faltan datos obligatorios" });

    const sorteoDoc = await db.collection("sorteos").doc(sorteoId).get();
    if (!sorteoDoc.exists)
      return res.status(404).json({ error: "Sorteo no encontrado" });

    // Token correcto
    const accessToken =
      process.env[mpCuenta] ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2;

    if (!accessToken)
      return res.status(500).json({ error: "No se encontró token de MercadoPago" });

    console.log("🟢 Token MercadoPago usado:", accessToken);

    // ⭐ SDK V2 CORRECTO
    const mp = new MercadoPago({
      accessToken: accessToken,
    });

    const preference = {
      items: [
        {
          title: titulo,
          unit_price: Number(precio),
          quantity: Number(cantidad),
        },
      ],
      back_urls: {
        success: `https://sorteoslxm.com/pago/exito?sorteo=${sorteoId}`,
        failure: `https://sorteoslxm.com/pago/error?sorteo=${sorteoId}`,
        pending: `https://sorteoslxm.com/pago/pendiente?sorteo=${sorteoId}`,
      },
      auto_return: "approved",
      metadata: { telefono, sorteoId, cantidad },
    };

    const prefResponse = await mp.preferences.create({ body: preference });

    // Guardar compra preliminar
    await db.collection("compras").add({
      sorteoId,
      telefono,
      cantidad,
      precio,
      titulo,
      status: "pending",
      mpPreferenceId: prefResponse.id,
      mpAccount: mpCuenta || "default",
      createdAt: Date.now(),
    });

    return res.json({
      ok: true,
      preferenceId: prefResponse.id,
      init_point: prefResponse.init_point,
    });

  } catch (e) {
    console.error("❌ ERROR CREAR PREFERENCIA:", e);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
