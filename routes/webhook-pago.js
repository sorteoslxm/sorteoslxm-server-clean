// FILE: routes/webhook-pago.js
// Webhook MercadoPago (soporta 2 cuentas, lectura segura del payment, generación de chances,
// actualización de compras y sorteo, numeración secuencial LXM-000001, compatible con frontend actual)

import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

/**
 * Resolve a token from an account identifier or fallback list.
 * mpAccount may be: "1", "2", "MERCADOPAGO_ACCESS_TOKEN_1", "MERCADOPAGO_ACCESS_TOKEN_2",
 * "M1"/"M2", or the actual env var name.
 */
function resolveTokenByAccountName(accountName) {
  if (!accountName) {
    return (
      process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
      process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
      process.env.MP_ACCESS_TOKEN ||
      null
    );
  }

  // If they sent the env var name directly
  if (process.env[accountName]) return process.env[accountName];

  if (accountName === "1") return process.env.MERCADOPAGO_ACCESS_TOKEN_1 || null;
  if (accountName === "2") return process.env.MERCADOPAGO_ACCESS_TOKEN_2 || null;

  if (accountName.toLowerCase?.() === "m1")
    return process.env.MERCADOPAGO_ACCESS_TOKEN_1 || null;
  if (accountName.toLowerCase?.() === "m2")
    return process.env.MERCADOPAGO_ACCESS_TOKEN_2 || null;

  // fallback
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN_1 ||
    process.env.MERCADOPAGO_ACCESS_TOKEN_2 ||
    process.env.MP_ACCESS_TOKEN ||
    null
  );
}

/**
 * Try to read payment using available tokens. Returns { payment, usedToken } or throws.
 */
async function fetchPaymentWithTokens(paymentId) {
  const possibleTokens = [
    process.env.MERCADOPAGO_ACCESS_TOKEN_1,
    process.env.MERCADOPAGO_ACCESS_TOKEN_2,
  ].filter(Boolean);

  let payment = null;
  let usedToken = null;

  for (const t of possibleTokens) {
    try {
      const client = new MercadoPagoConfig({ accessToken: t });
      const mpPayment = await new Payment(client).get({ id: paymentId });
      if (mpPayment && mpPayment.id) {
        payment = mpPayment;
        usedToken = t;
        break;
      }
    } catch (e) {
      console.log("Intento leer pago con token falló (continuando):", t?.slice(0,8), e?.message?.slice?.(0,120));
    }
  }

  if (!payment) {
    throw new Error("No se pudo leer el payment con los tokens disponibles");
  }

  return { payment, usedToken };
}

/* -------------------------------------------
   WEBHOOK MERCADOPAGO
------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    // Extraer payment id: MP puede enviar distintos formatos
    let paymentId = null;
    if (body.type === "payment" && body.data?.id) paymentId = body.data.id;
    if (!paymentId && body.id) paymentId = body.id;
    if (!paymentId && body.data?.id) paymentId = body.data.id;
    if (!paymentId) {
      console.log("⚠ Webhook sin paymentId -> OK (no action)");
      return res.sendStatus(200);
    }

    // 1) Leer payment intentando con ambos tokens (o mas)
    let payment, usedToken;
    try {
      const result = await fetchPaymentWithTokens(paymentId);
      payment = result.payment;
      usedToken = result.usedToken;
    } catch (err) {
      console.error("❌ No se pudo obtener payment desde MercadoPago:", err.message);
      return res.sendStatus(500);
    }

    /* ------------------------------------------------
       🔍 FIX CRÍTICO – Obtener preferenceId REAL
       Soporta las 3 variantes de MercadoPago V1/V2
    --------------------------------------------------- */

    const preferenceId =
      payment.preference_id ||
      payment.order?.id || // ← SDK V2 devuelve acá
      payment.additional_info?.items?.[0]?.id ||
      null;

    const estado = payment.status;
    const metadata = payment.metadata || {};

    let telefono = metadata.telefono;
    let sorteoId =
      metadata.sorteoId ||
      metadata.sorteoid ||
      metadata.sorteo ||
      metadata.idSorteo;

    let cantidad = Number(metadata.cantidad || metadata.quantity || 1);
    let mpAccountFromMetadata = metadata.mpAccount || metadata.mpCuenta || null;

    console.log("🔍 payment read:", {
      paymentId,
      preferenceId,
      estado,
      usedToken: usedToken?.slice?.(0, 12),
      sorteoId,
      cantidad,
    });

    if (!preferenceId) {
      console.log("❌ No se pudo obtener preferenceId del pago");
      return res.sendStatus(200);
    }

    // 2) Buscar compra preliminar
    const preSnap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraPreRef = null;
    let compraPreData = null;

    if (!preSnap.empty) {
      compraPreRef = preSnap.docs[0].ref;
      compraPreData = preSnap.docs[0].data();
    }

    // Completar datos desde compra preliminar si faltan
    if ((!telefono || !sorteoId || !cantidad) && compraPreData) {
      telefono = telefono || compraPreData.telefono;
      sorteoId = sorteoId || compraPreData.sorteoId;
      cantidad = cantidad || compraPreData.cantidad || 1;
      mpAccountFromMetadata =
        mpAccountFromMetadata ||
        compraPreData.mpAccount ||
        compraPreData.mpCuenta ||
        null;
    }

    if (!sorteoId) {
      console.log("⚠ Webhook sin sorteoId → no se procesa");
      return res.sendStatus(200);
    }

    // 3) Buscar compra existente por preferenceId
    const compraSnap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraDocRef;
    let compraDataExisting = null;

    // Crear si no existe
    if (compraSnap.empty) {
      if (estado !== "approved") {
        console.log("⚠ Pago NO aprobado y no hay compra preliminar → nada que crear");
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
        mpAccount:
          compraPreData?.mpAccount ||
          mpAccountFromMetadata ||
          (usedToken === process.env.MERCADOPAGO_ACCESS_TOKEN_2 ? "2" : "1"),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      console.log("🟢 Compra creada automáticamente:", compraDocRef.id);
    } else {
      compraDocRef = compraSnap.docs[0].ref;
      compraDataExisting = compraSnap.docs[0].data();

      if (compraDataExisting.status === "approved") {
        console.log("⏭ Compra ya procesada → OK");
        return res.sendStatus(200);
      }

      await compraDocRef.update({
        status: estado,
        mpPaymentId: paymentId,
        updatedAt: Date.now(),
      });

      console.log("🟡 Compra actualizada:", compraDocRef.id);
    }

    /* ------------------------------------------------
       4) APROBADO → Generar chances + actualizar sorteo
    --------------------------------------------------- */

    if (estado === "approved") {
      const sorteoRef = db.collection("sorteos").doc(sorteoId);
      const sorteoSnap = await sorteoRef.get();

      if (!sorteoSnap.exists) {
        console.log("❌ Sorteo no existe:", sorteoId);
        return res.sendStatus(200);
      }

      const sorteoData = sorteoSnap.data();

      // Contador secuencial para LXM-000001
      let currentCount = 0;

      if (typeof sorteoData.chancesVendidasCount === "number") {
        currentCount = Number(sorteoData.chancesVendidasCount || 0);
      } else if (Array.isArray(sorteoData.chancesVendidas)) {
        currentCount = sorteoData.chancesVendidas.length;
      } else if (typeof sorteoData.chancesVendidas === "number") {
        currentCount = Number(sorteoData.chancesVendidas || 0);
      }

      // Chequear stock
      const numerosTotales = Number(sorteoData.numerosTotales || 0);
      if (numerosTotales < cantidad) {
        console.error("❌ No hay stock suficiente en sorteo:", sorteoId);
        await compraDocRef.update({ status: "rejected_no_stock" });
        return res.sendStatus(200);
      }

      // Generar chances
      const batch = db.batch();
      const chancesCol = db.collection("chances");

      for (let i = 0; i < cantidad; i++) {
        const docRef = chancesCol.doc();
        const sequential = currentCount + 1 + i;
        const numeroLXM = "LXM-" + String(sequential).padStart(6, "0");

        batch.set(docRef, {
          id: docRef.id,
          telefono: telefono || null,
          sorteoId,
          numero: numeroLXM,
          createdAt: Date.now(),
          compraRef: compraDocRef.id,
        });
      }

      await batch.commit();

      // Actualizar sorteo
      const updates = {
        numerosTotales: FieldValue.increment(-cantidad),
        chancesVendidasCount: FieldValue.increment(cantidad),
        updatedAt: Date.now(),
      };

      if (typeof sorteoData.chancesVendidas === "number") {
        updates.chancesVendidas = FieldValue.increment(cantidad);
      }

      await sorteoRef.update(updates);

      console.log(`✅ ${cantidad} chances generadas para sorteo ${sorteoId}`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR WEBHOOK (fatal):", err);
    return res.sendStatus(500);
  }
});

export default router;
