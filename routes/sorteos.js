// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* 🟦 Obtener todos los sorteos */
router.get("/", async (req, res) => {
  try {
    const [sorteosSnap, chancesSnap] = await Promise.all([
      db.collection("sorteos").orderBy("createdAt", "desc").get(),
      db.collection("chances").get(),
    ]);

    const chancesPorSorteo = {};

    chancesSnap.forEach((doc) => {
      const chance = doc.data();
      const sorteoId = chance.sorteoId;

      if (!sorteoId) return;

      if (!chancesPorSorteo[sorteoId]) {
        chancesPorSorteo[sorteoId] = 0;
      }

      chancesPorSorteo[sorteoId] += 1;
    });

    const lista = sorteosSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((s) => s.eliminado !== true)
      .map((sorteo) => {
        const chancesVendidas = chancesPorSorteo[sorteo.id] || 0;
        const chancesTotales = Number(sorteo.numerosTotales || 0);
        const chancesDisponibles = Math.max(
          chancesTotales - chancesVendidas,
          0
        );

        return {
          ...sorteo,
          ofertas: Array.isArray(sorteo.ofertas) ? sorteo.ofertas : [],
          aliasPago: sorteo.aliasPago || "",
          chancesVendidas,
          chancesDisponibles,
          cerrado: chancesDisponibles <= 0,
        };
      });

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
      ofertas: Array.isArray(sorteo.ofertas) ? sorteo.ofertas : [],
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
        nombre: o.nombre || "",
        cantidad: Number(o.cantidad),
        precio: Number(o.precio),
        orden: Number(o.orden || 0),
        destacado: Boolean(o.destacado),
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
