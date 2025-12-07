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

    // Primero intentamos leer la preferencia id del body (si está) o consultamos la API con un token fallback
    // Pero lo más fiable: buscar en Firestore la compra preliminar por mpPreferenceId
    // Podríamos obtener preference_id del payment más tarde, por ahora hacemos un intento con tokens fallback si no encontramos.
    // Buscar compra preliminar por mpPreferenceId
    // Como el webhook viene antes que nosotros llamemos la API MP, preferencia_id la podremos tomar del payment (después de obtenerlo).

    // Usar token fallback para obtener payment y su preference_id podría fallar si usamos token incorrecto.
    // Por eso: intentaremos buscar la compra por preferenceId una vez obtengamos payment.preference_id.
    // Para obtener payment.preference_id, necesitamos llamar a la API MP; para ello probamos ambos tokens hasta obtener datos válidos.

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
        // intentar siguiente token
        console.log("Intento token fallo (continuamos):", t?.slice(0, 8), e?.message?.slice?.(0,80));
      }
    }

    if (!payment) {
      console.error("❌ No se pudo leer el pago con ningun token disponible.");
      return res.sendStatus(500);
    }

    const preferenceId = payment.preference_id;
    const status = payment.status;
    const metadata = payment.metadata || {};
    const telefono = metadata.telefono;
    const sorteoId = metadata.sorteoId;
    const cantidad = Number(metadata.cantidad || 1);

    console.log("🔑 Token usado para leer pago:", usedToken?.slice(0, 12));
    console.log("🔗 paymentId:", paymentId, "preferenceId:", preferenceId, "status:", status);

    // Buscar compra preliminar por mpPreferenceId para leer mpAccount guardada
    const preSnap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", preferenceId)
      .limit(1)
      .get();

    let compraRef;
    let compraData;

    if (!preSnap.empty) {
      compraRef = preSnap.docs[0].ref;
      compraData = preSnap.docs[0].data();
    }

    // Si existe compra preliminar, tentar usar su mpAccount para elegir token (si difiere del usado)
    if (compraData && compraData.mpAccount) {
      const tokenFromCompra = resolveTokenByAccountName(compraData.mpAccount);
      if (tokenFromCompra && tokenFromCompra !== usedToken) {
        // volver a pedir al API con token correcto
        try {
          const client2 = new MercadoPagoConfig({ accessToken: tokenFromCompra });
          const payment2 = await new Payment(client2).get({ id: paymentId });
          if (payment2 && payment2.id) {
            // sobreescribimos payment/usedToken
            payment = payment2;
            usedToken = tokenFromCompra;
          }
        } catch (e) {
          console.log("No se pudo leer el pago con tokenFromCompra:", e.message);
        }
      }
    }

    // Ahora con payment seguro procesamos
    const prefId = payment.preference_id;
    const estado = payment.status; // approved / pending / rejected

    if (!sorteoId) {
      console.log("⚠ Webhook sin sorteoId en metadata");
      return res.sendStatus(200);
    }

    // Buscar compra existente por mpPreferenceId (si no la encontramos arriba)
    const snap = await db
      .collection("compras")
      .where("mpPreferenceId", "==", prefId)
      .limit(1)
      .get();

    let compraDocRef;

    if (snap.empty) {
      // crear compra solo si está approved
      if (estado !== "approved") {
        console.log("⚠ Pago no aprobado, no se crea compra.");
        return res.sendStatus(200);
      }

      compraDocRef = await db.collection("compras").add({
        sorteoId,
        telefono,
        cantidad,
        status: estado,
        mpPreferenceId: prefId,
        mpPaymentId: paymentId,
        mpPayer: payment.payer || null,
        totalPagado: payment.transaction_details?.total_paid_amount || 0,
        mpAccount: compraData?.mpAccount || (usedToken === process.env.MERCADOPAGO_ACCESS_TOKEN_2 ? "2" : "1"),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      console.log("🟢 Compra creada automaticamente:", compraDocRef.id);
    } else {
      compraDocRef = snap.docs[0].ref;
      const compraData2 = snap.docs[0].data();

      if (compraData2.status === "approved") {
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

    // Sumar chances y crearlas si está approved
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
