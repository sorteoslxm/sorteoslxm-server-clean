// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";
import mercadopago from "mercadopago";

const router = express.Router();

/**
 * POST /compras
 * Crea un documento de compra y genera la preferencia de MercadoPago
 * BODY esperado:
 * {
 *   nombre,
 *   apellido,
 *   email,
 *   telefono,
 *   sorteoId,
 *   cantidad
 * }
 */

router.post("/", async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, sorteoId, cantidad } = req.body;

    if (!sorteoId || !cantidad) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // obtener sorteo
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    const sorteoSnap = await sorteoRef.get();

    if (!sorteoSnap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const sorteo = sorteoSnap.data();

    // precio por chance
    const precioUnidad = Number(sorteo.precio) || 0;
    const totalAPagar = precioUnidad * cantidad;

    // Crear documento compra (estado: pending)
    const compraData = {
      nombre,
      apellido,
      email,
      telefono,
      sorteoId,
      cantidad,
      total: totalAPagar,
      status: "pending",
      createdAt: Date.now(),
    };

    const compraRef = await db.collection("compras").add(compraData);
    const compraId = compraRef.id;

    // TOKEN MercadoPago
    const token =
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      Object.values(process.env).find((k) => k && k.includes("MERCADOPAGO"));

    if (!token) {
      console.error("No access token");
      return res.status(500).json({ error: "MP Token faltante" });
    }

    mercadopago.configure({ access_token: token });

    // Crear preferencia MP
    const preference = {
      items: [
        {
          title: `Compra de chances (${cantidad}) – ${sorteo.titulo}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: totalAPagar,
        },
      ],
      back_urls: {
        success: `${process.env.CLIENT_URL}/pago-exitoso`,
        pending: `${process.env.CLIENT_URL}/pago-pendiente`,
        failure: `${process.env.CLIENT_URL}/pago-error`,
      },
      auto_return: "approved",

      external_reference: compraId, // muy importante
    };

    const mpRes = await mercadopago.preferences.create(preference);

    // guardar mpPreferenceId
    await compraRef.update({
      mpPreferenceId: mpRes.body.id,
    });

    res.json({
      ok: true,
      init_point: mpRes.body.init_point,
      compraId,
    });
  } catch (err) {
    console.error("Error en /compras:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
