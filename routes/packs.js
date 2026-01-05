import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 PACKS ACTIVOS POR CAJA (PÚBLICO)
   GET /packs/activos/:cajaId
================================ */
router.get("/activos/:cajaId", async (req, res) => {
  try {
    const { cajaId } = req.params;

    const snap = await db
      .collection("packs")
      .where("cajaId", "==", cajaId)
      .where("estado", "==", "activo")
      .orderBy("precio", "asc")
      .get();

    const packs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(packs);
  } catch (error) {
    console.error("❌ Packs activos:", error);
    res.status(500).json([]);
  }
});

export default router;
