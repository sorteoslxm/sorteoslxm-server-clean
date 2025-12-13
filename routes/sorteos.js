// FILE: routes/sorteos.js
// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todos los sorteos (excluye eliminados SIN índice) */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("sorteos")
      .orderBy("createdAt", "desc")
      .get();

    const lista = await Promise.all(
      snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((s) => s.eliminado !== true)
        .map(async (sorteo) => {
          const chancesSnap = await db
            .collection("chances")
            .where("sorteoId", "==", sorteo.id)
            .get();

          const chancesVendidas = chancesSnap.size;
          const chancesTotales = Number(sorteo.numerosTotales || 0);
          const chancesDisponibles = Math.max(
            chancesTotales - chancesVendidas,
            0
          );

          return {
            ...sorteo,
            chancesVendidas,
            chancesDisponibles,
            cerrado: chancesDisponibles <= 0,
          };
        })
    );

    res.json(lista);
  } catch (e) {
    console.error("GET /sorteos ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteos" });
  }
});

/* 🟨 Obtener un sorteo por ID (si no está eliminado) */
router.get("/:id", async (req, res) => {
  try {
    const docRef = db.collection("sorteos").doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.eliminado === true) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const sorteo = { id: doc.id, ...doc.data() };

    const chancesSnap = await db
      .collection("chances")
      .where("sorteoId", "==", sorteo.id)
      .get();

    const chancesVendidas = chancesSnap.size;
    const chancesTotales = Number(sorteo.numerosTotales || 0);
    const chancesDisponibles = Math.max(
      chancesTotales - chancesVendidas,
      0
    );

    res.json({
      ...sorteo,
      chancesVendidas,
      chancesDisponibles,
      cerrado: chancesDisponibles <= 0,
    });
  } catch (e) {
    console.error("GET /sorteos/:id ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteo" });
  }
});

/* 🟩 Editar sorteo */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let data = { ...req.body };

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    if (data.precio !== undefined) data.precio = Number(data.precio);
    if (data.numerosTotales !== undefined)
      data.numerosTotales = Number(data.numerosTotales);
    if (data.activarAutoUltimas !== undefined)
      data.activarAutoUltimas = Number(data.activarAutoUltimas);

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

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    if (data.precio !== undefined) data.precio = Number(data.precio);
    if (data.numerosTotales !== undefined)
      data.numerosTotales = Number(data.numerosTotales);

    const docRef = await db.collection("sorteos").add({
      ...data,
      eliminado: false,
      createdAt: new Date().toISOString(),
    });

    res.json({ ok: true, id: docRef.id });
  } catch (e) {
    console.error("POST /sorteos ERROR:", e);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

/* 🟥 Eliminar sorteo (soft delete) */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const ref = db.collection("sorteos").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    await ref.update({
      eliminado: true,
      eliminadoAt: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /sorteos ERROR:", e);
    res.status(500).json({ error: "Error eliminando sorteo" });
  }
});

export default router;
