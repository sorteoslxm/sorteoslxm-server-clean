// FILE: routes/chances.js  (reemplazar o agregar rutas)
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// GET /chances?limit=200  -> devuelve lista de docs 'chances' ordenadas desc
router.get("/", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;

    const snap = await db
      .collection("chances")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(lista);
  } catch (err) {
    console.error("GET /chances ERROR:", err);
    res.status(500).json({ error: "Error obteniendo chances" });
  }
});

/* opcional: /chances/resumen -> resumen por sorteo (ya tenías algo parecido) */
router.get("/resumen", async (req, res) => {
  try {
    const sorteosSnap = await db.collection("sorteos").get();
    const sorteos = sorteosSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const comprasSnap = await db.collection("compras").get();
    const compras = comprasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const respuesta = sorteos.map((sorteo) => {
      const comprasDeEste = compras.filter((c) => c.sorteoId === sorteo.id);
      const vendidos = comprasDeEste.reduce((acc, c) => acc + (c.cantidad || 0), 0);
      return {
        sorteoId: sorteo.id,
        titulo: sorteo.titulo,
        numerosTotales: sorteo.numerosTotales,
        vendidos,
        restantes: (sorteo.numerosTotales || 0) - vendidos,
        compradores: comprasDeEste,
      };
    });

    res.json(respuesta);
  } catch (err) {
    console.error("GET /chances/resumen ERROR:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
