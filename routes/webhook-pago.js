// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

// MercadoPago necesita RAW
router.use(express.raw({ type: "*/*" }));

// Obtener token según mpCuenta
function getToken(mpCuenta) {
  if (!mpCuenta) return process.env.MERCADOPAGO_ACCESS_TOKEN_1;

  if (mpCuenta.startsWith("MERCADOPAGO_ACCESS_TOKEN_"))
    return process.env[mpCuenta] || null;

  if (mpCuenta === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;

  return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString("utf8"));
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const { topic, type, data, resource } = body;

    // Aceptar solo eventos de pago
    if (topic !== "payment" && type !== "payment") {
      return res.sendStatus(200);
    }

    // Tomar Payment ID
    const paymentId = data?.id || resource;
    if (!paymentId) return res.sendStatus(200);

    // --- 0) Anti-duplicado ---
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Webhook duplicado ignorado:", paymentId);
      return res.sendStatus(200);
    }

    // Crear lock
    await lockRef.set({
      paymentId,
      processedAt: new Date().toISOString(),
    });

    // --- 1) Metadata preliminar (suele venir incompleta)
    const prelimMeta = body?.data?.metadata || {};
    const mpCuentaPre = prelimMeta.mpCuenta || prelimMeta.mp_cuenta || "1";
    const token = getToken(mpCuentaPre);

    if (!token) {
      console.log("❌ Access Token no encontrado para:", mpCuentaPre);
      return res.sendStatus(200);
    }

    // --- 2) SDK MP con token correcto
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);

    // --- 3) Obtener PAGO REAL desde MP (acá viene metadata completa)
    const payment = await paymentClient.get({ id: paymentId });
    const meta = payment?.metadata || {};

    const sorteoId = meta.sorteoId || meta.sorteo_id;
    const compraId = meta.compraId || meta.compra_id;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;
    const mpCuenta = meta.mpCuenta || meta.mp_cuenta || mpCuentaPre;

    if (!sorteoId || !compraId) {
      console.log("⚠ Metadata incompleta en MP:", meta);
      return res.sendStatus(200);
    }

    // --- 4) Buscar compra en DB ---
    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();

    let compra = null;

    if (compraSnap.exists) {
      compra = compraSnap.data();

      if (compra.status === "pagado") {
        console.log("✔ Compra ya estaba pagada, no se duplica:", compraId);
        return res.sendStatus(200);
      }

      // Actualizar estado
      await compraRef.update({
        status: payment.status === "approved" ? "pagado" : "pendiente",
        updatedAt: new Date().toISOString(),
      });

    } else {
      // Crear compra nueva si no existe
      compra = {
        sorteoId,
        cantidad,
        telefono,
        status: payment.status === "approved" ? "pagado" : "pendiente",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await compraRef.set(compra);
    }

    // --- 5) Crear chances SOLO SI APPROVED ---
    if (payment.status === "approved") {
      const chancesRef = db.collection("chances");

      for (let i = 0; i < cantidad; i++) {
        await chancesRef.add({
          sorteoId,
          compraId,
          usuario: compra?.usuario || null,
          telefono,
          createdAt: new Date().toISOString(),
          mpStatus: "approved",
          mpPaymentId: paymentId,
          mpCuenta,
        });
      }

      console.log(`🎉 ${cantidad} chances generadas para sorteo ${sorteoId}`);
    } else {
      console.log("⚠ Pago no aprobado, no se generaron chances");
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("❌ ERROR WEBHOOK:", e);
    return res.sendStatus(500);
  }
});

export default router;
