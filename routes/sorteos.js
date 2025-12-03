// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ===============================
   🟦 1) OBTENER TODOS LOS SORTEOS
   =============================== */
router.get("/", async (req, res) => {
  try {
    const snapshot = await db
      .collection("sorteos")
      .orderBy("createdAt", "desc")
      .get();

    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(sorteos);
  } catch (error) {
    console.error("❌ Error al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

/* =======================================
   🟩 2) OBTENER UN SOLO SORTEO POR ID
   ======================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("sorteos").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    res.json({
      id: doc.id,
      ...doc.data(),
    });
  } catch (error) {
    console.error("❌ Error al obtener sorteo:", error);
    res.status(500).json({ error: "Error al obtener sorteo por ID" });
  }
});

/* ===============================
   🟧 3) CREAR SORTEO
   =============================== */
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    const nuevo = {
      titulo: data.titulo || "",
      descripcion: data.descripcion || "",
      precio: Number(data.precio) || 0,
      numerosTotales: Number(data.numerosTotales) || 0,
      imagenUrl: data.imagenUrl || "",
      mpCuenta: data.mpCuenta || "",
      destacado: data.destacado || false,
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("sorteos").add(nuevo);

    res.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("❌ Error al crear sorteo:", error);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

/* ===============================
   🟪 4) EDITAR SORTEO
   =============================== */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const actualizado = {
      titulo: data.titulo,
      descripcion: data.descripcion,
      precio: Number(data.precio),
      numerosTotales: Number(data.numerosTotales),
      imagenUrl: data.imagenUrl,
      mpCuenta: data.mpCuenta,
      destacado: data.destacado,
      editedAt: new Date().toISOString(),
    };

    await db.collection("sorteos").doc(id).update(actualizado);

    res.json({ success: true, message: "Sorteo actualizado" });
  } catch (error) {
    console.error("❌ Error al editar sorteo:", error);
    res.status(500).json({ error: "Error al editar sorteo" });
  }
});

/* ===============================
   🟥 5) ELIMINAR SORTEO
   =============================== */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("sorteos").doc(id).delete();

    res.json({ success: true, message: "Sorteo eliminado" });
  } catch (error) {
    console.error("❌ Error al eliminar sorteo:", error);
    res.status(500).json({ error: "Error al eliminar sorteo" });
  }
});

export default router;
