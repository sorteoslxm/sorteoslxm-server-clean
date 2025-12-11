// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// NECESARIO para recibir RAW body
router.use(express.raw({ type: "*/*" }));

// Inicializar SDK CORRECTO
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});
const payment = new Payment(mpClient);

router.post("/", async (req, res) => {
  try {
    // Convertir buffer a JSON
    const jsonString = req.body.toString("utf8");
    const body = JSON.parse(jsonString);

    console.log("📥 Webhook decodificado:", JSON.stringify(body, null, 2));

    const paymentId =
      body?.data?.id ||
      body?.resource || 
      null;

    if (!paymentId) {
      console.log("⚠ No llegó paymentId");
      return res.sendStatus(200);
    }

    // Traer datos del pago con el SDK NUEVO
    const pago = await payment.get({ id: paymentId });

    if (!pago) {
      console.log("⚠ Pago no encontrado en MP");
      return res.sendStatus(200);
    }

    const meta = pago.metadata || {};

    console.log("📌 Metadata recibida:", meta);

    const sorteoId = meta.sorteoId || meta.sorteo_id;
    const compraId = meta.compraId || meta.compra_id;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;
    const mpCuenta = meta.mpCuenta || "1";
    const estadoMP = pago.status; // approved / pending / rejected

    if (!sorteoId || !compraId) {
      console.log("⚠ Metadata incompleta, no se crean chances");
      return res.sendStatus(200);
    }

    // Buscar compra
    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();

    if (!compraSnap.exists) {
      console.log("⚠ Compra no existe:", compraId);
      return res.sendStatus(200);
    }

    const compraData = compraSnap.data();

    // Crear chances
    const chancesRef = db.collection("chances");

    for (let i = 0; i < cantidad; i++) {
      await chancesRef.add({
        sorteoId,
        compraId,
        usuario: compraData.usuario || null,
        telefono,
        createdAt: new Date(),
        mpStatus: estadoMP,
        mpPaymentId: paymentId,
        numero: null, // si usás números asignados
        mpCuenta,
      });
    }

    console.log(`✅ ${cantidad} chances creadas para sorteo ${sorteoId}`);
    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ ERROR WEBHOOK:", error);
    return res.sendStatus(500);
  }
});

export default router;
