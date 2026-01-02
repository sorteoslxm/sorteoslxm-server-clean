import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 ADMIN · LISTAR TODAS LAS CAJAS
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .orderBy("createdAt", "desc")
      .get();

    const cajas = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(cajas);
  } catch (error) {
    console.error("❌ Admin cajas GET:", error);
    res.status(500).json([]);
  }
});

/* ================================
   ➕ ADMIN · CREAR CAJA
================================= */
router.post("/", async (req, res) => {
  try {
    const data = {
      ...req.body,
      estado: "activa",
      cajasVendidas: 0,
      createdAt: new Date(),
    };

    const ref = await db.collection("cajas").add(data);

    res.json({ id: ref.id });
  } catch (error) {
    console.error("❌ Admin cajas POST:", error);
    res.status(500).json({ error: true });
  }
});

/* ================================
   🔒 ADMIN · CERRAR CAJA
================================= */
router.put("/:id/cerrar", async (req, res) => {
  try {
    await db.collection("cajas").doc(req.params.id).update({
      estado: "cerrada",
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Admin cajas CERRAR:", error);
    res.status(500).json({ error: true });
  }
});

export default router;
