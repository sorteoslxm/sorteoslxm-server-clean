// FILE: routes/cajas.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 OBTENER CAJAS (ACTIVAS)
   GET /cajas
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("cajas").get();

    const cajas = snap.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(caja => caja.estado === "activa");

    res.json(cajas);
  } catch (error) {
    console.error("❌ Error obteniendo cajas:", error);
    res.status(500).json({ error: "Error obteniendo cajas" });
  }
});

/* ================================
   📦 OBTENER CAJA POR SLUG
   GET /cajas/:slug
================================= */
router.get("/:slug", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .where("slug", "==", req.params.slug)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json(null);
    }

    const doc = snap.docs[0];
    res.json({
      id: doc.id,
      ...doc.data(),
    });
  } catch (error) {
    console.error("❌ Error obteniendo caja:", error);
    res.status(500).json(null);
  }
});

export default router;
