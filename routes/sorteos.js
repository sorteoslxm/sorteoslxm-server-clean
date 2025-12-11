// FILE: /web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todos los sorteos */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("sorteos").orderBy("createdAt", "desc").get();
    const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(lista);
  } catch (e) {
    console.error("GET /sorteos ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteos" });
  }
});

/* 🟨 Obtener un sorteo por ID */
router.get("/:id", async (req, res) => {
  try {
    const docRef = db.collection("sorteos").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Sorteo no encontrado" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) {
    console.error("GET /sorteos/:id ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteo" });
  }
});

/* 🟩 Editar sorteo - devuelve el documento actualizado */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let data = { ...req.body };

    // Limpiar undefined/null
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    // Cast numéricos
    if (data.precio !== undefined) data.precio = Number(data.precio);
    if (data.numerosTotales !== undefined) data.numerosTotales = Number(data.numerosTotales);
    if (data.activarAutoUltimas !== undefined) data.activarAutoUltimas = Number(data.activarAutoUltimas);

    data.editedAt = new Date().toISOString();

    const docRef = db.collection("sorteos").doc(id);
    await docRef.update(data);

    const updated = await docRef.get();
    res.json({ ok: true, id: updated.id, ...updated.data() });
  } catch (e) {
    console.error("PUT /sorteos ERROR:", e);
    res.status(500).json({ error: "Error al editar sorteo" });
  }
});

/* 🟩 Crear nuevo sorteo */
router.post("/", async (req, res) => {
  try {
    let data = { ...req.body };

    // Limpiar valores nulos
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    if (data.precio !== undefined) data.precio = Number(data.precio);
    if (data.numerosTotales !== undefined) data.numerosTotales = Number(data.numerosTotales);

    const docRef = await db.collection("sorteos").add({
      ...data,
      createdAt: new Date().toISOString(),
    });

    res.json({ ok: true, id: docRef.id });
  } catch (e) {
    console.error("POST /sorteos ERROR:", e);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

export default router;
