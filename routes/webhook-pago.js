// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// Webhook requiere RAW para MP
router.use(express.raw({ type: "*/*" }));

// Obtener token según mpCuenta
function getToken(mpCuenta) {
  if (!mpCuenta) return process.env.MERCADOPAGO_ACCESS_TOKEN_1;

  if (mpCuenta.startsWith("MERCADOPAGO_ACCESS_TOKEN_")) {
    return process.env[mpCuenta] || null;
  }

  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;

  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString("utf8"));
    console.log("📥 Webhook:", JSON.stringify(body, null, 2));

    const { topic, type, data, resource } = body;

    if (topic !== "payment" && type !== "payment") {
      return res.sendStatus(200);
    }

    const paymentId = data?.id || resource;
    if (!paymentId) return res.sendStatus(200);

    // Anti-duplicación
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Webhook DUPLICADO ignorado:", paymentId);
      return res.sendStatus(200);
    }

    await lockRef.set({
      paymentId,
      processedAt: new Date(),
    });

    // Metadata preliminar
    const prelimMeta = body?.data?.metadata || {};
    const mpCuenta =
      prelimMeta.mpCuenta || prelimMeta.mp_cuenta || "1";

    const token = getToken(mpCuenta);

    if (!token) {
      console.log("❌ No hay access token para cuenta:", mpCuenta);
      return res.sendStatus(200);
    }

    // Inicializar SDK
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);

    // Obtener pago real
    const payment = await paymentClient.get({ id: paymentId });
    const meta = payment?.metadata || {};

    const sorteoId = meta.sorteoId || meta.sorteo_id;
    const compraId = meta.compraId || meta.compra_id;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || meta.tel || null;

    if (!sorteoId || !compraId) {
      console.log("⚠ Metadata incompleta:", meta);
      return res.sendStatus(200);
    }

    // Buscar compra
    const compraRef = db.collection("compras").doc(compraId);
    const snap = await compraRef.get();

    if (!snap.exists) {
      console.log("⚠ Compra no encontrada:", compraId);
      return res.sendStatus(200);
    }

    const compra = snap.data();
    const chancesRef = db.collection("chances");

    // Crear chances con campos completos
    for (let i = 0; i < cantidad; i++) {
      await chancesRef.add({
        sorteoId,
        compraId,
        usuario: compra.usuario || null,
        telefono,
        createdAt: new Date().toISOString(),

        // Campos correctos para AdminChances
        mpStatus: payment?.status || "pending",
        mpPaymentId: paymentId,
        numero: i + 1,

        mpCuenta,
      });
    }

    // Marcar compra como pagada
    await compraRef.update({
      status: "pagado",
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ ${cantidad} chances generadas para sorteo ${sorteoId}`);

    return res.sendStatus(200);

  } catch (e) {
    console.error("❌ ERROR WEBHOOK:", e);
    return res.sendStatus(500);
  }
});

export default router;
