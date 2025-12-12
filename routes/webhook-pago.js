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
  if (mpCuenta.startsWith("MERCADOPAGO_ACCESS_TOKEN_"))
    return process.env[mpCuenta];
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

    const paymentId = data?.id || resource;
    if (!paymentId) return res.sendStatus(200);

    // --- 0) Anti-Duplicación ---
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      console.log("⚠ Webhook DUPLICADO ignorado:", paymentId);
      return res.sendStatus(200);
    }

    await lockRef.set({
      processedAt: new Date(),
      paymentId,
    });

    // --- 1) Metadata preliminar
    const prelimMeta = body?.data?.metadata || {};

    const mpCuenta = prelimMeta.mpCuenta || prelimMeta.mp_cuenta || "1";
    const token = getToken(mpCuenta);

    if (!token) {
      console.log("❌ No hay access token para cuenta:", mpCuenta);
      return res.sendStatus(200);
    }

    // --- 2) Inicializar SDK con el token correcto
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentClient = new Payment(client);

    // --- 3) Consultar el pago real (con metadata correcta)
    const payment = await paymentClient.get({ id: paymentId });
    const meta = payment?.metadata || {};

    const sorteoId = meta.sorteoId;
    const compraId = meta.compraId;
    const cantidad = Number(meta.cantidad || 1);
    const telefono = meta.telefono || null;

    if (!sorteoId || !compraId) {
      console.log("⚠ Metadata incompleta:", meta);
      return res.sendStatus(200);
    }

    // --- 4) Buscar compra ---
    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();

    if (compraSnap.exists) {
      const compra = compraSnap.data();
      
      // Si la compra ya está pagada, no duplicar
      if (compra.status === "pagado") {
        console.log("⚠ Compra ya pagada:", compraId);
        return res.sendStatus(200);
      }
      
      // Actualizar estado de la compra
      await compraRef.update({
        status: payment.status === "approved" ? "pagado" : "pendiente",
        updatedAt: new Date().toISOString(),
      });

    } else {
      // Crear nueva compra si no existe
      await compraRef.set({
        status: payment.status === "approved" ? "pagado" : "pendiente",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const chancesRef = db.collection("chances");

    // --- 5) Crear chances solo si el pago es aprobado
    if (payment.status === "approved") {
      for (let i = 0; i < cantidad; i++) {
        await chancesRef.add({
          sorteoId,
          compraId,
          usuario: compra?.usuario || null,
          telefono,
          createdAt: new Date().toISOString(),
          mpStatus: "approved",
          mpPaymentId: paymentId,
        });
      }
      console.log(`✅ ${cantidad} chances generadas para sorteo ${sorteoId}`);
    } else {
      console.log("⚠ Pago no aprobado, no se generaron chances.");
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("❌ ERROR WEBHOOK:", e);
    return res.sendStatus(500);
  }
});

export default router;
