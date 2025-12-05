// FILE: routes/chances.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================
   GET ➜ obtener configuración de chances
============================================ */
router.get("/", async (req, res) => {
  try {
    const doc = await db.collection("config").doc("chances").get();

    if (!doc.exists) {
      return res.json({ ultimas: 0 }); // valor por defecto
    }

    return res.json(doc.data());
  } catch (err) {
    console.error("❌ Error al obtener chances:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* ============================================
   POST ➜ actualizar configuración
============================================ */
router.post("/", async (req, res) => {
  try {
    const { ultimas } = req.body;

    await db.collection("config").doc("chances").set({ ultimas });

    res.json({ ok: true, ultimas });
  } catch (err) {
    console.error("❌ Error al guardar chances:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
