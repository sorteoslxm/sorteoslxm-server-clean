// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* =============================================
   1) GET TODOS LOS SORTEOS
   ============================================= */
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("sorteos").get();

    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Ordenar:
    // 1) sorteoPrincipal primero
    // 2) destacados después
    // 3) el resto por fecha
    const ordenados = sorteos.sort((a, b) => {
      if (a.sorteoPrincipal) return -1;
      if (b.sorteoPrincipal) return 1;
      if (a.destacado && !b.destacado) return -1;
      if (b.destacado && !a.destacado) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(ordenados);
  } catch (error) {
    console.error("❌ Error al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

/* =============================================
   2) GET POR ID
   ============================================= */
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("sorteos").doc(req.params.id).get();

    if (!doc.exists)
      return res.status(404).json({ error: "Sorteo no encontrado" });

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("❌ Error al obtener sorteo:", error);
    res.status(500).json({ error: "Error al obtener sorteo por ID" });
  }
});

/* =============================================
   3) CREAR SORTEO
   ============================================= */
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
      destacado: !!data.destacado,
      sorteoPrincipal: !!data.sorteoPrincipal,
      createdAt: new Date().toISOString(),
    };

    // si este es principal, borrar otros principales
    if (nuevo.sorteoPrincipal) {
      const prev = await db
        .collection("sorteos")
        .where("sorteoPrincipal", "==", true)
        .get();

      prev.forEach(d => d.ref.update({ sorteoPrincipal: false }));
    }

    const ref = await db.collection("sorteos").add(nuevo);

    res.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("❌ Error al crear sorteo:", error);
    res.status(500).json({ error: "Error al crear sorteo" });
  }
});

/* =============================================
   4) EDITAR
   ============================================= */
router.put("/:id", async (req, res) => {
  try {
    const data = req.body;

    // si cambia principal → resetear otros
    if (data.sorteoPrincipal) {
      const prev = await db
        .collection("sorteos")
        .where("sorteoPrincipal", "==", true)
        .get();

      prev.forEach(d => {
        if (d.id !== req.params.id) d.ref.update({ sorteoPrincipal: false });
      });
    }

    await db.collection("sorteos").doc(req.params.id).update({
      ...data,
      editedAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error al editar sorteo:", error);
    res.status(500).json({ error: "Error al editar sorteo" });
  }
});

export default router;
