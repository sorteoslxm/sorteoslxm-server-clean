import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 Crear Caja
================================= */
router.post("/", async (req, res) => {
  try {
    const {
      titulo,
      totalCajas,
      montoTotal
    } = req.body;

    const nuevaCaja = {
      titulo,
      version: 1,
      activa: true,
      estado: "activa",
      totalCajas,
      cajasVendidas: 0,
      montoTotal,
      createdAt: new Date(),
      closedAt: null
    };

    const docRef = await db.collection("cajas").add(nuevaCaja);

    res.json({ ok: true, id: docRef.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

/* ================================
   📊 Obtener Caja Activa
================================= */
router.get("/activa", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .where("activa", "==", true)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json(null);
    }

    const doc = snap.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json(null);
  }
});

export default router;
