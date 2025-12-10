// FILE: routes/mercadopago.js
import express from "express";
import { MercadoPagoConfig, Preference, Payment } from "mercadapago";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===========================================================
   OBTENER TOKEN SEGÚN LA CUENTA  (CORREGIDO NOMBRE)
=========================================================== */
function getToken(mpCuenta) {
  return mpCuenta === "2"
    ? process.env.MERCADOPAGO_ACCESS_TOKEN_2   // CORRECTO
    : process.env.MERCADAPAGO_ACCESS_TOKEN_1; // CORRECTO
}

/* ===========================================================
   CREAR PREFERENCIA
=========================================================== */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { sorteoId, cantidad, telefono } = req.body;

    const snap = await db.collection("sorteos").doc(sorteoId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const sorteo = snap.data();
    const mpCuenta = String(sorteo.mpCuenta || "1");
    const token = getToken(mpCuenta);

    if (!token) {
      return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN no configurado" });
    }

    const client = new MercadoPagoConfig({ accessToken: token });

    const preference = new Preference(client);

    // Crear pre-registro de compra
    const compraRef = await db.collection("compras").add({
      sorteoId,
      cantidad,
      telefono,
      mpCuenta,
      status: "pendiente",
      createdAt: new Date(),
    });

    const compraId = compraRef.id;

    const pref = await preference.create({
      body: {
        items: [
          {
            title: `Chances Sorteo ${sorteo.titulo || "Sorteo"}`,
            quantity: Number(cantidad),
            unit_price: Number(sorteo.precio),
            currency_id: "ARS"
          }
        ],
        metadata: {
          sorteoId,
          compraId,
          cantidad,
          telefono,
          mpCuenta
        },
        back_urls: {
          success: "https://sorteoslxm.com/success",
          failure: "https://sorteoslxm.com/failure",
          pending: "https://sorteoslxm.com/pending"
        },
        auto_return: "approved"
      }
    });

    await compraRef.update({
      mpPreferenceId: pref.id
    });

    return res.json({
      ok: true,
      id: pref.id,
      init_point: pref.init_point
    });

  } catch (err) {
    console.error("❌ ERROR crear preferencia:", err.response?.data || err);
    return res.status(500).json({ error: "Error al crear la preferencia" });
  }
});

/* ===========================================================
   WEBHOOK (OBLIGATORIO)
=========================================================== */
router.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.query["data.id"];
    if (!paymentId) return res.sendStatus(400);

    const mpCuenta = req.body?.data?.metadata?.mpCuenta || "1";
    const token = getToken(mpCuenta);

    const client = new MercadoPagoConfig({ accessToken: token });

    const payment = await new Payment(client).get({ id: paymentId });

    if (payment.status === "approved") {
      const compraId = payment.metadata?.compraId;

      if (compraId) {
        await db.collection("compras").form(compraId).update({
          status: "pagado",
          paymentData: payment,
          updatedAt: new Date()
        });

        console.log("✔ Pago confirmado:", compraId);
      }
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err.response?.data || err);
    return res.sendStatus(500);
  }
});

export default router;
