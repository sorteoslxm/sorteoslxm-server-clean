// FILE: /scripts/aprobar-pendientes.js
import { db } from "../config/firebase.js"; // Ruta relativa correcta
import dotenv from "dotenv";

dotenv.config();

async function aprobarPendientes() {
  try {
    const snap = await db.collection("compras")
      .where("status", "==", "pendiente")
      .get();

    if (snap.empty) {
      console.log("✅ No hay pagos pendientes para aprobar.");
      return;
    }

    console.log(`✅ Pagos pendientes encontrados: ${snap.docs.length}\n`);

    for (const doc of snap.docs) {
      const compra = doc.data();
      const compraId = doc.id;

      // Actualizar estado a approved
      await doc.ref.update({
        status: "approved",
        mpStatus: "approved",
        updatedAt: new Date().toISOString(),
        recovered: true
      });

      // Verificar si la chance ya existe
      const chanceSnap = await db.collection("chances")
        .where("compraId", "==", compraId)
        .limit(1)
        .get();

      if (chanceSnap.empty) {
        // Crear chance nueva
        const chanceData = {
          compraId,
          sorteoId: compra.sorteoId,
          precio: Number(compra.cantidad) || 1,
          mpStatus: "approved",
          createdAt: new Date().toISOString(),
        };
        await db.collection("chances").add(chanceData);
        console.log(`✔ Compra ${compraId} aprobada y chance creada.`);
      } else {
        console.log(`✔ Compra ${compraId} aprobada (chance ya existía).`);
      }
    }

    console.log("\n🎉 Todos los pagos pendientes fueron procesados correctamente.");
  } catch (err) {
    console.error("❌ Error aprobando pagos pendientes:", err);
  }
}

aprobarPendientes();
