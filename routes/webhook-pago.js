// FILE: routes/webhook-pago.js
import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();
router.use(express.raw({ type: "*/*" }));

function extractPaymentId(body) {
  if (body?.topic === "payment" && !isNaN(body?.resource)) return body.resource;
  if (body?.type === "payment" && body?.data?.id) return body.data.id;
  return null;
}

function getClientByCuenta(mpCuenta) {
  const token =
    mpCuenta === "2"
      ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
      : process.env.MERCADOPAGO_ACCESS_TOKEN_1;

  return new Payment(
    new MercadoPagoConfig({
      accessToken: token,
    })
  );
}

async function getPaymentFromCuenta2First(paymentId) {
  try {
    const payment2 = await getClientByCuenta("2").get({ id: paymentId });
    return { payment: payment2, mpCuenta: "2" };
  } catch (e) {
    try {
      const payment1 = await getClientByCuenta("1").get({ id: paymentId });
      return { payment: payment1, mpCuenta: "1" };
    } catch {
      return null;
    }
  }
}

router.post("/", async (req, res) => {
  try {
    const body = JSON.parse(req.body.toString());
    console.log("📥 Webhook recibido:", JSON.stringify(body, null, 2));

    const paymentId = extractPaymentId(body);
    if (!paymentId) return res.sendStatus(200);

    /* ================================
       🔒 LOCK GLOBAL POR PAYMENT
    ================================ */
    const lockRef = db.collection("mpLocks").doc(paymentId.toString());
    if ((await lockRef.get()).exists) {
      console.log("⚠ Webhook ya procesado:", paymentId);
      return res.sendStatus(200);
    }

    /* ================================
       🔍 LEER PAGO (CUENTA 2 → 1)
    ================================ */
    const result = await getPaymentFromCuenta2First(paymentId);
    if (!result) {
      console.warn("⏳ Payment todavía no disponible:", paymentId);
      return res.sendStatus(200);
    }

    const { payment, mpCuenta } = result;

    /* ==================================================
       🎁 CASO CAJAS (NO INTERFIERE CON SORTEOS)
    ================================================== */
    const cajaId = payment.metadata?.cajaId;

    if (payment.status === "approved" && cajaId) {
      const yaExiste = await db
        .collection("pagosCajas")
        .where("paymentId", "==", paymentId)
        .limit(1)
        .get();

      if (yaExiste.empty) {
        await db.collection("pagosCajas").add({
          paymentId,
          cajaId,
          estado: "approved",
          usado: false,
          mpCuenta,
          createdAt: new Date(),
        });

        console.log("🎁 Pago de caja registrado:", cajaId);
      }
    }

    /* ==================================================
       🎟️ FLUJO ORIGINAL DE SORTEOS (INTACTO)
    ================================================== */
    const compraId = payment.external_reference;
    if (!compraId) {
      await lockRef.set({ processedAt: new Date() });
      return res.sendStatus(200);
    }

    const compraRef = db.collection("compras").doc(compraId);
    const compraSnap = await compraRef.get();
    if (!compraSnap.exists) {
      await lockRef.set({ processedAt: new Date() });
      return res.sendStatus(200);
    }

    const compra = compraSnap.data();
    const {
      sorteoId,
      cantidad = 1,
      telefono = null,
    } = compra;

    await compraRef.update({
      mpPaymentId: paymentId,
      mpStatus: payment.status,
      status: payment.status === "approved" ? "pagado" : "iniciada",
      mpCuenta,
      updatedAt: new Date().toISOString(),
    });

    if (payment.status === "approved") {
      const chancesSnap = await db
        .collection("chances")
        .where("mpPaymentId", "==", paymentId)
        .limit(1)
        .get();

      if (chancesSnap.empty) {
        for (let i = 0; i < cantidad; i++) {
          await db.collection("chances").add({
            sorteoId,
            compraId,
            telefono,
            mpPaymentId: paymentId,
            mpCuenta,
            mpStatus: "approved",
            createdAt: new Date().toISOString(),
          });
        }

        console.log(`🎉 ${cantidad} chances creadas (${compraId})`);
      }
    }

    /* ================================
       🔐 CERRAR LOCK
    ================================ */
    await lockRef.set({
      processedAt: new Date(),
      paymentId,
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR webhook:", err);
    return res.sendStatus(500);
  }
});

export default router;
