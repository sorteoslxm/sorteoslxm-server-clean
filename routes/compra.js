// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * GET /compras
 * Devuelve últimas compras (para admin)
 */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("compras").orderBy("createdAt", "desc").limit(200).get();
    const compras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(compras);
  } catch (err) {
    console.error("ERROR GET /compras:", err);
    res.status(500).json({ error: "Error obteniendo compras" });
  }
});

export default router;
