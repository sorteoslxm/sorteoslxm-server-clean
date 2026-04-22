// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

function parseMoney(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value) || 0;

  const normalized = value.replace(/\./g, "").replace(/,/g, ".");
  return Number(normalized) || 0;
}

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
    const precioNormalizado = parseMoney(precio);

    if (!sorteoId || !telefono || !cantidad || !precioNormalizado) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const ref = await db.collection("compras").add({
      sorteoId,
      telefono,
      cantidad: Number(cantidad),
      precio: precioNormalizado,
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
