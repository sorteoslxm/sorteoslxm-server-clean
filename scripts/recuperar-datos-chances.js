import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function recuperarDatos() {
  const chancesSnap = await db
    .collection("chances")
    .where("telefono", "==", null)
    .get();

  if (chancesSnap.empty) {
    console.log("✅ No hay chances para recuperar");
    return;
  }

  console.log(`🔍 Chances a corregir: ${chancesSnap.size}`);

  for (const chanceDoc of chancesSnap.docs) {
    const chance = chanceDoc.data();
    if (!chance.compraId) continue;

    const compraRef = db.collection("compras").doc(chance.compraId);
    const compraSnap = await compraRef.get();
    if (!compraSnap.exists) continue;

    const compra = compraSnap.data();

    await chanceDoc.ref.update({
      telefono: compra.telefono || null,
      mpCuenta: compra.mpCuenta || null,
      fixedAt: new Date().toISOString(),
    });

    console.log(`✅ Chance corregida: ${chanceDoc.id}`);
  }
}

recuperarDatos().catch(console.error);
