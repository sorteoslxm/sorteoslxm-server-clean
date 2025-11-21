// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===============================
   🟦 1) OBTENER TODOS LOS SORTEOS
   =============================== */
router.get("/", async (req, res) => {
  try {
    const snapshot = await db
      .collection("sorteos")
      .orderBy("createdAt", "desc")
      .get();

    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(sorteos);
  } catch (error) {
    console.error("❌ Error al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

/* =======================================
   🟩 2) OBTENER UN SOLO SORTEO POR ID
   ======================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("sorteos").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    res.json({
      id: doc.id,
      ...doc.data(),
    });
  } catch (error) {
    console.error("❌ Error al obtener sorteo:", error);
    res.status(500).json({ error: "Error al obtener sorteo por ID" });
  }
});

/* ===============================
   🟧 3) CREAR SORTEO
   =============================== */
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    data.createdAt = new Date().toISOString();
    data.featured = data.featured || false; // destacado
    data.bannerPrincipal = data.bannerPrincipal || false;

    const ref = await db.collection("sorteos").add(data);

    res.json({
      success: true,
      id: ref.id,
    });
  } catch (error) {
    console.error("❌ Error al crear sorteo:", error);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

/* =========================================
   🟨 4) DESTACAR SORTEO (FEATURED = TRUE)
   ========================================= */
router.patch("/:id/destacar", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("sorteos").doc(id).update({
      featured: true,
    });

    res.json({ success: true, message: "Sorteo marcado como destacado" });
  } catch (error) {
    console.error("❌ Error al destacar sorteo:", error);
    res.status(500).json({ error: "Error al destacar sorteo" });
  }
});

export default router;
