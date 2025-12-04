// FILE: web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todos los sorteos */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("sorteos").get();
    const lista = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(lista);
  } catch (e) {
    console.error("GET /sorteos ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteos" });
  }
});

/* 🟩 Editar sorteo (seguro y completo) */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let data = req.body;

    // 🛡 Evitar guardar valores undefined o null
    Object.keys(data).forEach(key => {
      if (data[key] === undefined || data[key] === null) {
        delete data[key];
      }
    });

    // 🔢 Convertir números correctamente
    if (data.precio) data.precio = Number(data.precio);
    if (data.numerosTotales) data.numerosTotales = Number(data.numerosTotales);
    if (data.activarAutoUltimas) data.activarAutoUltimas = Number(data.activarAutoUltimas);

    await db.collection("sorteos").doc(id).update({
      ...data,
      editedAt: new Date().toISOString()
    });

    res.json({ ok: true });

  } catch (e) {
    console.error("PUT /sorteos ERROR:", e);
    res.status(500).json({ error: "Error al editar sorteo" });
  }
});

export default router;
