// FILE: routes/webhook-pago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

/**
 * POST /webhook-pago
 * MercadoPago envía notificaciones automáticas.
 */

router.post("/", async (req, res) => {
  try {
    const body = req.body;

    let paymentId = null;

    // Formato 1
    if (body.type === "payment" && body.data?.id) {
      paymentId = body.data.id;
    }

    // Formato alternativo
    if (!paymentId && body.id) {
      paymentId = body.id;
    }

    if (!paymentId) return res.sendStatus(200);

    /* ============================================================
       🔐 Seleccionar token según cuenta (mejorado)
    ============================================================ */
    const token =
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      Object.values(process.env).find((v) => v && v.includes("APP_USR"));

    mercadopago.configure({ access_token: token });

    /* ============================================================
       🧾 Traer información real del pago
    ============================================================ */
    const mpPayment = await mercadopago.payment.get(paymentId);
    const payment = mpPayment.body;

    const preferenceId = payment.preference_id;
    const status = payment.status; // approved / pending / rejected
    const precioUnit = payment.transaction_details?.total_paid_amount || 0;

    // Metadata enviada desde la preferencia
    const md = payment.metadata || {};
    const sorteoId = md.sorteoId;
    const telefono = md.telefono;
    const cantidadComprada = Number(md.cantidad || 1);

    if (!sorteoId) return res.sendStatus(200);

    /* ============================================================
       📌 Buscar compra (para evitar duplicados)
    ============================================================ */
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraRef;
    let compraData;

    if (snap.empty) {
      // Crear compra SOLO si está aprobada
      if (status !== "approved") {
        console.log("⚠ Creación cancelada: pago no aprobado.");
        return res.sendStatus(200);
      }

      compraRef = await db.collection("compras").add({
        sorteoId,
        telefono,
        cantidad: cantidadComprada,
        precioUnitario: precioUnit,
        totalPagado: cantidadComprada * precioUnit,
        status,
        mpPreferenceId: preferenceId,
        mpPaymentId: paymentId,
        mpPayer: payment.payer || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      compraData = await compraRef.get().then((d) => d.data());

      console.log("🟢 Compra creada automáticamente:", compraRef.id);
    } else {
      compraRef = snap.docs[0].ref;
      compraData = snap.docs[0].data();

      // Evitar re-procesar pagos aprobados (webhook duplicado)
      if (compraData.status === "approved") {
        console.log("⏭ Webhook duplicado - pago ya procesado.");
        return res.sendStatus(200);
      }

      await compraRef.update({
        status,
        mpPaymentId: paymentId,
        mpPayer: payment.payer,
        updatedAt: Date.now(),
      });

      console.log("🟡 Compra actualizada:", compraRef.id);
    }

    /* ============================================================
       🟦 Si el pago está aprobado → sumar chances
    ============================================================ */
    if (status === "approved") {
      const sorteoRef = db.collection("sorteos").doc(sorteoId);
      const sorteoSnap = await sorteoRef.get();
      const sorteo = sorteoSnap.data();

      const chancesMax = Number(sorteo.totalChances || 0);
      const vendidas = Number(sorteo.chancesVendidas || 0);

      // Validar que hay stock disponible
      if (chancesMax > 0 && vendidas + cantidadComprada > chancesMax) {
        console.log("❌ Compra excede chances disponibles.");
        await compraRef.update({ status: "rejected" });
        return res.sendStatus(200);
      }

      // Sumar chances
      await sorteoRef.update({
        chancesVendidas: FieldValue.increment(cantidadComprada),
      });

      console.log(`🏁 Chances sumadas (${cantidadComprada}) al sorteo ${sorteoId}`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
