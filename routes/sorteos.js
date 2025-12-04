// FILE: web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todos los sorteos */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("sorteos").get();
    const lista = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(lista);
  } catch (e) {
    console.error("GET /sorteos ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteos" });
  }
});

/* 🟨 Obtener un sorteo por ID (⚠️ FALTABA ESTA RUTA) */
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("sorteos").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Sorteo no encontrado" });

    res.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error("GET /sorteos/:id ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteo" });
  }
});

/* 🟩 Editar sorteo */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let data = req.body;

    // Limpiar valores nulos
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    // Convertir números
    if (data.precio) data.precio = Number(data.precio);
    if (data.numerosTotales) data.numerosTotales = Number(data.numerosTotales);
    if (data.activarAutoUltimas) data.activarAutoUltimas = Number(data.activarAutoUltimas);

    await db.collection("sorteos").doc(id).update({
      ...data,
      editedAt: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /sorteos ERROR:", e);
    res.status(500).json({ error: "Error al editar sorteo" });
  }
});

export default router;
