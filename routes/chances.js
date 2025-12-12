// FILE: routes/chances.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

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
