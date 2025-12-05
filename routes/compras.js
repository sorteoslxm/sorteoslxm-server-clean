// FILE: web/sorteoslxm-server-clean/routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todas las compras */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("compras")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const compras = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(compras);
  } catch (err) {
    console.error("GET /compras ERROR:", err);
    res.status(500).json({ error: "Error obteniendo compras" });
  }
});

/* 🟨 Obtener compras por sorteo */
router.get("/sorteo/:sorteoId", async (req, res) => {
  try {
    const snap = await db
      .collection("compras")
      .where("sorteoId", "==", req.params.sorteoId)
      .orderBy("createdAt", "desc")
      .get();
    const compras = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(compras);
  } catch (err) {
    console.error("GET /compras/sorteo ERROR:", err);
    res.status(500).json({ error: "Error obteniendo compras por sorteo" });
  }
});

/* 🟩 Crear compra nueva */
router.post("/", async (req, res) => {
  try {
    const { sorteoId, telefono, cantidad, precio, mpCuenta, titulo } = req.body;

    if (!sorteoId || !telefono) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // Evitar compras duplicadas
    const dup = await db
      .collection("compras")
      .where("telefono", "==", telefono)
      .where("sorteoId", "==", sorteoId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!dup.empty) {
      return res.json({
        ok: true,
        compraId: dup.docs[0].id,
        yaExistia: true,
      });
    }

    // Crear compra
    const compraRef = await db.collection("compras").add({
      sorteoId,
      titulo,
      telefono,
      cantidad: Number(cantidad) || 1,
      precio: Number(precio),
      status: "pending",
      createdAt: Date.now(),
    });

    res.json({
      ok: true,
      compraId: compraRef.id,
    });
  } catch (err) {
    console.error("POST /compras ERROR:", err);
    res.status(500).json({ error: "Error creando compra" });
  }
});

export default router;
