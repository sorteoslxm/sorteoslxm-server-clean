// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// Webhook requiere RAW para MP
router.use(express.raw({ type: "*/*" }));

// Obtener token según mpCuenta (misma lógica que crear-preferencia)
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
    // Convertir RAW a JSON
    const body = JSON.parse(req.body.toString("utf8"));
    console.log("📥 Webhook:", JSON.stringify(body, null, 2));

    const { topic, type, data, resource } = body;

    // Solo aceptar notificaciones de pago
    if (topic !== "payment" && type !== "payment") {
      return res.sendStatus(200);
    }

    // Obtener ID del pago
    const paymentId = data?.id || resource;
    if (!paymentId) return res.sendStatus(200);

    // --- 0) Anti-duplicado ---
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Webhook DUPLICADO ignorado:", paymentId);
      return res.sendStatus(200);
    }

    // Crear lock
    await lockRef.set({
      paymentId,
      processedAt: new Date(),
    });

    // --- 1) Metadata preliminar
    const prelimMeta = body?.data?.metadata || {};

    const mpCuenta =
      prelimMeta.mpCuenta || prelimMeta.mp_cuenta || "1";

    const token = getToken(mpCuenta);

    if (!token) {
      console.log("❌ No hay access token para cuenta:", mpCuenta);
      return res.sendStatus(200);
    }

    // --- 2) Inicializar SDK con el token correcto
    const client = new MercadoPagoConfig({
      accessToken: token,
    });
    const paymentClient = new Payment(client);

    // --- 3) Consultar el pago real (con metadata correcta)
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

    // --- 4) Buscar compra ---
    const compraRef = db.collection("compras").doc(compraId);
    const snap = await compraRef.get();

    if (!snap.exists) {
      console.log("⚠ Compra no encontrada:", compraId);
      return res.sendStatus(200);
    }

    const compra = snap.data();
    const chancesRef = db.collection("chances");

    // --- 5) Crear chances ---
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

    // --- 6) Marcar compra como pagada ---
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
