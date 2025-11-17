// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/sorteos.js

import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * 👉 GET /api/sorteos
 * Obtiene todos los sorteos ordenados por fecha
 */
router.get("/", async (req, res) => {
  try {
    const snapshot = await db
      .collection("sorteos")
      .orderBy("createdAt", "desc")
      .get();

    const sorteos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(sorteos);
  } catch (error) {
    console.error("❌ Error al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

/**
 * 👉 POST /api/sorteos
 * Crea un nuevo sorteo
 */
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    data.createdAt = new Date().toISOString();

    const ref = await db.collection("sorteos").add(data);

    res.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("❌ Error al crear sorteo:", error);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

/**
 * 👉 PUT /api/sorteos/:id
 * Edita un sorteo por ID
 */
router.put("/:id", async (req, res) => {
  try {
    await db.collection("sorteos").doc(req.params.id).update(req.body);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al editar sorteo:", error);
    res.status(500).json({ error: "Error al editar sorteo" });
  }
});

/**
 * 👉 DELETE /api/sorteos/:id
 * Elimina un sorteo por ID
 */
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("sorteos").doc(req.params.id).delete();

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al eliminar sorteo:", error);
    res.status(500).json({ error: "Error al eliminar sorteo" });
  }
});

export default router;
