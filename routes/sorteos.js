// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();
let sorteosCache = null;
let sorteosCacheAt = 0;
const SORTEOS_CACHE_MS = 15000;

function normalizeSorteo(doc) {
  const sorteo = { id: doc.id, ...doc.data() };
  const chancesTotales = Number(sorteo.numerosTotales || 0);
  const chancesVendidas = Number(sorteo.chancesVendidas || 0);
  const chancesDisponibles = Math.max(chancesTotales - chancesVendidas, 0);

  return {
    ...sorteo,
    ofertas: Array.isArray(sorteo.ofertas) ? sorteo.ofertas : [],
    aliasPago: sorteo.aliasPago || "",
    chancesVendidas,
    chancesDisponibles,
    cerrado: chancesDisponibles <= 0,
  };
}

export function invalidateSorteosCache() {
  sorteosCache = null;
  sorteosCacheAt = 0;
}

/* 🟦 Obtener todos los sorteos */
router.get("/", async (_, res) => {
  try {
    if (sorteosCache && Date.now() - sorteosCacheAt < SORTEOS_CACHE_MS) {
      return res.json(sorteosCache);
    }

    const sorteosSnap = await db
      .collection("sorteos")
      .orderBy("createdAt", "desc")
      .get();

    const lista = sorteosSnap.docs
      .filter((doc) => doc.data()?.eliminado !== true)
      .map(normalizeSorteo);

    sorteosCache = lista;
    sorteosCacheAt = Date.now();

    res.json(lista);
  } catch (e) {
    console.error("GET /sorteos ERROR:", e);
    res.status(500).json({ error: "Error obteniendo sorteos" });
  }
});

/* 🟨 Obtener sorteo por ID */
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("sorteos").doc(req.params.id).get();

    if (!doc.exists || doc.data()?.eliminado === true) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    res.json(normalizeSorteo(doc));
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
    invalidateSorteosCache();

    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /sorteos ERROR:", e);
    res.status(500).json({ error: "Error editando sorteo" });
  }
});

export default router;
