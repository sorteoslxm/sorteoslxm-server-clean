// FILE: routes/webhook-pago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// NECESARIO para recibir RAW body de MercadoPago
router.use(express.raw({ type: "*/*" }));

router.post("/", async (req, res) => {
  try {
    // Convertir buffer a JSON
    const jsonString = req.body.toString("utf8");
    const body = JSON.parse(jsonString);

    console.log("📥 Webhook decodificado:", JSON.stringify(body, null, 2));

    const { type, data, topic } = body;

    // Webhook tipo "payment"
    if (type !== "payment" && topic !== "payment") {
      return res.sendStatus(200);
    }

    // Obtener ID real del pago
    const paymentId = data?.id || body.resource;

    if (!paymentId) {
      console.log("⚠ No se encontró paymentId");
      return res.sendStatus(200);
    }

    // Get pago con el SDK actual
    const payment = await mercadopago.payment.get(paymentId);
    const meta = payment.body.metadata || {};

    const sorteoId = meta.sorteoId || meta.sorteo_id;
    const compraId = meta.compraId || meta.compra_id;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || meta.tel || null;
    const mpCuenta = meta.mpCuenta || meta.mp_cuenta || "1";

    if (!sorteoId || !compraId) {
      console.log("⚠ Metadata incompleta:", meta);
      return res.sendStatus(200);
    }

    // Buscar compra
    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();
    if (!compraSnap.exists) {
      console.log("⚠ compra no encontrada:", compraId);
      return res.sendStatus(200);
    }

    const compra = compraSnap.data();
    const chancesRef = db.collection("chances");

    // Crear chances
    for (let i = 0; i < cantidad; i++) {
      await chancesRef.add({
        sorteoId,
        compraId,
        usuario: compra.usuario || null,
        telefono,
        fecha: new Date(),
        mpCuenta,
      });
    }

    console.log(`✅ ${cantidad} chances generadas para sorteo ${sorteoId}`);
    return res.sendStatus(200);

  } catch (e) {
    console.error("❌ ERROR WEBHOOK:", e);
    return res.sendStatus(500);
  }
});

export default router;
