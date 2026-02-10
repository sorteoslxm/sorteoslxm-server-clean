// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todos los sorteos */
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
            ofertas: sorteo.ofertas || [],
            aliasPago: sorteo.aliasPago || "",
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

/* 🟨 Obtener sorteo por ID */
router.get("/:id", async (req, res) => {
  try {
    const ref = db.collection("sorteos").doc(req.params.id);
    const doc = await ref.get();

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
      ofertas: sorteo.ofertas || [],
      aliasPago: sorteo.aliasPago || "",
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
    const data = { ...req.body };

    if (Array.isArray(data.ofertas)) {
      data.ofertas = data.ofertas.map((o) => ({
        cantidad: Number(o.cantidad),
        precio: Number(o.precio),
      }));
    }

    data.editedAt = new Date().toISOString();

    await db.collection("sorteos").doc(req.params.id).update(data);

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /sorteos ERROR:", e);
    res.status(500).json({ error: "Error editando sorteo" });
  }
});

export default router;
