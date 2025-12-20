// FILE: scripts/reprocesar-pendientes-sandbox.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("❌ No se encontró FIREBASE_SERVICE_ACCOUNT en las variables de entorno");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SANDBOX_ACCESS_TOKEN_1 = process.env.MERCADOPAGO_ACCESS_TOKEN_1;
const SANDBOX_ACCESS_TOKEN_2 = process.env.MERCADOPAGO_ACCESS_TOKEN_2;

function getAccessToken(mpCuenta) {
  return mpCuenta === "2" ? SANDBOX_ACCESS_TOKEN_2 : SANDBOX_ACCESS_TOKEN_1;
}

async function reprocesarPendientes() {
  const snap = await db.collection("compras").where("status", "==", "pendiente").get();

  if (snap.empty) {
    console.log("✅ No hay pagos pendientes");
    return;
  }

  console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const mpCuenta = data.mpCuenta || "1";
    const accessToken = getAccessToken(mpCuenta);

    // Reprocesar pago en sandbox usando la API de MercadoPago
    let paymentId = data.mpPaymentId;
    let paymentStatus = "approved";

    try {
      if (!paymentId && data.mpPreferenceId) {
        // Crear un pago simulado en sandbox
        const res = await axios.post(
          "https://api.mercadopago.com/v1/payments",
          {
            transaction_amount: data.cantidad || 1,
            description: "Pago simulado sandbox",
            payment_method_id: "visa",
            payer: {
              email: "test_user_1234@testuser.com",
              identification: { type: "DNI", number: "12345678" },
              phone: { area_code: "11", number: data.telefono || "00000000" },
            },
            binary_mode: true,
            external_reference: doc.id,
            statement_descriptor: "SORTEOSLXM",
            installments: 1,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        paymentId = res.data.id;
        paymentStatus = res.data.status;
      }

      if (paymentStatus === "approved") {
        // Actualizar compra
        await doc.ref.update({
          status: "approved",
          mpStatus: "approved",
          mpPaymentId: paymentId,
          recovered: true,
          reprocessedAt: new Date().toISOString(),
        });

        // Crear chances
        for (let i = 0; i < (data.cantidad || 1); i++) {
          await db.collection("chances").add({
            sorteoId: data.sorteoId,
            compraId: doc.id,
            telefono: data.telefono || null,
            mpStatus: "approved",
            mpPaymentId: paymentId,
            mpCuenta,
            createdAt: new Date().toISOString(),
          });
        }

        console.log(`✅ Pago aprobado y chances creadas: ${doc.id} (mpPaymentId: ${paymentId})`);
      }
    } catch (err) {
      console.error("❌ Error reprocesando pago:", doc.id, err.response?.data || err.message);
    }
  }
}

reprocesarPendientes().catch((err) => console.error("❌ Error general:", err.message));
