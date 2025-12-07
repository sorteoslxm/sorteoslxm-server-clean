// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

// ==========================================================
//  🔵 WEBHOOK MERCADOPAGO – CON LOG DE CUENTA C1 / C2
// ==========================================================

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    // -----------------------------------------
    // 1) Obtener paymentId
    // -----------------------------------------
    let paymentId = null;
    if (body.type === "payment" && body.data?.id) paymentId = body.data.id;
    if (!paymentId && body.id) paymentId = body.id;

    if (!paymentId) {
      console.log("⚠ Webhook sin paymentId");
      return res.sendStatus(200);
    }

    // -----------------------------------------
    // 2) Selección del token C1 o C2
    // -----------------------------------------
    let cuentaUsada = "C2";

    const token =
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 &&
      Number(paymentId) % 2 === 0
        ? (cuentaUsada = "C1", process.env.MERCADOPAGO_ACCESS_TOKEN_1)
        : process.env.MERCADOPAGO_ACCESS_TOKEN_2;

    if (!token) {
      console.log("❌ ERROR: No hay token válido configurado");
      return res.sendStatus(500);
    }

    console.log("💰 PAGO RECIBIDO → CUENTA:", cuentaUsada);
    console.log("💳 paymentId:", paymentId);
    console.log("🔑 Token usado:", token.slice(0, 12));

    const client = new MercadoPagoConfig({ accessToken: token });

    // -----------------------------------------
    // 3) Obtener pago real
    // -----------------------------------------
    const mpPayment = await new Payment(client).get({ id: paymentId });

    const status = mpPayment.status;
    const metadata = mpPayment.metadata || {};
    const preferenceId = mpPayment.preference_id;

    const telefono = metadata.telefono;
    const sorteoId = metadata.sorteoId;
    const cantidad = Number(metadata.cantidad || 1);

    console.log("📱 Telefono:", telefono);
    console.log("🎯 sorteoId:", sorteoId);
    console.log("🎟 Cantidad:", cantidad);
    console.log("🔗 preferenceId:", preferenceId);

    if (!sorteoId) {
      console.log("⚠ Webhook sin sorteoId");
      return res.sendStatus(200);
    }

    // -----------------------------------------
    // 4) Buscar compra existente
    // -----------------------------------------
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraRef;

    if (snap.empty) {
      if (status !== "approved") {
        console.log("⚠ Pago no aprobado → compra NO creada");
        return res.sendStatus(200);
      }

      compraRef = await db.collection("compras").add({
        telefono,
        sorteoId,
        cantidad,
        status,
        mpPreferenceId: preferenceId,
        mpPaymentId: paymentId,
        totalPagado: mpPayment.transaction_details?.total_paid_amount || 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      console.log("🟢 Compra creada:", compraRef.id);
    } else {
      compraRef = snap.docs[0].ref;
      await compraRef.update({
        status,
        mpPaymentId: paymentId,
        updatedAt: Date.now(),
      });

      console.log("🟡 Compra actualizada:", compraRef.id);
    }

    // -----------------------------------------
    // 5) Generar chances
    // -----------------------------------------
    if (status === "approved") {
      // actualizar sorteo
      await db.collection("sorteos").doc(sorteoId).update({
        chancesVendidas: FieldValue.increment(cantidad),
      });

      // batch
      const batch = db.batch();
      const chanceCol = db.collection("chances");

      for (let i = 0; i < cantidad; i++) {
        const doc = chanceCol.doc();

        const numeroLXM =
          "LXM-" +
          String(Math.floor(Math.random() * 999999)).padStart(6, "0");

        batch.set(doc, {
          id: doc.id,
          telefono,
          sorteoId,
          numero: numeroLXM,
          createdAt: Date.now(),
        });
      }

      await batch.commit();

      console.log(`🏁 ${cantidad} chances generadas correctamente`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
