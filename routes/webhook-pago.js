// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

// ==========================================================
//  🔵 WEBHOOK MERCADOPAGO (SDK 2.11)
// ==========================================================

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    // ========================================================
    //  Identificar paymentId
    // ========================================================
    let paymentId = null;

    if (body.type === "payment" && body.data?.id) {
      paymentId = body.data.id;
    }
    if (!paymentId && body.id) {
      paymentId = body.id;
    }
    if (!paymentId) {
      console.log("⚠ Webhook sin paymentId");
      return res.sendStatus(200);
    }

    // ========================================================
    //  Seleccionar token correcto sin errores
    // ========================================================
    const tokens = [
      process.env.MERCADOPAGO_ACCESS_TOKEN_1,
      process.env.MERCADOPAGO_ACCESS_TOKEN_2,
    ].filter(Boolean);

    const token = tokens.length > 1 ? tokens.find(t => t.includes("TEST") || t.includes("APP_USR")) : tokens[0];

    if (!token) {
      console.log("❌ ERROR: Token MercadoPago NO encontrado");
      return res.sendStatus(500);
    }

    // SDK v2
    const client = new MercadoPagoConfig({ accessToken: token });

    // ========================================================
    //  Obtener datos reales del pago
    // ========================================================
    const payment = await new Payment(client).get({ id: paymentId });

    const preferenceId = payment.preference_id;
    const status = payment.status;
    const metadata = payment.metadata || {};

    const sorteoId = metadata.sorteoId;
    const telefono = metadata.telefono;
    const cantidad = Number(metadata.cantidad || 1);

    if (!sorteoId) {
      console.log("⚠ Webhook sin sorteoId");
      return res.sendStatus(200);
    }

    // ========================================================
    //  Buscar compra existente por preferencia
    // ========================================================
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraRef;
    let compraData;

    if (snap.empty) {
      // Si no existe compra, crearla sólo si está aprobada
      if (status !== "approved") {
        console.log("⚠ Pago no aprobado, compra NO creada");
        return res.sendStatus(200);
      }

      compraRef = await db.collection("compras").add({
        sorteoId,
        telefono,
        cantidad,
        status,
        mpPreferenceId: preferenceId,
        mpPaymentId: paymentId,
        totalPagado: payment.transaction_details.total_paid_amount,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      compraData = await compraRef.get().then(d => d.data());

      console.log("🟢 Compra creada:", compraRef.id);

    } else {
      compraRef = snap.docs[0].ref;
      compraData = snap.docs[0].data();

      if (compraData.status === "approved") {
        console.log("⏭ Webhook duplicado — compra ya procesada");
        return res.sendStatus(200);
      }

      await compraRef.update({
        status,
        mpPaymentId: paymentId,
        updatedAt: Date.now(),
      });

      console.log("🟡 Compra actualizada:", compraRef.id);
    }

    // ========================================================
    //  Generar chances si el pago está aprobado
    // ========================================================
    if (status === "approved") {
      const sorteoRef = db.collection("sorteos").doc(sorteoId);
      await sorteoRef.update({
        chancesVendidas: FieldValue.increment(cantidad),
      });

      // Crear chances
      const batch = db.batch();
      const chancesRef = db.collection("chances");

      for (let i = 0; i < cantidad; i++) {
        const chance = chancesRef.doc();
        batch.set(chance, {
          id: chance.id,
          telefono,
          sorteoId,
          numero: Math.floor(Math.random() * 999999),
          createdAt: Date.now(),
        });
      }

      await batch.commit();

      console.log(`🏁 ${cantidad} chances generadas para el sorteo ${sorteoId}`);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
