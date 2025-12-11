// FILE: /web/sorteoslxm-server-clean/routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   OBTENER TOKEN SEGÚN LA CUENTA
   - mpCuenta: "1" o "2" or string stored in sorteo.mpCuenta
=========================================================== */
function getToken(mpCuenta) {
  // En tu firebase guardás strings como "MERCADOPAGO_ACCESS_TOKEN_1"
  // o directamente "1". Aceptamos varias formas:
  if (!mpCuenta) return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
  // Si el valor es literalmente la variable de entorno (ej: "MERCADOPAGO_ACCESS_TOKEN_1")
  if (mpCuenta.startsWith("MERCADOPAGO_ACCESS_TOKEN_")) {
    const envName = mpCuenta;
    return process.env[envName] || null;
  }
  // Si guardaste "1" o "2"
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2 || null;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1 || null;
}

/* ===========================================================
   CREAR PREFERENCIA (INCLUYE external_reference = compraId)
=========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad = 1, telefono, titulo, precio } = req.body;

    if (!sorteoId) return res.status(400).json({ error: "Falta sorteoId" });

    const snap = await db.collection("sorteos").doc(sorteoId).get();
    if (!snap.exists) return res.status(404).json({ error: "Sorteo no encontrado" });

    const sorteo = snap.data();
    const mpCuenta = String(sorteo.mpCuenta || req.body.mpCuenta || "1");
    const token = getToken(mpCuenta);

    if (!token) {
      console.error("❌ Token MP no encontrado para mpCuenta:", mpCuenta);
      return res.status(500).json({ error: "Token MP no configurado" });
    }

    // cliente SDK v2
    const client = new MercadoPagoConfig({
      accessToken: token,
    });
    const prefClient = new Preference(client);

    // ---- Crear compra preliminar (para tener un id interno, que usaremos como external_reference)
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

    // ---- Crear preferencia incluyendo external_reference = compraId
    const response = await prefClient.create({
      body: {
        items: [
          {
            title: titulo || `Chance - ${sorteo.titulo || sorteoId}`,
            quantity: Number(cantidad),
            unit_price: Number(precio || sorteo.precio || 0),
            currency_id: "ARS",
          },
        ],
        metadata: {
          sorteoId,
          compraId,
          cantidad: Number(cantidad),
          telefono: telefono || null,
          mpCuenta,
        },
        external_reference: compraId, // <- esto te pidió MP
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending",
        },
        auto_return: "approved",
        notification_url:
          "https://sorteoslxm-server-clean.onrender.com/webhook-pago", // tu webhook real
      },
    });

    // Guardar preference id / init_point en la compra
    await compraRef.update({
      mpPreferenceId: response.id || response.body?.id || null,
      mpInitPoint: response.init_point || response.body?.init_point || null,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      id: response.id || response.body?.id,
      init_point: response.init_point || response.body?.init_point,
      compraId,
    });
  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err);
    return res.status(500).json({ error: "Error creando preferencia" });
  }
});

export default router;
