// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

function resolveTokenByAccountName(accountName) {
  if (!accountName) {
    return (
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
      process.env.MP_ACCESS_TOKEN ||
      null
    );
  }

  if (process.env[accountName]) return process.env[accountName];
  if (accountName === "1") return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
  if (accountName === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;
  if (accountName.toLowerCase() === "m1") return process.env.MERCADOPAGO_ACCESS_TOKEN_1;
  if (accountName.toLowerCase() === "m2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2;

  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
    process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
    process.env.MP_ACCESS_TOKEN ||
    null
  );
}

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    // obtener paymentId
    let paymentId = null;
    if (body.type === "payment" && body.data?.id) paymentId = body.data.id;
    if (!paymentId && body.id) paymentId = body.id;
    if (!paymentId) {
      console.log("⚠ Webhook sin paymentId");
      return res.sendStatus(200);
    }

    // Intentar obtener payment usando ambos tokens
    const possibleTokens = [
      process.env.MERCADOPAGO_ACCESS_TOKEN_1,
      process.env.MERCADOPAGO_ACCESS_TOKEN_2,
    ].filter(Boolean);

    let payment = null;
    let usedToken = null;

    for (const t of possibleTokens) {
      try {
        const clientTry = new MercadoPagoConfig({ accessToken: t });
        const mpPaymentTry = await new Payment(clientTry).get({ id: paymentId });
        if (mpPaymentTry && mpPaymentTry.id) {
          payment = mpPaymentTry;
          usedToken = t;
          break;
        }
      } catch (e) {
        console.log("Intento token fallo:", t?.slice(0, 8), e?.message);
      }
    }

    if (!payment) {
      console.error("❌ No se pudo leer el pago con ningún token.");
      return res.sendStatus(500);
    }

    const preferenceId = payment.preference_id;
    const estado = payment.status;
    let metadata = payment.metadata || {};

    console.log("🔑 Token usado:", usedToken?.slice(0, 12));
    console.log("🔗 paymentId:", paymentId, "prefId:", preferenceId, "estado:", estado);

    // Buscar compra preliminar en Firestore
    const preSnap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraRef = null;
    let compraData = null;

    if (!preSnap.empty) {
      compraRef = preSnap.docs[0].ref;
      compraData = preSnap.docs[0].data();
    }

    // ---- FIX METADATA ----
    // MercadoPago NO siempre envía metadata en webhook
    let telefono = metadata.telefono;
    let sorteoId = metadata.sorteoId;
    let cantidad = Number(metadata.cantidad || 0);

    if (!telefono || !sorteoId || !cantidad) {
      if (compraData) {
        telefono = telefono || compraData.telefono;
        sorteoId = sorteoId || compraData.sorteoId;
        cantidad = cantidad || compraData.cantidad || 1;
      }
    }

    if (!sorteoId) {
      console.log("❌ Webhook sin sorteoId ni en metadata ni en compra preliminar");
      return res.sendStatus(200);
    }

    // Buscar compra existente
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraDocRef;

    if (snap.empty) {
      if (estado !== "approved") {
        console.log("⚠ Pago no aprobado, no se crea compra.");
        return res.sendStatus(200);
      }

      compraDocRef = await db.collection("compras").add({
        sorteoId,
        telefono,
        cantidad,
        status: estado,
        mpPreferenceId: preferenceId,
        mpPaymentId: paymentId,
        mpPayer: payment.payer || null,
        totalPagado: payment.transaction_details?.total_paid_amount || 0,
        mpAccount: compraData?.mpAccount || (usedToken === process.env.MERCADOPAGO_ACCESS_TOKEN_2 ? "2" : "1"),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      console.log("🟢 Compra creada:", compraDocRef.id);
    } else {
      compraDocRef = snap.docs[0].ref;
      const existing = snap.docs[0].data();

      if (existing.status === "approved") {
        console.log("⏭ Compra ya procesada anteriormente");
        return res.sendStatus(200);
      }

      await compraDocRef.update({
        status: estado,
        mpPaymentId: paymentId,
        updatedAt: Date.now(),
      });

      console.log("🟡 Compra actualizada:", compraDocRef.id);
    }

    // Generar chances si está aprobado
    if (estado === "approved") {
      const sorteoRef = db.collection("sorteos").doc(sorteoId);

      await sorteoRef.update({
        chancesVendidas: FieldValue.increment(cantidad),
      });

      const batch = db.batch();
      const chancesRef = db.collection("chances");

      for (let i = 0; i < cantidad; i++) {
        const doc = chancesRef.doc();
        const numeroLXM = "LXM-" + String(Math.floor(Math.random() * 999999)).padStart(6, "0");

        batch.set(doc, {
          id: doc.id,
          telefono,
          sorteoId,
          numero: numeroLXM,
          createdAt: Date.now(),
        });
      }

      await batch.commit();

      console.log(`🏁 ${cantidad} chances generadas para sorteo ${sorteoId}`);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
