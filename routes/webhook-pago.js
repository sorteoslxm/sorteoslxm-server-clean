// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/webhook-pago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * POST /webhook-pago
 * MercadoPago enviará notificaciones aquí.
 * Dependiendo del body, obtenemos el paymentId y consultamos la API de MP
 * para recuperar la preference_id (external_reference) que nos permita actualizar la compra.
 *
 * Asegurate de configurar en Render/Server la URL pública para este endpoint.
 */

router.post("/", async (req, res) => {
  try {
    // El body puede variar; MP suele enviar: { type: 'payment', data: { id: PAYMENT_ID } }
    const mpData = req.body;

    // intenta extraer payment id
    const paymentId = (mpData && mpData.data && mpData.data.id) || mpData.id || null;
    if (!paymentId) {
      // A veces MP manda topic/payment etc. Respondemos 200 para no reenviar indefinidamente
      console.log("Webhook recibido sin payment id:", mpData);
      return res.sendStatus(200);
    }

    // No sabemos qué cuenta/token usar para consultar el pago.
    // Vamos a intentar usar la primera MERCADOPAGO_ACCESS_TOKEN_* encontrada en process.env.
    // (Si usás muchos tokens, podés mejorar esto guardando en compras la mpAccount y luego buscar por preference_id.)
    const tokenKeys = Object.keys(process.env).filter(k => k.toUpperCase().startsWith("MERCADOPAGO_ACCESS_TOKEN"));
    if (tokenKeys.length === 0) {
      console.error("No hay variables de entorno MERCADOPAGO_ACCESS_TOKEN_* para consultar pagos.");
      return res.sendStatus(500);
    }

    // Intentaremos consultar el payment con cada token hasta encontrar info válida
    let paymentInfo = null;
    for (const key of tokenKeys) {
      try {
        mercadopago.configure({ access_token: process.env[key] });
        const mpResp = await mercadopago.payment.findById(paymentId); // mercadopago.payment.get / findById differs by SDK; try findById
        // algunas versiones retornan mpResp.body o mpResp.response
        const body = mpResp.body || mpResp.response || mpResp;
        if (body) {
          paymentInfo = { body, usedTokenKey: key };
          break;
        }
      } catch (err) {
        // intentar siguiente token
      }
    }

    if (!paymentInfo) {
      console.error("No se pudo obtener info del pago con los tokens disponibles.");
      return res.sendStatus(500);
    }

    const pay = paymentInfo.body;

    // Extraer preference id / external_reference
    // En la API MP payment puede traer preference_id o external_reference en distintos lugares:
    const preferenceId = pay.preference_id || pay.collection?.preference_id || pay.order?.preference_id || pay.preference?.id || pay.order?.id || null;

    // Si no tenemos preference id, intentar extraer external_reference desde 'order' o 'additional_info'
    let externalRef = pay.external_reference || pay.additional_info?.items?.[0]?.external_reference || null;

    // Si preferenceId está presente, buscar compra por mpPreferenceId
    let compraSnap = null;
    if (preferenceId) {
      const q = await db.collection("compras").where("mpPreferenceId", "==", preferenceId).limit(1).get();
      if (!q.empty) compraSnap = q.docs[0];
    }

    // Si no encontramos por mpPreferenceId, intentar buscar por external_reference (purchaseId)
    if (!compraSnap && externalRef) {
      const doc = await db.collection("compras").doc(externalRef).get();
      if (doc.exists) compraSnap = doc;
    }

    // Si todavía no encontramos, intentar por mpPaymentId (data.id)
    if (!compraSnap) {
      const q2 = await db.collection("compras").where("mpPaymentId", "==", String(paymentId)).limit(1).get();
      if (!q2.empty) compraSnap = q2.docs[0];
    }

    if (!compraSnap) {
      console.warn("Compra no encontrada para paymentId/preferenceId:", paymentId, preferenceId, externalRef);
      // Podríamos almacenar un registro 'noMatch' para investigar luego
      return res.sendStatus(200);
    }

    const compraRef = compraSnap.ref;
    const compra = compraSnap.data();

    // Guardar info del pago dentro de la compra y actualizar estado según status
    // Dependiendo de la estructura de pay, extraemos estado y datos de payer
    const status = (pay.status || pay.collection_status || pay.payment_status || "").toString().toLowerCase();
    const approved = status === "approved" || status === "paid" || status === "authorized" || status === "completed";

    const payer = pay.payer || pay.collection || pay.additional_info?.payer || {};
    const payerEmail = payer.email || payer.email_address || "";
    const payerPhone = (payer.phone && (payer.phone.area_code + payer.phone.number)) || payer.phone || "";

    // Update compra with payment info
    await compraRef.update({
      estado: approved ? "approved" : status || "pending",
      mpPaymentId: String(paymentId),
      payerEmail: payerEmail,
      payerPhone: payerPhone,
      updatedAt: Date.now(),
      rawPayment: pay,
    });

    // Si aprobado → decrementar numerosDisponibles del sorteo y marcar compra como aprobada
    if (approved && compra.sorteoId) {
      const sorteoRef = db.collection("sorteos").doc(compra.sorteoId);
      await db.runTransaction(async (tx) => {
        const sDoc = await tx.get(sorteoRef);
        if (!sDoc.exists) return;
        const sdata = sDoc.data();
        const disponibles = Number(sdata.numerosDisponibles || 0);
        const nueva = Math.max(0, disponibles - 1); // asumimos 1 por compra
        tx.update(sorteoRef, { numerosDisponibles: nueva });
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR webhook-pago:", err);
    res.sendStatus(500);
  }
});

export default router;
