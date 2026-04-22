// FILE: routes/chances.js
import express from "express";
import admin, { db } from "../config/firebase.js";

const router = express.Router();

router.delete("/bulk", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];

    if (ids.length === 0) {
      return res.status(400).json({ error: "No se enviaron chances para borrar" });
    }

    const uniqueIds = [...new Set(ids)];
    const refs = uniqueIds.map((id) => db.collection("chances").doc(id));
    const docs = await db.getAll(...refs);

    const batch = db.batch();
    const resumenPorSorteo = new Map();
    let eliminadas = 0;

    docs.forEach((doc) => {
      if (!doc.exists) return;

      const data = doc.data() || {};
      const sorteoId = data.sorteoId;
      const precio = Number(data.precio || 0);

      batch.delete(doc.ref);
      eliminadas += 1;

      if (!sorteoId) return;

      const actual = resumenPorSorteo.get(sorteoId) || {
        chancesVendidas: 0,
        totalRecaudado: 0,
      };

      actual.chancesVendidas -= 1;
      actual.totalRecaudado -= precio;
      resumenPorSorteo.set(sorteoId, actual);
    });

    resumenPorSorteo.forEach((delta, sorteoId) => {
      batch.set(
        db.collection("sorteos").doc(sorteoId),
        {
          chancesVendidas: admin.firestore.FieldValue.increment(delta.chancesVendidas),
          totalRecaudado: admin.firestore.FieldValue.increment(delta.totalRecaudado),
          editedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    await batch.commit();

    res.json({
      ok: true,
      eliminadas,
    });
  } catch (err) {
    console.error("DELETE /chances/bulk ERROR:", err);
    res.status(500).json({ error: "Error eliminando chances" });
  }
});

// ===========================
// GET /chances
// ===========================
router.get("/", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;

    const snap = await db
      .collection("chances")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const lista = snap.docs.map((d) => {
      const data = d.data();

      return {
        id: d.id,
        ...data,

        // Normalización (compatibilidad con chances viejas)
        createdAt: data.createdAt || data.fecha || null,
        mpStatus: data.mpStatus || "approved",
        mpPaymentId: data.mpPaymentId || null,
        numero: data.numero || 1,
        sorteoId: data.sorteoId || null,
        compraId: data.compraId || null,
      };
    });

    res.json(lista);

  } catch (err) {
    console.error("GET /chances ERROR:", err);
    res.status(500).json({ error: "Error obteniendo chances" });
  }
});

// ===========================
// GET /chances/resumen
// ===========================
router.get("/resumen", async (req, res) => {
  try {
    // ----- 1) Obtener sorteos -----
    const sorteosSnap = await db.collection("sorteos").get();
    const sorteos = sorteosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // ----- 2) Obtener compras -----
    const comprasSnap = await db.collection("compras").get();
    const compras = comprasSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // ----- 3) Armar resumen por sorteo -----
    const respuesta = sorteos.map((sorteo) => {
      const comprasDeEste = compras.filter(
        (c) => c.sorteoId === sorteo.id
      );

      // Cantidad total de números vendidos (solo pagados)
      const vendidos = comprasDeEste.reduce((acc, c) => {
        if (c.status === "pagado") {
          return acc + (Number(c.cantidad) || 0);
        }
        return acc;
      }, 0);

      return {
        sorteoId: sorteo.id,
        titulo: sorteo.titulo,
        numerosTotales: sorteo.numerosTotales || 0,
        vendidos,
        restantes: (sorteo.numerosTotales || 0) - vendidos,
        compras: comprasDeEste,
      };
    });

    res.json(respuesta);

  } catch (err) {
    console.error("GET /chances/resumen ERROR:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
