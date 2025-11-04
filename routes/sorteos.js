// web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import admin from "../config/firebase.js";

const router = express.Router();
const db = admin.firestore();

router.get("/", async (req, res) => {
  try {
    console.log("🟢 Obteniendo sorteos desde Firestore...");
    const snapshot = await db.collection("sorteos").get();

    if (snapshot.empty) {
      console.log("⚠️ No se encontraron sorteos en Firestore.");
      return res.json([]);
    }

    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Se obtuvieron ${sorteos.length} sorteos.`);
    res.json(sorteos);
  } catch (error) {
    console.error("❌ Error detallado al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos", details: error.message });
  }
});

export default router;
