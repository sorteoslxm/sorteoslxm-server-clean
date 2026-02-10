// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🧾 Listar compras (admin) */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("compras")
      .orderBy("createdAt", "desc")
      .get();

    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(lista);
  } catch (err) {
    console.error("GET /compras ERROR:", err);
    res.status(500).json({ error: "Error obteniendo compras" });
  }
});

/* ➕ Crear compra manual (transferencia) */
router.post("/", async (req, res) => {
  try {
    const { sorteoId, telefono, cantidad, precio, aliasPago } = req.body;

    if (!sorteoId || !telefono || !cantidad || !precio) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const ref = await db.collection("compras").add({
      sorteoId,
      telefono,
      cantidad: Number(cantidad),
      precio: Number(precio),
      aliasPago,
      metodo: "transferencia",
      estado: "pendiente",
      createdAt: new Date().toISOString(),
    });

    res.json({ ok: true, compraId: ref.id });
  } catch (err) {
    console.error("POST /compras ERROR:", err);
    res.status(500).json({ error: "Error creando compra" });
  }
});

export default router;
