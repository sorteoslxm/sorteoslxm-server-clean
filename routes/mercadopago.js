// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * Resolución del token según mpCuenta enviada por frontend o por fallback
 * mpCuenta puede ser: "1", "2", "MERCADOPAGO_ACCESS_TOKEN_1", "MERCADOPAGO_ACCESS_TOKEN_2", o nombre de var.
 */
function resolveTokenForAccount(mpCuenta) {
  if (!mpCuenta) {
    return (
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
      process.env.MP_ACCESS_TOKEN ||
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      null
    );
  }

  // Si envían directamente el nombre de la variable de entorno (ej: MERCADOPAGO_ACCESS_TOKEN_2)
  if (process.env[mpCuenta]) return process.env[mpCuenta];

  // Si envían "1" o "2"
  if (mpCuenta === "1") return process.env.MERCADOPAGO_ACCESS_TOKEN_1 || null;
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2 || null;

  // Si envían "M1" / "M2"
  if (mpCuenta.toLowerCase() === "m1") return process.env.MERCADOPAGO_ACCESS_TOKEN_1 || null;
  if (mpCuenta.toLowerCase() === "m2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2 || null;

  // Fallback general
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
    process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
    process.env.MP_ACCESS_TOKEN ||
    null
  );
}

router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, cantidad = 1, telefono, sorteoId, mpCuenta } = req.body;

    if (!sorteoId || !precio || !telefono) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // resolver token según mpCuenta
    const token = resolveTokenForAccount(mpCuenta);

    if (!token) {
      console.error("❌ No hay token MP disponible para crear preferencia");
      return res.status(500).json({ error: "No se encontró token de MercadoPago" });
    }

    console.log("🔑 Crear preferencia con token (slice):", token.slice(0, 12), " mpCuenta:", mpCuenta || "fallback");

    const client = new MercadoPagoConfig({ accessToken: token });
    const preferenceClient = new Preference(client);

    const preferenceBody = {
      items: [
        {
          title: titulo,
          unit_price: Number(precio),
          quantity: Number(cantidad),
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: `https://www.sorteoslxm.com/success`,
        failure: `https://www.sorteoslxm.com/error`,
        pending: `https://www.sorteoslxm.com/pending`,
      },
      auto_return: "approved",
      metadata: { telefono, sorteoId, cantidad, mpAccount: mpCuenta || null },
    };

    const prefResponse = await preferenceClient.create({ body: preferenceBody });

    // Guardar compra preliminar en Firestore con mpAccount y mpPreferenceId
    const compraPre = {
      sorteoId,
      telefono,
      cantidad: Number(cantidad),
      precio: Number(precio),
      titulo,
      status: "pending",
      mpPreferenceId: prefResponse.id,
      mpAccount: mpCuenta || (token === process.env.MERCADOPAGO_ACCESS_TOKEN_2 ? "2" : "1"),
      createdAt: Date.now(),
    };

    const compraRef = await db.collection("compras").add(compraPre);

    console.log("✔ Compra preliminar guardada:", compraRef.id, "pref:", prefResponse.id);

    return res.json({
      ok: true,
      preferenceId: prefResponse.id,
      init_point: prefResponse.init_point,
    });
  } catch (err) {
    console.error("❌ ERROR CREAR PREFERENCIA:", err);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
