// /routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// Obtener todos los sorteos
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("sorteos").get();
    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(sorteos);
  } catch (err) {
    console.error("Error al obtener sorteos:", err);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

// Crear sorteo (solo si está autenticado)
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const docRef = await db.collection("sorteos").add({
      ...data,
      createdAt: new Date(),
    });

    res.json({ id: docRef.id });
  } catch (err) {
    console.error("Error al crear sorteo:", err);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

export default router;
