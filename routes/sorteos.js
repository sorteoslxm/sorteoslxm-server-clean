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
            ofertas: Array.isArray(sorteo.ofertas) ? sorteo.ofertas : [],
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

    // ✅ Normalizamos ofertas SIN perder campos
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

/* 🟥 Eliminar sorteo de forma segura */
router.delete("/:id", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const sorteoId = req.params.id;
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    const sorteoSnap = await sorteoRef.get();

    if (!sorteoSnap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const [chancesSnap, comprasSnap] = await Promise.all([
      db.collection("chances").where("sorteoId", "==", sorteoId).get(),
      db.collection("compras").where("sorteoId", "==", sorteoId).get(),
    ]);

    for (const doc of chancesSnap.docs) {
      await doc.ref.delete();
    }

    for (const doc of comprasSnap.docs) {
      await doc.ref.update({
        estado: "anulada",
        status: "cancelled",
        mpStatus: "cancelled",
        anuladoAt: new Date().toISOString(),
      });
    }

    await sorteoRef.update({
      eliminado: true,
      eliminadoAt: new Date().toISOString(),
    });

    res.json({
      ok: true,
      chancesEliminadas: chancesSnap.size,
      comprasAnuladas: comprasSnap.size,
    });
  } catch (e) {
    console.error("DELETE /sorteos ERROR:", e);
    res.status(500).json({ error: "Error eliminando sorteo" });
  }
});

export default router;
