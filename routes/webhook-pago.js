// FILE: routes/webhook-pago.js
import express from "express";
import MercadoPago from "mercadopago";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

// ==========================================================
//  🔵 WEBHOOK MERCADOPAGO (SDK 2.10+)
// ==========================================================

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    let paymentId = null;

    // Formato habitual
    if (body.type === "payment" && body.data?.id) {
      paymentId = body.data.id;
    }

    // Formato alternativo
    if (!paymentId && body.id) {
      paymentId = body.id;
    }

    if (!paymentId) {
      console.log("⚠ Webhook sin paymentId");
      return res.sendStatus(200);
    }

    // ========================================================
    //  Seleccionar token MP (por defecto usamos el 1 o 2)
    // ========================================================
    const token =
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
      Object.values(process.env).find((v) => v.includes("APP_USR"));

    if (!token) {
      console.log("❌ ERROR: token MercadoPago no encontrado");
      return res.sendStatus(500);
    }

    // 👌 SDK V2 (correcto)
    const mp = new MercadoPago({ accessToken: token });

    // ========================================================
    //  Obtener información real del pago
    // ========================================================
    const mpPayment = await mp.payment.get({ id: paymentId });
    const payment = mpPayment || {};

    console.log("💰 Pago encontrado:", paymentId);

    const preferenceId = payment.preference_id;
    const status = payment.status; // approved / pending / rejected
    const precioUnit = payment.transaction_details?.total_paid_amount || 0;

    // Metadata enviada desde la preferencia
    const md = payment.metadata || {};
    const sorteoId = md.sorteoId;
    const telefono = md.telefono;
    const cantidadComprada = Number(md.cantidad || 1);

    if (!sorteoId) {
      console.log("⚠ Webhook sin sorteoId");
      return res.sendStatus(200);
    }

    // ========================================================
    //  Buscar compra existente para evitar duplicados
    // ========================================================
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraRef;
    let compraData;

    if (snap.empty) {
      // Crear compra SOLO si el pago está aprobado
      if (status !== "approved") {
        console.log("⚠ Pago no aprobado, no se crea compra");
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

      // Evitar reprocesar
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

    // ========================================================
    //  Sumar chances SOLO si está aprobado
    // ========================================================
    if (status === "approved") {
      const sorteoRef = db.collection("sorteos").doc(sorteoId);
      const sorteoSnap = await sorteoRef.get();
      const sorteo = sorteoSnap.data();

      const chancesMax = Number(sorteo.totalChances || 0);
      const vendidas = Number(sorteo.chancesVendidas || 0);

      if (chancesMax > 0 && vendidas + cantidadComprada > chancesMax) {
        console.log("❌ Exceso de chances, compra rechazada");
        await compraRef.update({ status: "rejected" });
        return res.sendStatus(200);
      }

      await sorteoRef.update({
        chancesVendidas: FieldValue.increment(cantidadComprada),
      });

      console.log(
        `🏁 Chances sumadas (${cantidadComprada}) al sorteo ${sorteoId}`
      );
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ ERROR WEBHOOK:", err);
    return res.sendStatus(500);
  }
});

export default router;
