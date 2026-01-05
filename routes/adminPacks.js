// FILE: server/routes/adminPacks.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* =====================================
   📦 ADMIN · LISTAR PACKS POR CAJA
   GET /admin/packs?cajaId=xxx
===================================== */
router.get("/", async (req, res) => {
  try {
    const { cajaId } = req.query;

    if (!cajaId) {
      return res.status(400).json([]);
    }

    const snap = await db
      .collection("packs")
      .where("cajaId", "==", cajaId)
      .orderBy("orden", "asc")
      .get();

    const packs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(packs);
  } catch (error) {
    console.error("❌ Admin packs GET:", error);
    res.status(500).json([]);
  }
});

/* =====================================
   ➕ ADMIN · CREAR PACK
   POST /admin/packs
===================================== */
router.post("/", async (req, res) => {
  try {
    const {
      cajaId,
      cantidad,
      precio,
      destacado = false,
      orden = 1,
      activo = true,
    } = req.body;

    if (!cajaId || !cantidad || !precio) {
      return res.status(400).json({ error: true });
    }

    const data = {
      cajaId,
      cantidad: Number(cantidad),
      precio: Number(precio),
      destacado: Boolean(destacado),
      orden: Number(orden),
      activo: Boolean(activo),
      createdAt: new Date(),
    };

    const ref = await db.collection("packs").add(data);

    res.json({ id: ref.id });
  } catch (error) {
    console.error("❌ Admin packs POST:", error);
    res.status(500).json({ error: true });
  }
});

/* =====================================
   ✏️ ADMIN · EDITAR PACK
   PUT /admin/packs/:id
===================================== */
router.put("/:id", async (req, res) => {
  try {
    const {
      cantidad,
      precio,
      destacado,
      orden,
      activo,
    } = req.body;

    const data = {
      ...(cantidad !== undefined && { cantidad: Number(cantidad) }),
      ...(precio !== undefined && { precio: Number(precio) }),
      ...(destacado !== undefined && { destacado: Boolean(destacado) }),
      ...(orden !== undefined && { orden: Number(orden) }),
      ...(activo !== undefined && { activo: Boolean(activo) }),
      updatedAt: new Date(),
    };

    await db.collection("packs").doc(req.params.id).update(data);

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Admin packs PUT:", error);
    res.status(500).json({ error: true });
  }
});

/* =====================================
   ❌ ADMIN · DESACTIVAR PACK
   DELETE /admin/packs/:id
   (NO borra, solo apaga)
===================================== */
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("packs").doc(req.params.id).update({
      activo: false,
      updatedAt: new Date(),
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Admin packs DELETE:", error);
    res.status(500).json({ error: true });
  }
});

export default router;
