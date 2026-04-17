import dotenv from "dotenv";
import admin from "../config/firebase.js";

dotenv.config();

const db = admin.firestore();

async function main() {
  const [sorteosSnap, chancesSnap, comprasSnap] = await Promise.all([
    db.collection("sorteos").get(),
    db.collection("chances").get(),
    db.collection("compras").get(),
  ]);

  const resumen = {};

  sorteosSnap.forEach((doc) => {
    resumen[doc.id] = { chancesVendidas: 0, totalRecaudado: 0 };
  });

  chancesSnap.forEach((doc) => {
    const c = doc.data();
    if (!c.sorteoId || !resumen[c.sorteoId]) return;

    resumen[c.sorteoId].chancesVendidas += 1;
    resumen[c.sorteoId].totalRecaudado += Number(c.precio || 0);
  });

  comprasSnap.forEach((doc) => {
    const c = doc.data();
    const aprobada =
      c.mpStatus === "approved" ||
      c.estado === "confirmado" ||
      c.status === "approved";

    if (!aprobada || !c.sorteoId || !resumen[c.sorteoId]) return;

    if (
      Number(c.cantidad || 0) > 0 &&
      Number(c.precio || c.total || 0) > 0 &&
      resumen[c.sorteoId].chancesVendidas === 0
    ) {
      resumen[c.sorteoId].chancesVendidas = Number(c.cantidad || 0);
      resumen[c.sorteoId].totalRecaudado = Number(c.precio || c.total || 0);
    }
  });

  const batch = db.batch();

  Object.entries(resumen).forEach(([sorteoId, data]) => {
    batch.update(db.collection("sorteos").doc(sorteoId), {
      chancesVendidas: data.chancesVendidas,
      totalRecaudado: data.totalRecaudado,
      editedAt: new Date().toISOString(),
    });
  });

  await batch.commit();
  console.log("✅ Resumen de sorteos recalculado");
}

main().catch((err) => {
  console.error("❌ Error recalculando resumen:", err);
  process.exit(1);
});
