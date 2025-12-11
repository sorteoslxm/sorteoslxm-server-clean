// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* Listar compras (admin) */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("compras").orderBy("createdAt", "desc").get();
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(lista);
  } catch (err) {
    console.error("GET /compras ERROR:", err);
    res.status(500).json({ error: "Error obteniendo compras" });
  }
});

/* Crear compra preliminar (si quieres usar este endpoint desde frontend en lugar del que crea preferencia) */
router.post("/crear", async (req, res) => {
  try {
    const { sorteoId, telefono, nombre, email, cantidad, mpPreferenceId, mpAccount } = req.body;

    if (!sorteoId || !telefono || !cantidad) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    const compraRef = await db.collection("compras").add({
      sorteoId,
      telefono,
      nombre: nombre || null,
      email: email || null,
      cantidad: Number(cantidad || 1),
      mpPreferenceId: mpPreferenceId || null,
      mpAccount: mpAccount || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ ok: true, compraId: compraRef.id });
  } catch (err) {
    console.error("POST /compras/crear ERROR:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
