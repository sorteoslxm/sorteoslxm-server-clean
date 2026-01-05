// FILE: routes/cajas.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 PUBLIC · LISTAR CAJAS ACTIVAS
   GET /cajas
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .where("estado", "==", "activa")
      .orderBy("createdAt", "desc")
      .get();

    const cajas = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(cajas);
  } catch (error) {
    console.error("❌ Error obteniendo cajas:", error);
    res.status(500).json([]);
  }
});

/* ================================
   📦 PUBLIC · OBTENER CAJA POR ID
   GET /cajas/:id
================================= */
router.get("/:id", async (req, res) => {
  try {
    const doc = await db
      .collection("cajas")
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json(null);
    }

    const data = doc.data();

    if (data.estado !== "activa") {
      return res.status(404).json(null);
    }

    res.json({
      id: doc.id,
      ...data,
    });
  } catch (error) {
    console.error("❌ Error obteniendo caja:", error);
    res.status(500).json(null);
  }
});

export default router;
