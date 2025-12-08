// FILE: routes/chances.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================================
   GET /chances
   Devuelve TODAS las chances individuales para AdminChances
============================================================ */
router.get("/", async (req, res) => {
  const limit = parseInt(req.query.limit) || 300;

  try {
    const snapshot = await db
      .collection("chances")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const chances = snapshot.docs.map((doc) => ({
      id: doc.id,          // ← ID del documento
      ...doc.data(),       // ← sorteoId, numero, telefono, titulo, etc.
    }));

    return res.json(chances);
  } catch (error) {
    console.error("❌ Error GET /chances:", error);
    return res.status(500).json({ error: "Error al obtener chances" });
  }
});

/* ============================================================
   GET /chances/resumen
   Resumen global por sorteo
============================================================ */
router.get("/resumen", async (req, res) => {
  try {
    // 1) Obtener todos los sorteos
    const sorteosSnap = await db.collection("sorteos").get();
    const sorteos = sorteosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 2) Obtener todas las compras
    const comprasSnap = await db.collection("compras").get();
    const compras = comprasSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 3) Armar respuesta agrupada por sorteo
    const respuesta = sorteos.map((sorteo) => {
      const comprasDeEste = compras.filter((c) => c.sorteoId === sorteo.id);

      const vendidos = comprasDeEste.reduce(
        (acc, c) => acc + (c.cantidad || 0),
        0
      );

      return {
        sorteoId: sorteo.id,
        titulo: sorteo.titulo,
        numerosTotales: sorteo.numerosTotales,
        vendidos,
        restantes: sorteo.numerosTotales - vendidos,
        compradores: comprasDeEste.map((c) => ({
          compraId: c.id,
          telefono: c.telefono,
          cantidad: c.cantidad,
          tituloCompra: c.titulo,
          createdAt: c.createdAt,
        })),
      };
    });

    res.json(respuesta);
  } catch (err) {
    console.error("❌ Error GET /chances/resumen:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
