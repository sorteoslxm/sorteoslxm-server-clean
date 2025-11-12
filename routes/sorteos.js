import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// ✅ Obtener todos los sorteos
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("sorteos").get();
    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Si existe createdAt, los ordena; si no, los deja como están
    sorteos.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return 0;
    });

    res.json(sorteos);
  } catch (error) {
    console.error("❌ Error al obtener sorteos:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
