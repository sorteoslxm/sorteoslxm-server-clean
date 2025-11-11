// web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// ✅ Obtener todos los sorteos
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("sorteos").orderBy("createdAt", "desc").get();
    const sorteos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(sorteos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
