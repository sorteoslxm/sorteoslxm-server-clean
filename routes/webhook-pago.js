// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// RAW BODY
router.use(express.raw({ type: "*/*" }));

function getToken(mpCuenta) {
  if (!mpCuenta) return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
  if (mpCuenta.startsWith("MERCADOPAGO_ACCESS_TOKEN_"))
    return process.env[mpCuenta];
  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString("utf8"));
    console.log("📥 Webhook:", JSON.stringify(body, null, 2));

    // ⚠️ SOLO PROCESAMOS payment.created
    if (body.action !== "payment.created") {
      console.log("⏩ Ignorado (no es payment.created)");
      return res.sendStatus(200);
    }

    const paymentId = body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    // ANTI-DUPLICACIÓN
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Ya procesado:", paymentId);
      return res.sendStatus(200);
    }

    await lockRef.set({
      processedAt: new Date(),
      paymentId,
    });

    const prelimMeta = body?.data?.metadata || {};
    const mpCuenta =
      prelimMeta.mpCuenta || prelimMeta.mp_cuenta || "1";

    const token = getToken(mpCuenta);
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);

    const payment = await paymentClient.get({ id: paymentId });
    const meta = payment.metadata || {};

    const sorteoId = meta.sorteoId;
    const compraId = meta.compraId;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;

    if (!sorteoId || !compraId) {
      console.log("❌ ERROR: Falta metadata", meta);
      return res.sendStatus(200);
    }

    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();

    if (!compraSnap.exists) {
      console.log("❌ Compra no existe:", compraId);
      return res.sendStatus(200);
    }

    const compra = compraSnap.data();
    const chancesRef = db.collection("chances");

    for (let i = 0; i < cantidad; i++) {
      await chancesRef.add({
        sorteoId,
        compraId,
        usuario: compra.usuario,
        telefono,
        createdAt: new Date().toISOString(),
        mpStatus: payment.status,
        mpPaymentId: paymentId,
        numero: i + 1,
        mpCuenta,
      });
    }

    await compraRef.update({
      status: "pagado",
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ ${cantidad} chances generadas para sorteo ${sorteoId}`);

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
