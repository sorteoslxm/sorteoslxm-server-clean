// 📁 web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import admin from "../config/firebase.js";

const router = express.Router();

router.get("/sorteos", async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("sorteos").get();

    if (snapshot.empty) {
      return res.json([]);
    }

    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(sorteos);
  } catch (error) {
    console.error("Error al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

export default router;
